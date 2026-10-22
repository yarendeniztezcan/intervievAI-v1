const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config');
const { getSubjectName } = require('../data/subjects');
const db = require('../models/database');

const sign = (userId) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

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

    const existingUser = await db.get('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
    if (existingUser) {
      return res.status(409).json({ error: 'Bu email veya kullanıcı adı zaten kayıtlı' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash]
    );

    res.status(201).json({
      message: 'Kayıt başarılı',
      token: sign(result.id),
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
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }

    await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    res.json({
      message: 'Giriş başarılı',
      token: sign(user.id),
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
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

    const stats = await db.get(`
      SELECT
        COUNT(DISTINCT simulation_id) AS total_simulations,
        SUM(question_count) AS total_questions,
        AVG(score) AS average_score,
        MAX(score) AS best_score
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
      SELECT type, question_count AS questionCount, ROUND(score) AS score, created_at AS date
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
        weakTopics: weakTopics.map((t) => getSubjectName(t.topic))
      },
      history
    });
  } catch (error) {
    console.error('Profil hatası:', error);
    res.status(500).json({ error: 'Profil bilgileri alınamadı' });
  }
});

module.exports = router;
