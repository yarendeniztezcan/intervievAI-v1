const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PORT, FRONTEND_URL, CORS_ORIGINS, RATE_LIMIT_MAX } = require('./config');

const userRoutes = require('./routes/users');
const subjectRoutes = require('./routes/subjects');
const questionRoutes = require('./routes/questions');
const executeRoutes = require('./routes/execute');
const aiRoutes = require('./routes/ai');
const speechRoutes = require('./routes/speech');

const errorHandler = require('./middleware/errorHandler');
const logger = require('./middleware/logger');

const app = express();

// Güvenlik middleware'leri
app.use(helmet());

// İzinli origin'ler: web arayüzü + Capacitor mobil uygulaması (Android: http(s)://localhost, iOS: capacitor://localhost).
// Origin göndermeyen istekler (curl, sunucudan sunucuya) CORS'a tabi değildir.
const allowedOrigins = new Set([
  FRONTEND_URL,
  ...CORS_ORIGINS,
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost'
]);
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
  credentials: true
}));

if (process.env.NODE_ENV !== 'test') app.use(logger);

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: RATE_LIMIT_MAX,
  message: { error: 'Çok fazla istek gönderdiniz, lütfen bekleyin' }
}));

app.use(express.json({ limit: '1mb' }));

// Rotalar
app.use('/api/users', userRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/execute', executeRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/speech', speechRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), version: '2.1.0' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint bulunamadı' });
});

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server ${PORT} portunda çalışıyor`);
    console.log(`🔑 AI özellikleri: ${process.env.OPENAI_API_KEY ? 'Açık' : 'Kapalı (OPENAI_API_KEY tanımlı değil)'}`);
  });
}

module.exports = app;
