const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Erişim tokeni gerekli' });

  try {
    req.userId = jwt.verify(token, JWT_SECRET).userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token' });
  }
}

module.exports = { authenticateToken };
