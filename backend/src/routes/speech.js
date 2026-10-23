const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { transcribeAudio, synthesizeSpeech } = require('../services/speech');

const router = express.Router();
router.use(authenticateToken);

// Ses kaydı ham gövde olarak gelir (Content-Type: audio/webm, audio/mp4 ...). Üst sınır ~10 MB (birkaç dakika).
const rawAudio = express.raw({ type: ['audio/*', 'video/webm', 'video/mp4', 'application/octet-stream'], limit: '10mb' });

// POST /api/speech/transcribe?hint=<soru konusu>  -> { text }
router.post('/transcribe', rawAudio, async (req, res) => {
  try {
    const buffer = Buffer.isBuffer(req.body) ? req.body : null;
    const hint = typeof req.query.hint === 'string' ? req.query.hint.slice(0, 200) : '';
    const text = await transcribeAudio(buffer, req.headers['content-type'], hint);
    res.json({ text });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Ses işlenemedi' });
  }
});

// POST /api/speech/speak { text } -> audio/mpeg
router.post('/speak', async (req, res) => {
  try {
    const audio = await synthesizeSpeech(req.body?.text);
    res.set({ 'Content-Type': 'audio/mpeg', 'Content-Length': audio.length, 'Cache-Control': 'private, max-age=3600' });
    res.send(audio);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Konuşma üretilemedi' });
  }
});

module.exports = router;
