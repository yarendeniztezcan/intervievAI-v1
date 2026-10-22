const request = require('supertest');
const app = require('../src/index');

describe('API Tests', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('OK');
    });
  });

  describe('GET /api/questions/coding', () => {
    it('should return coding questions', async () => {
      const res = await request(app).get('/api/questions/coding?language=python&count=5');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/questions/verbal', () => {
    it('should return verbal questions', async () => {
      const res = await request(app).get('/api/questions/verbal?count=5');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});