const { OpenAI } = require('openai');
const db = require('../models/database');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const MAX_GENERATION_ATTEMPTS = 6;
const MAX_ADAPTIVE_ATTEMPTS = 5;

// Interview levels selected in the UI -> question difficulty stored in DB
const LEVEL_TO_DIFFICULTY = { junior: 'easy', mid: 'medium', senior: 'hard' };

function safeJsonParse(content) {
  try { return JSON.parse(content); } catch (_) {
    const match = String(content || '').match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI JSON yanıtı okunamadı');
    return JSON.parse(match[0]);
  }
}

function normalizeQuestion(q) {
  return {
    id: q.id || uuidv4(),
    type: q.type,
    subject: q.subject,
    topic: q.topic || q.subject,
    subtopic: q.subtopic || null,
    difficulty: q.difficulty || 'medium',
    language: q.language || null,
    title: q.title,
    description: q.description || null,
    question: q.question || null,
    starterCode: q.starterCode || null,
    testCases: Array.isArray(q.testCases) ? q.testCases : [],
    examples: Array.isArray(q.examples) ? q.examples : [],
    solution: q.solution || null,
    hints: Array.isArray(q.hints) ? q.hints : []
  };
}

function questionHash(q) {
  const canonical = JSON.stringify({
    type: q.type,
    subject: q.subject,
    topic: q.topic,
    subtopic: q.subtopic,
    difficulty: q.difficulty,
    language: q.language,
    title: q.title,
    description: q.description,
    question: q.question,
    starterCode: q.starterCode,
    testCases: q.testCases,
    examples: q.examples
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function toPublicQuestion(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    subject: row.subject,
    category: row.subject,
    topic: row.topic,
    subtopic: row.subtopic,
    difficulty: row.difficulty,
    language: row.language,
    title: row.title,
    description: row.description,
    question: row.question,
    starterCode: row.starter_code,
    testCases: JSON.parse(row.test_cases || '[]'),
    examples: JSON.parse(row.examples || '[]'),
    solution: row.solution,
    hints: JSON.parse(row.hints || '[]')
  };
}

async function callAI(prompt) {
  if (!openai) throw new Error('OPENAI_API_KEY tanımlı değil');
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: 'Sen kıdemli bir yazılım mühendisi ve mülakat hazırlık uzmanısın. Gerçek iş görüşmelerinde sorulan teknik mülakat soruları üretir ve değerlendirirsin. Yalnızca istenen JSON nesnesini döndür.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.85,
    response_format: { type: 'json_object' }
  });
  return safeJsonParse(response.choices[0].message.content);
}

function buildInterviewCodingRules(language) {
  return `
- Bu soru GERÇEK bir yazılım mülakatından alınmış gibi olmalı; üniversite vize/final sorusu DEĞİL.
- LeetCode / HackerRank / gerçek iş görüşmesi tarzında, gerçek hayat senaryosu kullan.
  Örnek senaryolar: e-ticaret sepeti, log analizi, kullanıcı oturum yönetimi, API verisi işleme,
  dosya indeksleme, bildirim kuyruğu, fiyat takibi, metin arama motoru, yetki kontrolü.
- Soruda net girdi-çıktı sözleşmesi, kenar durumları (edge case) ve mümkünse kısıtlar (constraints) belirtilmeli.
- Soru metni Türkçe olmalı ama değişken/fonksiyon isimleri İngilizce olmalı.
- Kod çalıştırıcı stdin üzerinden input verir. Starter code stdin'dan okuyup sonucu stdout'a yazmalıdır.
- Her test case input ve expected alanına sahip olmalı; en az 2 test case üret.
- solution alanı, starter code için çalıştırılabilir TAM çözümdür ve kısa bir zaman/uzay karmaşıklığı
  açıklaması içerir (örnek: "# Zaman: O(n), Bellek: O(1)").
- hints alanında 2-3 aşamalı ipucu ver (genel yön -> yaklaşım -> neredeyse çözüm).
- Dil: ${language || 'python'}.`;
}

function buildInterviewVerbalRules() {
  return `
- Bu soru GERÇEK bir teknik mülakatta sorulacak tarzda olmalı; tanım ezberleten sınav sorusu DEĞİL.
- "Neden böyle?", "Trade-off nedir?", "X ile Y arasında nasıl seçersiniz?", "Ölçek büyürse ne olur?",
  "Bu senaryoda hangi veri yapısını kullanırsınız ve neden?" tarzında davranışsal/derinlik soruları sor.
- Soru Türkçe olmalı.
- expectedAnswer alanında mülakatta verilecek İDEAL yanıtın 4-6 ana maddesini yaz; yanlış bilinen
  yaygın kavram yanılgılarını da not et.
- hints alanında 2-3 ipucu ver (hangi kavramlara değinmek beklendiği).`;
}

