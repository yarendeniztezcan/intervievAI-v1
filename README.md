# InterviewAI - Mülakat Hazırlık Platformu

AI destekli kodlama ve sözel mülakat pratiği platformu.

## 🚀 Başlatma

```bash
docker-compose up --build
## AI Question Lifecycle

The simulation system now uses a persistent AI question bank:

1. Starting a simulation requests unused AI-generated questions for the selected subjects.
2. Every question is stored in SQLite with a SHA-256 uniqueness hash.
3. When a user answers, the attempt is stored independently from the question itself.
4. A wrong answer automatically triggers a new AI question for the same subject/topic.
5. Adaptive questions are linked to their parent question with `parent_question_id`.
6. The adaptive loop is limited to five follow-up questions for one base question.
7. Correct and incorrect attempts remain in history, so the same past question can be redone later.
8. Profile now provides **Doğru Soruları Tekrar Et** and **Yanlış Soruları Tekrar Et**.
9. Topic progress is stored in `user_topic_progress` and is used for weak-topic reporting.
10. The old hard-coded questions are migrated into SQLite as legacy records, but new simulations only select AI-generated records.

### Setup

Create `backend/.env` from `backend/.env.example` and provide:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
JWT_SECRET=replace-with-a-random-secret-at-least-32-characters-long
```

Then install dependencies separately in `backend` and `frontend` with `npm install`, and start both applications normally. SQLite tables are created/migrated automatically on backend startup.

Do not commit `backend/.env`, API keys, `database.sqlite`, or `node_modules`.
