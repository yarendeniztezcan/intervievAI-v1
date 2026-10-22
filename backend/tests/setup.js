// Her test dosyası kendi geçici veritabanını ve test ortam değişkenlerini kullanır.
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DB_PATH = path.join(os.tmpdir(), `interviewai-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
delete process.env.OPENAI_API_KEY;
