const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PORT, FRONTEND_URL, RATE_LIMIT_MAX } = require('./config');

const userRoutes = require('./routes/users');
const subjectRoutes = require('./routes/subjects');
const questionRoutes = require('./routes/questions');
const executeRoutes = require('./routes/execute');
const aiRoutes = require('./routes/ai');

const errorHandler = require('./middleware/errorHandler');
const logger = require('./middleware/logger');

const app = express();

// Güvenlik middleware'leri
app.use(helmet());
app.use(cors({ origin: FRONTEND_URL, credentials: true }));

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
