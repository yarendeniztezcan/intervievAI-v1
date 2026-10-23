const express = require('express');
const { randomUUID } = require('crypto');
const router = express.Router();
const db = require('../models/database');
const { authenticateToken } = require('../middleware/auth');
const {
  ensureQuestions,
  generateAdaptiveQuestion,
  evaluateVerbalAnswer,
  recordAttempt,
  toPublicQuestion
} = require('../services/ai');

router.use(authenticateToken);

const MAX_COUNT = 30;
const MAX_ANSWER_LENGTH = 5000;
// 'voice': sözlü simülasyon. Sorular sözel sorularla aynıdır; fark cevabın konuşarak verilmesidir.
const VALID_TYPES = ['coding', 'verbal', 'voice', 'mixed'];

const toCount = (value, fallback) => Math.min(Math.max(parseInt(value, 10) || fallback, 1), MAX_COUNT);
const toList = (value) => (Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []);

async function linkToSimulation(simulationId, questionId, isAdaptive) {
  if (!simulationId) return;
  const max = await db.get('SELECT COALESCE(MAX(position), -1) AS max_position FROM simulation_questions WHERE simulation_id = ?', [simulationId]);
  await db.run(
    'INSERT OR IGNORE INTO simulation_questions (simulation_id, question_id, position, is_adaptive) VALUES (?, ?, ?, ?)',
    [simulationId, questionId, (max?.max_position ?? -1) + 1, isAdaptive ? 1 : 0]
  );
}

/**
 * Simülasyonu başlatır.
 *  - type "coding": { count, language, level, courses }
 *  - type "verbal" | "voice": { count, level, courses }
 *  - type "mixed" : { codingCount, verbalCount, language, level, codingCourses, verbalCourses }
 * Dönüş: { simulationId, questions } — kod soruları önce, sözel sorular sonra gelir.
 */
router.post('/start', async (req, res) => {
  try {
    const { type, language = 'python', level = null } = req.body;
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Geçersiz simülasyon türü' });

    const jobs = [];
    if (type === 'coding' || type === 'mixed') {
      jobs.push({
        type: 'coding',
        count: toCount(type === 'mixed' ? req.body.codingCount : req.body.count, 5),
        subjects: toList(type === 'mixed' ? req.body.codingCourses : req.body.courses),
        language
      });
    }
    if (type === 'verbal' || type === 'voice' || type === 'mixed') {
      jobs.push({
        type: 'verbal',
        count: toCount(type === 'mixed' ? req.body.verbalCount : req.body.count, 5),
        subjects: toList(type === 'mixed' ? req.body.verbalCourses : req.body.courses)
      });
    }

    // Kod ve sözel soru üretimi birbirinden bağımsızdır; paralel çalışır.
    const groups = await Promise.all(jobs.map((job) => ensureQuestions({ userId: req.userId, level, ...job })));
    const questions = groups.flat();

    const simulationId = randomUUID();
    for (let i = 0; i < questions.length; i++) {
      await db.run(
        'INSERT INTO simulation_questions (simulation_id, question_id, position, is_adaptive) VALUES (?, ?, ?, 0)',
        [simulationId, questions[i].id, i]
      );
    }

    res.json({ simulationId, questions });
  } catch (error) {
    console.error('Simülasyon başlatma hatası:', error.message);
    res.status(error.status || 500).json({ error: error.message || 'Sorular oluşturulamadı' });
  }
});

// Kod soruları için deneme kaydı (yanlışsa isteğe bağlı olarak benzer soru üretir).
router.post('/:questionId/attempt', async (req, res) => {
  try {
    const { questionId } = req.params;
    const { simulationId, status, answer = '', feedback = null, generateAdaptive = false } = req.body;
    if (!['correct', 'incorrect', 'partial'].includes(status)) {
      return res.status(400).json({ error: 'Geçersiz soru durumu' });
    }
    const score = Math.min(Math.max(Number(req.body.score) || 0, 0), 10);

    const question = await db.get('SELECT id FROM questions WHERE id = ?', [questionId]);
    if (!question) return res.status(404).json({ error: 'Soru bulunamadı' });

    const attempt = await recordAttempt({ userId: req.userId, questionId, simulationId, status, score, answer, feedback });

    let nextQuestion = null;
    if (status === 'incorrect' && generateAdaptive) {
      try {
        nextQuestion = await generateAdaptiveQuestion({ userId: req.userId, questionId });
        if (nextQuestion) await linkToSimulation(simulationId, nextQuestion.id, true);
      } catch (generationError) {
        console.error('Benzer soru üretme hatası:', generationError.message);
      }
    }

    res.json({ attempt, nextQuestion });
  } catch (error) {
    console.error('Attempt error:', error);
    res.status(500).json({ error: error.message || 'Cevap kaydedilemedi' });
  }
});