async function generateQuestion({ type, subject, topic, language, difficulty = 'medium', level = null, parentQuestion = null, excludeHashes = [] }) {
  const resolvedDifficulty = LEVEL_TO_DIFFICULTY[level] || difficulty;
  const existingRows = await db.all(`SELECT title, description, question, starter_code FROM questions WHERE type = ? AND subject = ? ORDER BY created_at DESC LIMIT 40`, [type, subject]);
  const existingExamples = existingRows.map(r => ({ title: r.title, description: r.description, question: r.question, starterCode: r.starter_code })).filter(Boolean);
  const exclude = excludeHashes.length ? excludeHashes.join(',') : 'none';
  const context = parentQuestion ? `
ÖNCEKİ SORU (sadece kavramı anlamak için; kopyalama):
${JSON.stringify(parentQuestion)}
Bu soru yanlış cevaplandı. Aynı konu/kavramı ölçen fakat farklı senaryo, veri, wording ve çözüm yolu içeren yeni bir soru üret.
` : '';

  const specificRules = type === 'coding' ? buildInterviewCodingRules(language) : buildInterviewVerbalRules();

  const prompt = `
Yeni bir ${type === 'coding' ? 'kodlama' : 'sözel'} TEKNİK MÜLAKAT sorusu üret.
Ders: ${subject}
Konu: ${topic || subject}
Zorluk / Seviye: ${resolvedDifficulty}
${specificRules}
${context}
Daha önce kullanılan soru hashleri: ${exclude}
Son kullanılan sorulardan örnekler (bunların hiçbirini tekrar etme): ${JSON.stringify(existingExamples)}
Aynı soruyu veya yalnızca kelimeleri değiştirilmiş eşdeğerini üretme. Farklı senaryo, veri seti ve çözüm yaklaşımı kullan.

JSON:
{
  "question": {
    "type": "${type}",
    "subject": "${subject}",
    "topic": "${topic || subject}",
    "subtopic": "...",
    "difficulty": "easy|medium|hard",
    "language": ${type === 'coding' ? `"${language || 'python'}"` : 'null'},
    "title": "Kısa ve mülakat tarzı başlık (örn: 'E-ticaret Sepetinde En İndirimli Kombinasyonu Bulma')",
    "description": "...",
    "question": "${type === 'verbal' ? '...' : ''}",
    "starterCode": ${type === 'coding' ? '"..."' : 'null'},
    "testCases": ${type === 'coding' ? '[{"input":"...","expected":"..."},{"input":"...","expected":"..."}]' : '[]'},
    "examples": [],
    "solution": "...",
    "expectedAnswer": "${type === 'verbal' ? '...' : ''}",
    "hints": ["...", "..."]
  }
}`;

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const data = await callAI(prompt + `\nÜretim denemesi: ${attempt + 1}.`);
    const q = normalizeQuestion({ ...data.question, type, subject, topic: data.question?.topic || topic || subject, language, difficulty: resolvedDifficulty });
    if (type === 'verbal' && data.question?.expectedAnswer) q.solution = data.question.expectedAnswer;
    const hash = questionHash(q);
    const existing = await db.get('SELECT id FROM questions WHERE question_hash = ?', [hash]);
    if (!existing) {
      return { ...q, hash };
    }
  }
  throw new Error('AI benzersiz bir soru üretemedi');
}

