const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../models/database');
const { authenticateToken } = require('../middleware/auth');
const {
  ensureQuestionsForSimulation,
  generateAdaptiveQuestion,
  recordAttempt,
  toPublicQuestion
} = require('../services/ai');

router.use(authenticateToken);

async function startSimulation(req, res) {
  try {
    const { type, count = 10, language = 'python', level = null, courses = [], codingCourses = [], verbalCourses = [] } = req.body;
    const numericCount = Math.min(Math.max(parseInt(count, 10) || 10, 1), 50);
    const questions = await ensureQuestionsForSimulation({
      userId: req.userId,
      type,
      count: numericCount,
      language,
      level,
      courses,
      codingCourses,
      verbalCourses
    });

    const simulationId = uuidv4();
    for (let i = 0; i < questions.length; i++) {
      await db.run('INSERT INTO simulation_questions (simulation_id, question_id, position, is_adaptive) VALUES (?, ?, ?, 0)', [simulationId, questions[i].id, i]);
    }

    res.json({ simulationId, questions });
  } catch (error) {
    console.error('Simülasyon başlatma hatası:', error);
    res.status(500).json({ error: error.message || 'Sorular oluşturulamadı' });
  }
}

router.post('/start', startSimulation);

// Backwards-compatible endpoints used by the existing frontend.
router.get('/coding', async (req, res) => {
  try {
    const questions = await ensureQuestionsForSimulation({
      userId: req.userId,
      type: 'coding',
      count: Math.min(parseInt(req.query.count, 10) || 10, 50),
      language: req.query.language || 'python',
      level: req.query.level || null,
      courses: req.query.courses ? req.query.courses.split(',').filter(Boolean) : []
    });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Sorular oluşturulamadı' });
  }
});

router.get('/verbal', async (req, res) => {
  try {
    const questions = await ensureQuestionsForSimulation({
      userId: req.userId,
      type: 'verbal',
      count: Math.min(parseInt(req.query.count, 10) || 10, 50),
      level: req.query.level || null,
      courses: req.query.courses ? req.query.courses.split(',').filter(Boolean) : []
    });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Sorular oluşturulamadı' });
  }
});

router.get('/mixed', async (req, res) => {
  try {
    const questions = await ensureQuestionsForSimulation({
      userId: req.userId,
      type: 'mixed',
      count: Math.min(parseInt(req.query.count, 10) || 10, 50),
      language: req.query.language || 'python',
      level: req.query.level || null,
      codingCourses: req.query.codingCourses ? req.query.codingCourses.split(',').filter(Boolean) : [],
      verbalCourses: req.query.verbalCourses ? req.query.verbalCourses.split(',').filter(Boolean) : []
    });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Sorular oluşturulamadı' });
  }
});

router.post('/:questionId/attempt', async (req, res) => {
  try {
    const { questionId } = req.params;
    const { simulationId, status, score = 0, answer = '', feedback = null, generateAdaptive = true } = req.body;
    if (!['correct', 'incorrect', 'partial'].includes(status)) {
      return res.status(400).json({ error: 'Geçersiz soru durumu' });
    }

    const question = await db.get('SELECT * FROM questions WHERE id = ?', [questionId]);
    if (!question) return res.status(404).json({ error: 'Soru bulunamadı' });

    const attempt = await recordAttempt({ userId: req.userId, questionId, simulationId, status, score, answer, feedback });
    let nextQuestion = null;

    if (status === 'incorrect' && generateAdaptive) {
      try {
        nextQuestion = await generateAdaptiveQuestion({ userId: req.userId, questionId });
        if (nextQuestion && simulationId) {
          const maxPosition = await db.get('SELECT COALESCE(MAX(position), -1) AS max_position FROM simulation_questions WHERE simulation_id = ?', [simulationId]);
          await db.run('INSERT OR IGNORE INTO simulation_questions (simulation_id, question_id, position, is_adaptive) VALUES (?, ?, ?, 1)', [simulationId, nextQuestion.id, (maxPosition?.max_position || -1) + 1]);
        }
      } catch (generationError) {
        console.error('Adaptive soru üretme hatası:', generationError.message);
      }
    }

    res.json({ attempt, nextQuestion });
  } catch (error) {
    console.error('Attempt error:', error);
    res.status(500).json({ error: error.message || 'Cevap kaydedilemedi' });
  }
});

router.post('/simulations/finish', async (req, res) => {
  try {
    const { simulationId, type, questionCount, score, totalPoints, maxPoints } = req.body;
    await db.run(`INSERT INTO simulation_results
                  (user_id, simulation_id, type, question_count, score, total_points, max_points)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`, [req.userId, simulationId, type, questionCount, score, totalPoints, maxPoints]);
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
    res.json(rows.map(row => ({ ...toPublicQuestion(row), status: row.status, score: row.score, attemptNumber: row.attempt_number, answer: row.answer, feedback: row.feedback ? JSON.parse(row.feedback) : null, answeredAt: row.answered_at })));
  } catch (error) {
    res.status(500).json({ error: 'Soru geçmişi alınamadı' });
  }
});

router.get('/redo/:status', async (req, res) => {
  try {
    if (!['correct', 'incorrect'].includes(req.params.status)) return res.status(400).json({ error: 'Durum correct veya incorrect olmalı' });
    const rows = await db.all(`
      SELECT q.*, MAX(a.created_at) AS last_attempt_at, MAX(a.score) AS best_score,
             SUM(CASE WHEN a.status = 'correct' THEN 1 ELSE 0 END) AS correct_attempts,
             COUNT(*) AS attempts
      FROM question_attempts a
             JOIN questions q ON q.id = a.question_id
      WHERE a.user_id = ? AND a.status = ?
      GROUP BY q.id
      ORDER BY last_attempt_at DESC`, [req.userId, req.params.status]);
    res.json(rows.map(row => ({ ...toPublicQuestion(row), lastAttemptAt: row.last_attempt_at, bestScore: row.best_score, correctAttempts: row.correct_attempts, attempts: row.attempts })));
  } catch (error) {
    res.status(500).json({ error: 'Tekrar soruları alınamadı' });
  }
});

module.exports = router;