/**
 * Sözel cevabı değerlendirir ve denemeyi kaydeder.
 * Yanıtta ideal cevap (correctAnswer) da döner; istemci yanlışsa bunu gösterir.
 */
router.post('/:questionId/verbal-answer', async (req, res) => {
  try {
    const { simulationId } = req.body;
    const answer = typeof req.body.answer === 'string' ? req.body.answer.trim() : '';
    if (!answer) return res.status(400).json({ error: 'Cevap boş olamaz' });
    if (answer.length > MAX_ANSWER_LENGTH) {
      return res.status(400).json({ error: `Cevap en fazla ${MAX_ANSWER_LENGTH} karakter olabilir` });
    }

    const row = await db.get('SELECT * FROM questions WHERE id = ?', [req.params.questionId]);
    if (!row) return res.status(404).json({ error: 'Soru bulunamadı' });
    if (row.type !== 'verbal') return res.status(400).json({ error: 'Bu soru sözel değil' });

    const evaluation = await evaluateVerbalAnswer(row, answer);
    const attempt = await recordAttempt({
      userId: req.userId,
      questionId: row.id,
      simulationId,
      status: evaluation.isCorrect ? 'correct' : 'incorrect',
      score: evaluation.score,
      answer,
      feedback: evaluation
    });

    res.json({ evaluation, attempt });
  } catch (error) {
    console.error('Sözel cevap hatası:', error.message);
    res.status(error.status || 500).json({ error: error.message || 'Cevap değerlendirilemedi' });
  }
});

// Bir sorunun benzerini üretir (aynı ders ve konu).
router.post('/:questionId/similar', async (req, res) => {
  try {
    const question = await generateAdaptiveQuestion({ userId: req.userId, questionId: req.params.questionId });
    if (!question) {
      return res.status(409).json({ error: 'Bu soru için maksimum benzer soru sayısına ulaşıldı', limitReached: true });
    }
    await linkToSimulation(req.body.simulationId, question.id, true);
    res.json(question);
  } catch (error) {
    console.error('Benzer soru hatası:', error.message);
    res.status(error.status || 500).json({ error: error.message || 'Benzer soru oluşturulamadı' });
  }
});

router.post('/simulations/finish', async (req, res) => {
  try {
    const { simulationId, type, questionCount, score, totalPoints, maxPoints } = req.body;
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Geçersiz simülasyon türü' });
    await db.run(`INSERT INTO simulation_results
                  (user_id, simulation_id, type, question_count, score, total_points, max_points)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.userId, simulationId, type, Number(questionCount) || 0, Number(score) || 0, Number(totalPoints) || 0, Number(maxPoints) || 0]);
    res.json({ success: true });
  } catch (error) {
    console.error('Simulation finish error:', error);
    res.status(500).json({ error: 'Simülasyon kaydedilemedi' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { status } = req.query;
    const rows = await db.all(`
      SELECT q.*, a.status, a.score, a.attempt_number, a.answer, a.feedback, a.created_at AS answered_at
      FROM question_attempts a
             JOIN questions q ON q.id = a.question_id
      WHERE a.user_id = ? ${status ? 'AND a.status = ?' : ''}
      ORDER BY a.created_at DESC`, status ? [req.userId, status] : [req.userId]);
    res.json(rows.map((row) => ({
      ...toPublicQuestion(row, { includeSolution: true }),
      status: row.status,
      score: row.score,
      attemptNumber: row.attempt_number,
      answer: row.answer,
      feedback: row.feedback ? JSON.parse(row.feedback) : null,
      answeredAt: row.answered_at
    })));
  } catch (error) {
    res.status(500).json({ error: 'Soru geçmişi alınamadı' });
  }
});

// Geçmişte doğru/yanlış cevaplanan soruları tekrar çözmek için listeler.
router.get('/redo/:status', async (req, res) => {
  try {
    if (!['correct', 'incorrect'].includes(req.params.status)) {
      return res.status(400).json({ error: 'Durum correct veya incorrect olmalı' });
    }
    const rows = await db.all(`
      SELECT q.*, MAX(a.created_at) AS last_attempt_at, MAX(a.score) AS best_score,
             SUM(CASE WHEN a.status = 'correct' THEN 1 ELSE 0 END) AS correct_attempts,
             COUNT(*) AS attempts
      FROM question_attempts a
             JOIN questions q ON q.id = a.question_id
      WHERE a.user_id = ? AND a.status = ?
      GROUP BY q.id
      ORDER BY last_attempt_at DESC`, [req.userId, req.params.status]);
    res.json(rows.map((row) => ({
      ...toPublicQuestion(row),
      lastAttemptAt: row.last_attempt_at,
      bestScore: row.best_score,
      correctAttempts: row.correct_attempts,
      attempts: row.attempts
    })));
  } catch (error) {
    res.status(500).json({ error: 'Tekrar soruları alınamadı' });
  }
});

module.exports = router;
