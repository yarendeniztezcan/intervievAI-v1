import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import CodeEditor from '../components/CodeEditor';
import VerbalQuestion from '../components/VerbalQuestion';
import QuestionNavigator from '../components/QuestionNavigator';
import api from '../utils/api';

const RedoQuestions = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const status = params.get('status') === 'incorrect' ? 'incorrect' : 'correct';
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => { load(); }, [status]);

  const load = async () => {
    try { const r = await api.get(`/api/questions/redo/${status}`); setQuestions(r.data || []); }
    catch (e) { setMessage(e.response?.data?.error || 'Sorular alınamadı.'); }
    finally { setLoading(false); }
  };

  const record = async (question, data) => {
    try {
      await api.post(`/api/questions/${question.id}/attempt`, {
        status: data.isCorrect ? 'correct' : 'incorrect',
        score: data.score || (data.isCorrect ? 10 : 0),
        answer: data.answer || '', feedback: data, generateAdaptive: false
      });
    } catch (e) { console.error(e); }
    const newResult = { questionId: question.id, status: data.isCorrect ? 'correct' : 'incorrect', points: data.isCorrect ? 10 : 0 };
    const finalResults = [...results.filter(r => r.questionId !== question.id), newResult];
    setResults(finalResults);
    const nextUnanswered = questions.findIndex((q, i) => i > index && !finalResults.some(r => r.questionId === q.id));
    if (nextUnanswered !== -1) setIndex(nextUnanswered);
    else if (finalResults.length === questions.length) navigate('/profile');
  };

  const handleFinish = () => navigate('/profile');

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>;
  if (message) return <div className="card text-center text-red-600">{message}</div>;
  if (!questions.length) return (
    <div className="card text-center space-y-4">
      <h2 className="text-xl font-bold">Tekrar edilecek soru yok</h2>
      <button className="btn-primary" onClick={() => navigate('/profile')}>Profile Dön</button>
    </div>
  );

  const q = questions[index];
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold">{status === 'correct' ? 'Doğru Soruları Tekrar Et' : 'Yanlış Soruları Tekrar Et'}</h2>
        <span className="text-gray-600">{index + 1} / {questions.length}</span>
      </div>

      <QuestionNavigator
        questions={questions}
        results={results}
        currentIndex={index}
        onJump={(i) => setIndex(i)}
        onPrev={() => setIndex(i => Math.max(0, i - 1))}
        onNext={() => setIndex(i => Math.min(questions.length - 1, i + 1))}
        onFinish={handleFinish}
      />

      {q.type === 'coding'
        ? <CodeEditor key={q.id} question={q} language={q.language || 'python'} onSuccess={() => record(q, { isCorrect: true, score: 10 })} onFailure={(_, a) => record(q, { isCorrect: false, score: 0, feedback: a })} />
        : <VerbalQuestion key={q.id} question={q} onAnswer={data => record(q, data)} />}
    </div>
  );
};

export default RedoQuestions;
