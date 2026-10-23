// Sözlü simülasyon: ses -> yazı, yazı -> ses ve 'voice' simülasyon türü (OpenAI taklit edilir).
const mockChat = jest.fn();
const mockTranscribe = jest.fn();
const mockSpeech = jest.fn();
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: (...a) => mockChat(...a) } },
    audio: { transcriptions: { create: (...a) => mockTranscribe(...a) }, speech: { create: (...a) => mockSpeech(...a) } }
  })),
  toFile: async (buffer, name, opts) => ({ name, type: opts?.type, size: buffer.length })
}));

process.env.OPENAI_API_KEY = 'test-key';

const request = require('supertest');
const app = require('../src/index');
const db = require('../src/models/database');

const reply = (obj) => ({ choices: [{ message: { content: JSON.stringify(obj) } }] });
const audio = (n = 4000) => Buffer.alloc(n, 1);
let auth;
let n = 0;

beforeAll(async () => {
  const res = await request(app).post('/api/users/register').send({ username: 'sesli', email: 'sesli@example.com', password: 'sifre123' });
  auth = { Authorization: `Bearer ${res.body.token}` };
});

beforeEach(() => {
  mockChat.mockReset();
  mockTranscribe.mockReset();
  mockSpeech.mockReset();
  mockChat.mockImplementation(async ({ messages }) => {
    const prompt = messages[messages.length - 1].content;
    if (prompt.includes('Adayın cevabı')) {
      const good = /ANAHTAR/.test((prompt.match(/<<<\n([\s\S]*?)\n>>>/) || [])[1] || '');
      return reply({ score: good ? 9 : 2, feedback: good ? 'Doğru.' : 'Eksik.', strengths: [], improvements: [] });
    }
    n += 1;
    return reply({ question: { title: `Soru ${n}`, subtopic: 'x', question: `Flip-flop sorusu ${n}?`, expectedAnswer: ['1) Durum saklar'], hints: [] } });
  });
});

afterAll(() => db.close());

describe('/api/speech', () => {
  it('giriş gerektirir', async () => {
    expect((await request(app).post('/api/speech/transcribe').set('Content-Type', 'audio/webm').send(audio())).statusCode).toBe(401);
    expect((await request(app).post('/api/speech/speak').send({ text: 'x' })).statusCode).toBe(401);
  });

  it('ses kaydını yazıya çevirir (Türkçe, uygun dosya türüyle, konu ipucuyla)', async () => {
    mockTranscribe.mockResolvedValue({ text: '  Flip-flop ANAHTAR bilgi saklar.  ' });
    const res = await request(app)
      .post('/api/speech/transcribe?hint=Flip-flop')
      .set(auth).set('Content-Type', 'audio/webm;codecs=opus').send(audio());
    expect(res.statusCode).toBe(200);
    expect(res.body.text).toBe('Flip-flop ANAHTAR bilgi saklar.');
    const args = mockTranscribe.mock.calls[0][0];
    expect(args.language).toBe('tr');
    expect(args.file.name).toBe('cevap.webm');
    expect(args.prompt).toContain('Flip-flop');
  });

  it('iOS/Safari kaydı (audio/mp4) için mp4 uzantısı kullanır', async () => {
    mockTranscribe.mockResolvedValue({ text: 'merhaba' });
    await request(app).post('/api/speech/transcribe').set(auth).set('Content-Type', 'audio/mp4').send(audio());
    expect(mockTranscribe.mock.calls[0][0].file.name).toBe('cevap.mp4');
  });

  it('çok kısa kaydı reddeder, anlaşılmayan sesi 422 yapar, servis hatasını 502 yapar', async () => {
    const short = await request(app).post('/api/speech/transcribe').set(auth).set('Content-Type', 'audio/webm').send(audio(10));
    expect(short.statusCode).toBe(400);

    mockTranscribe.mockResolvedValue({ text: '   ' });
    const empty = await request(app).post('/api/speech/transcribe').set(auth).set('Content-Type', 'audio/webm').send(audio());
    expect(empty.statusCode).toBe(422);

    mockTranscribe.mockRejectedValue(new Error('upstream'));
    const failed = await request(app).post('/api/speech/transcribe').set(auth).set('Content-Type', 'audio/webm').send(audio());
    expect(failed.statusCode).toBe(502);
  });

  it('metni mp3 olarak konuşturur', async () => {
    mockSpeech.mockResolvedValue({ arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer });
    const res = await request(app).post('/api/speech/speak').set(auth).send({ text: 'Birinci soru' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('audio/mpeg');
    expect(res.body.length).toBe(4);
    expect(mockSpeech.mock.calls[0][0].input).toBe('Birinci soru');

    expect((await request(app).post('/api/speech/speak').set(auth).send({ text: '  ' })).statusCode).toBe(400);
  });
});

describe('Sözlü simülasyon (voice)', () => {
  it('seçilen dersten sözel sorular üretir, bitişte voice olarak kaydeder, konuşulan cevap değerlendirilir', async () => {
    const start = await request(app).post('/api/questions/start').set(auth).send({ type: 'voice', count: 2, courses: ['logic'], level: 'mid' });
    expect(start.statusCode).toBe(200);
    expect(start.body.questions).toHaveLength(2);
    for (const q of start.body.questions) {
      expect(q.type).toBe('verbal');
      expect(q.subject).toBe('logic');
      expect(q.solution).toBeUndefined();
    }

    mockTranscribe.mockResolvedValue({ text: 'ANAHTAR kelimeli doğru cevap' });
    const t = await request(app).post('/api/speech/transcribe').set(auth).set('Content-Type', 'audio/webm').send(audio());
    const q = start.body.questions[0];
    const ev = await request(app).post(`/api/questions/${q.id}/verbal-answer`).set(auth)
      .send({ answer: t.body.text, simulationId: start.body.simulationId });
    expect(ev.body.evaluation.isCorrect).toBe(true);

    const fin = await request(app).post('/api/questions/simulations/finish').set(auth)
      .send({ simulationId: start.body.simulationId, type: 'voice', questionCount: 2, score: 45, totalPoints: 9, maxPoints: 20 });
    expect(fin.statusCode).toBe(200);
    const hist = await request(app).get('/api/users/profile').set(auth);
    expect(JSON.stringify(hist.body)).toContain('voice');
  });
});
