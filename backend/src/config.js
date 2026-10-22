const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const isProd = process.env.NODE_ENV === 'production';

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (isProd) throw new Error('JWT_SECRET tanımlı olmalı (production).');
  jwtSecret = 'dev-only-insecure-secret';
  if (process.env.NODE_ENV !== 'test') {
    console.warn('⚠️  JWT_SECRET tanımlı değil, geliştirme için güvensiz varsayılan kullanılıyor.');
  }
}

module.exports = {
  PORT: process.env.PORT || 3001,
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: '7d',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  // Virgülle ayrılmış ek origin'ler (ör. web sitesi adresi). Mobil uygulama origin'leri otomatik eklenir.
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 300
};
