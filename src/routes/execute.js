const express = require('express');
const router = express.Router();
const { executeCode } = require('../services/sandbox');
const { analyzeCode } = require('../services/ai');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.post('/', async (req, res) => {
  try {
    const { code, language, testCases, questionId } = req.body;
    if (!code || !language) return res.status(400).json({ error: 'Kod ve dil gerekli' });

    const result = await executeCode(code, language, testCases || []);
    const aiAnalysis = await analyzeCode(code, req.body.question || { id: questionId, title: 'Kod Sorusu', description: '' }, result);

    res.json({ ...result, aiAnalysis: { ...aiAnalysis, isCorrect: result.success } });
  } catch (error) {
    console.error('Çalıştırma hatası:', error);
    res.status(500).json({ error: 'Kod çalıştırılamadı: ' + error.message });
  }
});

module.exports = router;
