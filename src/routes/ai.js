const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { authenticateToken } = require('../middleware/auth');
const { analyzeCode, analyzeVerbalAnswer, generateAdaptiveQuestion, getHint, toPublicQuestion } = require('../services/ai');

router.use(authenticateToken);

router.post('/analyze-code', async (req, res) => {
  try {
    const { code, question, testResults } = req.body;
    res.json(await analyzeCode(code, question, testResults));
  } catch (error) {
    res.status(500).json({ error: 'Analiz yapılamadı' });
  }
});

router.post('/similar-question', async (req, res) => {
  try {
    const { questionId } = req.body;
    const question = await generateAdaptiveQuestion({ userId: req.userId, questionId });
    if (!question) return res.status(409).json({ error: 'Bu konu için maksimum adaptif soru sayısına ulaşıldı' });
    res.json(question);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Benzer soru oluşturulamadı' });
  }
});

router.post('/analyze-verbal', async (req, res) => {
  try {
    const { question, answer } = req.body;
    res.json(await analyzeVerbalAnswer(question, answer));
  } catch (error) {
    res.status(500).json({ error: 'Analiz yapılamadı' });
  }
});

// Progressive hint endpoint used by the code editor (3 levels)
router.post('/hint', async (req, res) => {
  try {
    const { questionId, currentCode, level = 1 } = req.body;
    const row = await db.get('SELECT * FROM questions WHERE id = ?', [questionId]);
    if (!row) return res.status(404).json({ error: 'Soru bulunamadı' });
    res.json(await getHint(toPublicQuestion(row), currentCode, level));
  } catch (error) {
    res.status(500).json({ error: 'İpucu alınamadı' });
  }
});

module.exports = router;
