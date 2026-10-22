const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { codingQuestions, verbalQuestions } = require('../data/questions');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../database.sqlite');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

class Database {
  constructor() {
    // Tablolar hazır olmadan gelen sorgular `ready` promise'ini bekler.
    this.ready = new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, async (err) => {
        if (err) return reject(err);
        try {
          await this.initializeTables();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
    this.ready.then(
      () => process.env.NODE_ENV !== 'test' && console.log('✅ SQLite veritabanı hazır'),
      (error) => console.error('Veritabanı başlatılamadı:', error)
    );
  }

  async initializeTables() {
    const run = (sql) => this._run(sql);

    await run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )`);

    await run(`CREATE TABLE IF NOT EXISTS simulation_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      simulation_id TEXT,
      type TEXT,
      question_count INTEGER,
      score REAL,
      total_points INTEGER,
      max_points INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      question_hash TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      subject TEXT NOT NULL,
      topic TEXT NOT NULL,
      subtopic TEXT,
      difficulty TEXT DEFAULT 'medium',
      language TEXT,
      title TEXT NOT NULL,
      description TEXT,
      question TEXT,
      starter_code TEXT,
      test_cases TEXT,
      examples TEXT,
      solution TEXT,
      hints TEXT,
      parent_question_id TEXT,
      generation_source TEXT DEFAULT 'ai',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_question_id) REFERENCES questions(id)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS question_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question_id TEXT NOT NULL,
      simulation_id TEXT,
      status TEXT NOT NULL,
      score REAL DEFAULT 0,
      answer TEXT,
      feedback TEXT,
      attempt_number INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (question_id) REFERENCES questions(id)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS user_topic_progress (
      user_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      topic TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      correct_attempts INTEGER NOT NULL DEFAULT 0,
      incorrect_attempts INTEGER NOT NULL DEFAULT 0,
      last_status TEXT,
      last_attempt_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, subject, topic),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS simulation_questions (
      simulation_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      is_adaptive INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (simulation_id, question_id),
      FOREIGN KEY (question_id) REFERENCES questions(id)
    )`);

    await run('CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(subject, topic, type)');
    await run('CREATE INDEX IF NOT EXISTS idx_attempts_user ON question_attempts(user_id, question_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_attempts_status ON question_attempts(user_id, status)');
    await run('CREATE INDEX IF NOT EXISTS idx_simulation_questions ON simulation_questions(simulation_id, position)');

    await this.seedLegacyQuestions();
  }

  async seedLegacyQuestions() {
    try {
      for (const q of [...codingQuestions, ...verbalQuestions]) {
        const subject = q.category || 'general';
        const topic = q.topic || q.category || 'general';
        const hash = crypto.createHash('sha256').update(JSON.stringify({
          type: q.type, subject, topic, title: q.title, description: q.description,
          question: q.question, starterCode: q.starterCode, testCases: q.testCases, expectedAnswer: q.expectedAnswer
        })).digest('hex');
        await this._run(`INSERT OR IGNORE INTO questions
          (id, question_hash, type, subject, topic, difficulty, language, title, description, question,
           starter_code, test_cases, examples, solution, hints, generation_source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'legacy')`, [
          String(q.id), hash, q.type, subject, topic, q.difficulty || 'medium', q.language || null,
          q.title || topic, q.description || null, q.question || null, q.starterCode || null,
          JSON.stringify(q.testCases || []), JSON.stringify(q.examples || []), q.solution || q.expectedAnswer || null,
          JSON.stringify(q.hints || [])
        ]);
      }
    } catch (error) {
      console.error('Legacy soru seed hatası:', error.message);
    }
  }

  _run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  run(sql, params = []) {
    return this.ready.then(() => this._run(sql, params));
  }

  get(sql, params = []) {
    return this.ready.then(() => new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    }));
  }

  all(sql, params = []) {
    return this.ready.then(() => new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    }));
  }

  close() {
    return this.ready.catch(() => {}).then(() => new Promise((resolve) => this.db.close(() => resolve())));
  }
}

module.exports = new Database();