async function persistQuestion(q, { parentQuestionId = null, generationSource = 'ai' } = {}) {
  const hash = q.hash || questionHash(q);
  const id = q.id || uuidv4();
  try {
    await db.run(`INSERT INTO questions
      (id, question_hash, type, subject, topic, subtopic, difficulty, language, title, description, question,
       starter_code, test_cases, examples, solution, hints, parent_question_id, generation_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, hash, q.type, q.subject, q.topic, q.subtopic, q.difficulty, q.language, q.title, q.description,
      q.question, q.starterCode, JSON.stringify(q.testCases || []), JSON.stringify(q.examples || []),
      q.solution, JSON.stringify(q.hints || []), parentQuestionId, generationSource
    ]);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      const existing = await db.get('SELECT * FROM questions WHERE question_hash = ?', [hash]);
      if (existing) return existing;
    }
    throw error;
  }
  return await db.get('SELECT * FROM questions WHERE id = ?', [id]);
}

async function ensureQuestionsForSimulation({ userId, type, count, language, level = null, courses = [], codingCourses = [], verbalCourses = [] }) {
  const requirements = [];
  if (type === 'coding') requirements.push(...courses.map(subject => ({ type, subject, language })));
  if (type === 'verbal') requirements.push(...courses.map(subject => ({ type, subject })));
  if (type === 'mixed') {
    requirements.push(...codingCourses.map(subject => ({ type: 'coding', subject, language })));
    requirements.push(...verbalCourses.map(subject => ({ type: 'verbal', subject })));
  }

  if (!requirements.length) throw new Error('En az bir ders seçilmelidir');

  const difficulty = LEVEL_TO_DIFFICULTY[level] || null;
  const perSubject = Math.ceil(count / requirements.length);
  const selected = [];

  for (const req of requirements) {
    // Prefer unused AI questions matching the selected interview level
    const existing = await db.all(`
      SELECT q.* FROM questions q
      WHERE q.type = ? AND q.subject = ? AND (? IS NULL OR q.language = ? OR q.type = 'verbal')
      AND q.generation_source = 'ai'
      AND (? IS NULL OR q.difficulty = ?)
      AND q.id NOT IN (SELECT question_id FROM question_attempts WHERE user_id = ?)
      ORDER BY RANDOM() LIMIT ?`, [req.type, req.subject, req.language || null, req.language || null, difficulty, difficulty, userId, perSubject]);
    selected.push(...existing);

    const needed = perSubject - existing.length;
    for (let i = 0; i < needed; i++) {
      const excludeRows = await db.all('SELECT question_hash FROM questions WHERE type = ? AND subject = ?', [req.type, req.subject]);
      const q = await generateQuestion({
        type: req.type,
        subject: req.subject,
        topic: req.subject,
        language: req.language,
        difficulty: difficulty || 'medium',
        level,
        excludeHashes: excludeRows.map(r => r.question_hash)
      });
      const saved = await persistQuestion(q);
      selected.push(saved);
    }
  }

  const unique = [];
  const seen = new Set();
  for (const q of selected) {
    if (!seen.has(q.id)) { seen.add(q.id); unique.push(q); }
  }

  if (unique.length < count) {
    const req = requirements[unique.length % requirements.length];
    while (unique.length < count) {
      const excludeRows = await db.all('SELECT question_hash FROM questions WHERE type = ? AND subject = ?', [req.type, req.subject]);
      const q = await generateQuestion({
        type: req.type, subject: req.subject, topic: req.subject, language: req.language,
        difficulty: difficulty || 'medium', level,
        excludeHashes: excludeRows.map(r => r.question_hash)
      });
      const saved = await persistQuestion(q);
      if (!unique.some(x => x.id === saved.id)) unique.push(saved);
    }
  }

  return unique.slice(0, count).map(toPublicQuestion);
}

async function generateAdaptiveQuestion({ userId, questionId, maxAdaptive = MAX_ADAPTIVE_ATTEMPTS }) {
  const parent = await db.get('SELECT * FROM questions WHERE id = ?', [questionId]);
  if (!parent) throw new Error('Soru bulunamadı');

  const adaptiveCount = await db.get(`SELECT COUNT(*) AS count FROM question_attempts a
    JOIN questions q ON q.id = a.question_id
    WHERE a.user_id = ? AND (q.parent_question_id = ? OR q.id = ?)`, [userId, questionId, questionId]);

  if ((adaptiveCount?.count || 0) >= maxAdaptive) return null;

  const excludeRows = await db.all('SELECT question_hash FROM questions WHERE subject = ? AND type = ?', [parent.subject, parent.type]);
  const q = await generateQuestion({
    type: parent.type,
    subject: parent.subject,
    topic: parent.topic,
    language: parent.language,
    difficulty: parent.difficulty,
    parentQuestion: toPublicQuestion(parent),
    excludeHashes: excludeRows.map(r => r.question_hash)
  });
  const saved = await persistQuestion(q, { parentQuestionId: parent.id });
  return toPublicQuestion(saved);
}

async function recordAttempt({ userId, questionId, simulationId, status, score = 0, answer = '', feedback = null }) {
  const previous = await db.get('SELECT COUNT(*) AS count FROM question_attempts WHERE user_id = ? AND question_id = ?', [userId, questionId]);
  const attemptNumber = (previous?.count || 0) + 1;
  await db.run(`INSERT INTO question_attempts
    (user_id, question_id, simulation_id, status, score, answer, feedback, attempt_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [userId, questionId, simulationId || null, status, score, answer, feedback ? JSON.stringify(feedback) : null, attemptNumber]);

  const q = await db.get('SELECT subject, topic FROM questions WHERE id = ?', [questionId]);
  if (q) {
    await db.run(`INSERT INTO user_topic_progress
      (user_id, subject, topic, attempts, correct_attempts, incorrect_attempts, last_status, last_attempt_at)
      VALUES (?, ?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, subject, topic) DO UPDATE SET
        attempts = attempts + 1,
        correct_attempts = correct_attempts + excluded.correct_attempts,
        incorrect_attempts = incorrect_attempts + excluded.incorrect_attempts,
        last_status = excluded.last_status,
        last_attempt_at = CURRENT_TIMESTAMP`, [userId, q.subject, q.topic, status === 'correct' ? 1 : 0, status === 'incorrect' ? 1 : 0, status]);
  }

  return { attemptNumber };
}

async function analyzeCode(code, question, testResults) {
  if (!openai) return { isCorrect: testResults?.success || false, hints: ['Kodunuzu kontrol edin'], errorAnalysis: 'AI anahtarı tanımlı değil' };
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'Kıdemli bir mülakatçi gibi kod değerlendiriyorsun. Yalnızca JSON döndür.' },
        { role: 'user', content: `Soru: ${question.title}\nAçıklama: ${question.description}\nKod: ${code}\nTest sonuçları: ${JSON.stringify(testResults)}\nJSON: {"isCorrect":boolean,"errorAnalysis":"...","hints":["..."],"optimization":"..."}` }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });
    return safeJsonParse(response.choices[0].message.content);
  } catch (_) {
    return { isCorrect: testResults?.success || false, hints: ['Kodunuzu kontrol edin'], errorAnalysis: 'AI analizi yapılamadı' };
  }
}

