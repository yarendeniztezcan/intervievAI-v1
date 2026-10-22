const request = require('supertest');
const app = require('../src/index');
const db = require('../src/models/database');

afterAll(() => db.close());

describe('Genel', () => {
  it('GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('bilinmeyen endpoint 404 döner', async () => {
    const res = await request(app).get('/api/yok');
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/subjects', () => {
  it('sözel dersler arasında mantıksal devre, işletim sistemleri ve mimari/organizasyon bulunur', async () => {
    const res = await request(app).get('/api/subjects');
    expect(res.statusCode).toBe(200);
    const byId = Object.fromEntries(res.body.verbal.map((s) => [s.id, s]));

    expect(byId.logic.name).toBe('Mantıksal Devre Tasarımı');
    expect(byId.logic.topics.some((t) => /flip-flop/i.test(t))).toBe(true);
    expect(byId.os.name).toBe('İşletim Sistemleri');
    expect(byId.architecture.name).toBe('Bilgisayar Mimarisi ve Organizasyonu');
  });

  it('kod dersleri de listelenir', async () => {
    const res = await request(app).get('/api/subjects');
    expect(res.body.coding.map((s) => s.id)).toEqual(expect.arrayContaining(['oop', 'algorithms', 'programming']));
  });
});

describe('Kimlik doğrulama', () => {
  const user = { username: 'deneme', email: 'deneme@example.com', password: 'sifre123' };
  let token;

  it('kayıt olur', async () => {
    const res = await request(app).post('/api/users/register').send(user);
    expect(res.statusCode).toBe(201);
    expect(res.body.token).toBeTruthy();
    token = res.body.token;
  });

  it('aynı kullanıcı adı/email ile tekrar kayıt 409 döner', async () => {
    const res = await request(app).post('/api/users/register').send(user);
    expect(res.statusCode).toBe(409);
  });

  it('yanlış şifre 401 döner', async () => {
    const res = await request(app).post('/api/users/login').send({ email: user.email, password: 'yanlis' });
    expect(res.statusCode).toBe(401);
  });

  it('giriş yapar ve profil boş istatistikle döner', async () => {
    const login = await request(app).post('/api/users/login').send({ email: user.email, password: user.password });
    expect(login.statusCode).toBe(200);
    const res = await request(app).get('/api/users/profile').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.stats.totalSimulations).toBe(0);
    expect(res.body.history).toEqual([]);
  });

  it('token olmadan korumalı rotalar 401 döner', async () => {
    expect((await request(app).post('/api/questions/start').send({ type: 'verbal' })).statusCode).toBe(401);
    expect((await request(app).get('/api/users/profile')).statusCode).toBe(401);
  });

  it('AI anahtarı yokken simülasyon başlatma anlaşılır bir hata verir', async () => {
    const res = await request(app)
      .post('/api/questions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'verbal', count: 2, courses: ['logic'] });
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toMatch(/OPENAI_API_KEY/);
  });

  it('geçersiz tür ve geçersiz ders reddedilir', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    expect((await request(app).post('/api/questions/start').set(auth).send({ type: 'xyz' })).statusCode).toBe(400);
    const res = await request(app).post('/api/questions/start').set(auth).send({ type: 'verbal', count: 2, courses: ['olmayan-ders'] });
    expect(res.statusCode).toBe(400);
  });
});

describe('CORS (web + mobil uygulama)', () => {
  const request = require('supertest');
  const app = require('../src/index');

  it.each(['http://localhost:5173', 'http://localhost', 'https://localhost', 'capacitor://localhost'])(
    '%s origin\'ine izin verir',
    async (origin) => {
      const res = await request(app).get('/health').set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
    }
  );

  it('bilinmeyen origin\'e izin vermez', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
