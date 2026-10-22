// OpenAI taklit edilerek sözel simülasyonun tüm akışı doğrulanır:
// başlat -> yanlış cevap (doğru cevap gösterilir) -> benzer soru -> doğru cevap.
const mockCreate = jest.fn();
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({ chat: { completions: { create: (...args) => mockCreate(...args) } } }))
}));

process.env.OPENAI_API_KEY = 'test-key';

const request = require('supertest');
const app = require('../src/index');
const db = require('../src/models/database');
const { listSubjects } = require('../src/data/subjects');

let generated = 0;
const reply = (obj) => ({ choices: [{ message: { content: JSON.stringify(obj) } }] });

beforeEach(() => {
  generated = 0;
  mockCreate.mockReset();
  mockCreate.mockImplementation(async ({ messages }) => {
    const prompt = messages[messages.length - 1].content;
    if (prompt.includes('Adayın cevabı')) {
      const candidate = (prompt.match(/<<<\n([\s\S]*?)\n>>>/) || [])[1] || '';
      const good = /ANAHTAR/.test(candidate);
      return reply({ score: good ? 9 : 2, feedback: good ? 'Doğru.' : 'Eksik.', strengths: good ? ['Net'] : [], improvements: good ? [] : ['Kullanım alanlarını ekleyin'] });
    }
    generated += 1;
    const isCoding = prompt.includes('kodlama TEKNİK');
    if (isCoding) {
      return reply({ question: { title: `Kod ${generated}`, description: 'Açıklama', starterCode: 'print(1)', testCases: [{ input: '1', expected: '1' }], solution: 'print(1)', hints: ['a'] } });
    }
    return reply({ question: { title: `Soru ${generated}`, subtopic: 'x', question: `Flip-flop sorusu ${generated}?`, expectedAnswer: ['1) Durum saklar', '2) Sayaçlarda kullanılır'], hints: ['ipucu'] } });
  });
});

afterAll(() => db.close());

describe('Sözel simülasyon akışı', () => {
  let auth;

  beforeAll(async () => {
    const res = await request(app).post('/api/users/register').send({ username: 'akis', email: 'akis@example.com', password: 'sifre123' });
    auth = { Authorization: `Bearer ${res.body.token}` };
  });

  it('seçilen derse ait, ideal cevabı gizlenmiş sorular üretir', async () => {
    const res = await request(app).post('/api/questions/start').set(auth).send({ type: 'verbal', count: 3, courses: ['logic'], level: 'junior' });
    expect(res.statusCode).toBe(200);
    expect(res.body.questions).toHaveLength(3);

    const logicTopics = listSubjects().verbal.find((s) => s.id === 'logic').topics;
    for (const q of res.body.questions) {
      expect(q.type).toBe('verbal');
      expect(q.subject).toBe('logic');
      expect(q.subjectName).toBe('Mantıksal Devre Tasarımı');
      expect(logicTopics).toContain(q.topic);
      expect(q.solution).toBeUndefined(); // cevap öncesi sızmamalı
    }
    // üretim prompt'u ders ve konuyu içermeli
    const prompts = mockCreate.mock.calls.map((c) => c[0].messages[1].content).join('\n');
    expect(prompts).toContain('Ders: Mantıksal Devre Tasarımı');
  });

  it('birden fazla ders seçilince sorular derslere dağıtılır', async () => {
    const res = await request(app).post('/api/questions/start').set(auth).send({ type: 'verbal', count: 4, courses: ['os', 'architecture'] });
    expect(res.statusCode).toBe(200);
    const subjects = res.body.questions.map((q) => q.subject);
    expect(subjects.filter((s) => s === 'os')).toHaveLength(2);
    expect(subjects.filter((s) => s === 'architecture')).toHaveLength(2);
  });

  it('yanlış cevapta doğru cevap gösterilir ve benzer soru üretilir; doğru cevap kabul edilir', async () => {
    const start = await request(app).post('/api/questions/start').set(auth).send({ type: 'verbal', count: 1, courses: ['logic'] });
    const { simulationId } = start.body;
    const q = start.body.questions[0];

    const wrong = await request(app).post(`/api/questions/${q.id}/verbal-answer`).set(auth).send({ answer: 'bilmiyorum', simulationId });
    expect(wrong.statusCode).toBe(200);
    expect(wrong.body.evaluation.isCorrect).toBe(false);
    expect(wrong.body.evaluation.correctAnswer).toContain('Durum saklar');
    expect(wrong.body.evaluation.improvements.length).toBeGreaterThan(0);

    const similar = await request(app).post(`/api/questions/${q.id}/similar`).set(auth).send({ simulationId });
    expect(similar.statusCode).toBe(200);
    expect(similar.body.id).not.toBe(q.id);
    expect(similar.body.subject).toBe('logic');
    expect(similar.body.topic).toBe(q.topic);
    expect(similar.body.parentQuestionId).toBe(q.id);
    expect(similar.body.solution).toBeUndefined();

    const right = await request(app).post(`/api/questions/${similar.body.id}/verbal-answer`).set(auth).send({ answer: 'ANAHTAR: durum saklar, sayaçlarda kullanılır', simulationId });
    expect(right.body.evaluation.isCorrect).toBe(true);
    expect(right.body.evaluation.score).toBe(9);
  });

  it('boş veya çok uzun cevap reddedilir; AI hatasında deneme kaydedilmez', async () => {
    const start = await request(app).post('/api/questions/start').set(auth).send({ type: 'verbal', count: 1, courses: ['os'] });
    const q = start.body.questions[0];
    const url = `/api/questions/${q.id}/verbal-answer`;

    expect((await request(app).post(url).set(auth).send({ answer: '   ' })).statusCode).toBe(400);
    expect((await request(app).post(url).set(auth).send({ answer: 'x'.repeat(5001) })).statusCode).toBe(400);

    mockCreate.mockRejectedValueOnce(new Error('ağ hatası'));
    const failed = await request(app).post(url).set(auth).send({ answer: 'bir cevap' });
    expect(failed.statusCode).toBe(502);
    const rows = await db.all('SELECT * FROM question_attempts WHERE question_id = ?', [q.id]);
    expect(rows).toHaveLength(0);
  });

  it('karma simülasyon kod ve sözel soruları ayrı sayılarla döndürür', async () => {
    const res = await request(app).post('/api/questions/start').set(auth).send({
      type: 'mixed', codingCount: 2, verbalCount: 3, language: 'python',
      codingCourses: ['algorithms'], verbalCourses: ['logic']
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.questions.filter((q) => q.type === 'coding')).toHaveLength(2);
    expect(res.body.questions.filter((q) => q.type === 'verbal')).toHaveLength(3);
    // kod soruları sözellerden önce gelir
    const types = res.body.questions.map((q) => q.type);
    expect(types.indexOf('verbal')).toBeGreaterThan(types.lastIndexOf('coding'));
  });
});
