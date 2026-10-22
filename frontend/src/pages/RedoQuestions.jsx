import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import CodeEditor from '../components/CodeEditor';
import VerbalAnswerBox from '../components/VerbalAnswerBox';
import QuestionNavigator from '../components/QuestionNavigator';
import api, { AI_TIMEOUT, errorMessage } from '../utils/api';

const Spinner = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
  </div>
);

// Profil sayfasından açılır: geçmişte doğru/yanlış cevaplanan soruları yeniden çözdürür.
const RedoQuestions = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const status = params.get('status') === 'incorrect' ? 'incorrect' : 'correct';
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get(`/api/questions/redo/${status}`)
      .then((r) => setQuestions(r.data || []))
      .catch((e) => setMessage(errorMessage(e, 'Sorular alınamadı.')))
      .finally(() => setLoading(false));
  }, [status]);

  const markResult = (question, isCorrect, points) => {
    const result = { questionId: question.id, status: isCorrect ? 'correct' : 'incorrect', points };
    const next = [...results.filter((r) => r.questionId !== question.id), result];
    setResults(next);
    return next;
  };

  const nextUnanswered = (answeredResults) => {
    const answered = new Set(answeredResults.map((r) => r.questionId));
    for (let step = 1; step < questions.length; step++) {
      const i = (index + step) % questions.length;
      if (!answered.has(questions[i].id)) return i;
    }
    return null;
  };

  // Kod sorusu: editörden gelen sonucu kaydeder ve sıradaki soruya geçer.
  const recordCoding = async (question, isCorrect, feedback = null) => {
    try {
      await api.post(`/api/questions/${question.id}/attempt`, {
        status: isCorrect ? 'correct' : 'incorrect',
        score: isCorrect ? 10 : 0,
        answer: '',
        feedback,
        generateAdaptive: false
      });
    } catch (e) { console.error(e); }
    const next = nextUnanswered(markResult(question, isCorrect, isCorrect ? 10 : 0));
    if (next !== null) setIndex(next);
    else navigate('/profile');
  };

  // Sözel soru: cevap backend'de değerlendirilir ve kaydedilir.
  const submitVerbal = async (question, answer) => {
    const { data } = await api.post(`/api/questions/${question.id}/verbal-answer`, { answer }, { timeout: AI_TIMEOUT });
    markResult(question, data.evaluation.isCorrect, data.evaluation.isCorrect ? data.evaluation.score : 0);
    return data.evaluation;
  };

  if (loading) return <Spinner />;
  if (message) return <div className="card text-center text-red-600">{message}</div>;
  if (!questions.length) {
    return (
      <div className="card text-center space-y-4">
        <h2 className="text-xl font-bold">Tekrar edilecek soru yok</h2>
        <button className="btn-primary" onClick={() => navigate('/profile')}>Profile Dön</button>
      </div>
    );
  }

  const q = questions[index];
  const next = nextUnanswered(results);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold">{status === 'correct' ? 'Doğru Soruları Tekrar Et' : 'Yanlış Soruları Tekrar Et'}</h2>
        <span className="text-gray-600">{index + 1} / {questions.length}</span>
      </div>

      <QuestionNavigator
        questions={questions}
        results={results}
        currentIndex={index}
        onJump={setIndex}
        onPrev={() => setIndex((i) => Math.max(0, i - 1))}
        onNext={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
        onFinish={() => navigate('/profile')}
      />

      {q.type === 'coding' ? (
        <CodeEditor
          key={q.id}
          question={q}
          language={q.language || 'python'}
          onSuccess={() => recordCoding(q, true)}
          onFailure={(_, analysis) => recordCoding(q, false, analysis)}
        />
      ) : (
        <div className="max-w-3xl mx-auto">
          <VerbalAnswerBox key={q.id} question={q} onSubmit={(answer) => submitVerbal(q, answer)}>
            {() => (
              <div className="flex justify-end">
                {next !== null ? (
                  <button className="btn-secondary flex items-center gap-2" onClick={() => setIndex(next)}>
                    Sonraki soru <ArrowRight size={16} />
                  </button>
                ) : (
                  <button className="btn-primary" onClick={() => navigate('/profile')}>Profile Dön</button>
                )}
              </div>
            )}
          </VerbalAnswerBox>
        </div>
      )}
    </div>
  );
};

export default RedoQuestions;