async function analyzeVerbalAnswer(question, answer) {
  if (!openai) return { score: 0, isCorrect: false, feedback: 'OPENAI_API_KEY tanımlı değil.', strengths: [], improvements: ['AI anahtarını tanımlayın'] };
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'Kıdemli bir teknik mülakatçı gibi yanıt değerlendiriyorsun. Yalnızca JSON döndür.' },
        { role: 'user', content: `Soru: ${question.question}\nMülakatta beklenen ideal yanıtın ana noktaları: ${question.solution || ''}\nAdayın yanıtı: ${answer}\n10 üzerinden değerlendir. Teknik doğruluk, derinlik ve trade-off farkındalığına göre puanla. JSON: {"score":0,"isCorrect":false,"feedback":"...","strengths":["..."],"improvements":["..."]}` }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });
    const result = safeJsonParse(response.choices[0].message.content);
    result.isCorrect = typeof result.isCorrect === 'boolean' ? result.isCorrect : Number(result.score) >= 7;
    return result;
  } catch (_) {
    return { score: 0, isCorrect: false, feedback: 'AI değerlendirmesi yapılamadı.', strengths: [], improvements: [] };
  }
}

async function getHint(question, currentCode, level = 1) {
  if (!openai) return { hint: 'AI anahtarı tanımlı değil. Çözüm butonunu kullanabilirsiniz.' };
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'Kod eğitmeni olarak kısa ve aşamalı ipucu veriyorsun. Yalnızca JSON döndür.' },
        {
          role: 'user',
          content: `Soru: ${question.title}\nAçıklama: ${question.description || ''}\nİpucu seviyesi: ${level}/3 (1=genel yön, 2=çözüm yaklaşımı, 3=neredeyse tam çözüm)\nÖğrencinin mevcut kodu:\n${currentCode || '(henüz kod yazılmadı)'}\nJSON: {"hint":"..."}`
        }
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' }
    });
    return safeJsonParse(response.choices[0].message.content);
  } catch (_) {
    return { hint: 'İpucu üretilemedi. Çözümü incelemeyi deneyin.' };
  }
}

module.exports = {
  analyzeCode,
  analyzeVerbalAnswer,
  getHint,
  generateQuestion,
  ensureQuestionsForSimulation,
  generateAdaptiveQuestion,
  recordAttempt,
  toPublicQuestion,
  persistQuestion,
  LEVEL_TO_DIFFICULTY
};
