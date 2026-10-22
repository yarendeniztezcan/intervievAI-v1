const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../database.sqlite');

class Database {
  constructor() {
    this.db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) console.error('Veritabanı bağlantı hatası:', err);
      else {
        console.log('✅ SQLite veritabanına bağlandı');
        this.initializeTables().catch(error => console.error('DB initialization error:', error));
      }
    });
  }

  async initializeTables() {
    await this.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )`);

    await this.run(`CREATE TABLE IF NOT EXISTS simulation_results (
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

    await this.run(`CREATE TABLE IF NOT EXISTS weak_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      topic TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    await this.run(`CREATE TABLE IF NOT EXISTS questions (
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

    await this.run(`CREATE TABLE IF NOT EXISTS question_attempts (
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

    await this.run(`CREATE TABLE IF NOT EXISTS user_topic_progress (
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

    await this.run(`CREATE TABLE IF NOT EXISTS simulation_questions (
      simulation_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      is_adaptive INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (simulation_id, question_id),
      FOREIGN KEY (question_id) REFERENCES questions(id)
    )`);

    await this.run('CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(subject, topic, type)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_attempts_user ON question_attempts(user_id, question_id)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_attempts_status ON question_attempts(user_id, status)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_simulation_questions ON simulation_questions(simulation_id, position)');

    await this.seedLegacyQuestions();
    console.log('✅ Veritabanı tabloları hazır');
  }

  async seedLegacyQuestions() {
    try {
      const { codingQuestions, verbalQuestions } = require('../data/questions');
      const all = [...codingQuestions, ...verbalQuestions];
      const crypto = require('crypto');
      for (const q of all) {
        const subject = q.category || 'general';
        const topic = q.topic || q.category || 'general';
        const canonical = JSON.stringify({
          type: q.type,
          subject,
          topic,
          title: q.title,
          description: q.description,
          question: q.question,
          starterCode: q.starterCode,
          testCases: q.testCases,
          expectedAnswer: q.expectedAnswer
        });
        const hash = crypto.createHash('sha256').update(canonical).digest('hex');
        await this.run(`INSERT OR IGNORE INTO questions
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

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
    });
  }
}

module.exports = new Database();
