const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');
const db = require('../models/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '7d';

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Tüm alanlar gerekli' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
    }

    const existingUser = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(409).json({ error: 'Bu email zaten kayıtlı' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.run(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash]
    );

    const token = jwt.sign({ userId: result.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json({
      message: 'Kayıt başarılı',
      token,
      user: { id: result.id, username, email }
    });
  } catch (error) {
    console.error('Kayıt hatası:', error);
    res.status(500).json({ error: 'Kayıt yapılamadı' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email ve şifre gerekli' });
    }

    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }

    await db.run(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      message: 'Giriş başarılı',
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error('Giriş hatası:', error);
    res.status(500).json({ error: 'Giriş yapılamadı' });
  }
});

// Profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await db.get(
      'SELECT id, username, email, created_at FROM users WHERE id = ?',
      [req.userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    const stats = await db.get(`
      SELECT 
        COUNT(DISTINCT simulation_id) as total_simulations,
        SUM(question_count) as total_questions,
        AVG(score) as average_score,
        MAX(score) as best_score
      FROM simulation_results 
      WHERE user_id = ?
    `, [req.userId]);

    const weakTopics = await db.all(`
      SELECT topic
      FROM user_topic_progress
      WHERE user_id = ? AND incorrect_attempts > correct_attempts
      ORDER BY incorrect_attempts DESC
    `, [req.userId]);

    const history = await db.all(`
      SELECT type, question_count, score, created_at as date
      FROM simulation_results 
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `, [req.userId]);

    res.json({
      user,
      stats: {
        totalSimulations: stats?.total_simulations || 0,
        totalQuestions: stats?.total_questions || 0,
        averageScore: Math.round(stats?.average_score || 0),
        bestScore: Math.round(stats?.best_score || 0),
        weakTopics: weakTopics.map(t => t.topic)
      },
      history
    });
  } catch (error) {
    console.error('Profil hatası:', error);
    res.status(500).json({ error: 'Profil bilgileri alınamadı' });
  }
});

module.exports = router;
