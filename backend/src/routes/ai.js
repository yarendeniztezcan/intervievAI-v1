const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { authenticateToken } = require('../middleware/auth');
const { getHint, toPublicQuestion } = require('../services/ai');

router.use(authenticateToken);

// Kod editörü için aşamalı ipucu (3 seviye)
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
