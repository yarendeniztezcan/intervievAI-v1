import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import CodeEditor from '../components/CodeEditor';
import VerbalQuestion from '../components/VerbalQuestion';
import QuestionNavigator from '../components/QuestionNavigator';
import api from '../utils/api';

const MixedSimulation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const count = parseInt(searchParams.get('count'), 10) || 10;
  const level = searchParams.get('level') || 'mid';
  const language = searchParams.get('language') || 'python';
  const codingCourses = (searchParams.get('codingCourses') || '').split(',').filter(Boolean);
  const verbalCourses = (searchParams.get('verbalCourses') || '').split(',').filter(Boolean);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adaptiveQuestion, setAdaptiveQuestion] = useState(null);
  const [adaptiveDepth, setAdaptiveDepth] = useState(0);
  const [simulationId, setSimulationId] = useState(null);

  useEffect(() => { start(); }, []);

  const start = async () => {
    try {
      const r = await api.post('/api/questions/start', { type: 'mixed', count, language, codingCourses, verbalCourses, level });
      setQuestions(r.data.questions || []);
      setSimulationId(r.data.simulationId);
    } catch (e) { setError(e.response?.data?.error || 'Sorular oluşturulamadı.'); }
    finally { setLoading(false); }
  };

  const buildFinalResults = (res) => questions.map(q =>
    res.find(r => r.questionId === q.id) || { questionId: q.id, status: 'skipped', points: 0, attempts: 0 });

  const finish = async (res) => {
    const finalResults = buildFinalResults(res);
    const totalPoints = finalResults.reduce((s, r) => s + (r.points || 0), 0);
    const maxPoints = questions.length * 10;
    const percentage = maxPoints ? totalPoints / maxPoints * 100 : 0;
    try { await api.post('/api/questions/simulations/finish', { simulationId, type: 'mixed', questionCount: questions.length, score: percentage, totalPoints, maxPoints }); } catch (e) { console.error(e); }
    navigate('/results', { state: { type: 'mixed', results: finalResults, totalPoints, maxPoints, percentage, questions } });
  };

  const handleFinishClick = () => {
    const unanswered = questions.filter(q => !results.some(r => r.questionId === q.id));
    if (unanswered.length > 0 &&
        !window.confirm(`${unanswered.length} soru cevapsız. Cevapsız sorular "Atlandı" sayılacak (0 puan). Bitirmek istiyor musunuz?`)) {
      return;
    }
    finish(results);
  };

  const goTo = (idx) => { setAdaptiveQuestion(null); setAdaptiveDepth(0); setCurrentIndex(idx); };
  const goPrev = () => { if (currentIndex > 0) goTo(currentIndex - 1); };
  const goNext = () => { if (currentIndex < questions.length - 1) goTo(currentIndex + 1); };

  const advance = (finalResults) => {
    setAdaptiveQuestion(null); setAdaptiveDepth(0);
    const nextUnanswered = questions.findIndex((q, i) =>
      i > currentIndex && !finalResults.some(r => r.questionId === q.id));
    if (nextUnanswered !== -1) { setCurrentIndex(nextUnanswered); return; }
    const anyUnanswered = questions.some(q => !finalResults.some(r => r.questionId === q.id));
    if (!anyUnanswered) finish(finalResults);
  };

  const submitResult = async ({ question, data, isAdaptive }) => {
    const r = await api.post(`/api/questions/${question.id}/attempt`, {
      simulationId, status: data.isCorrect ? 'correct' : 'incorrect',
      score: Number(data.score) || (data.isCorrect ? 10 : 0),
      answer: data.answer || '', feedback: data, generateAdaptive: !data.isCorrect
    });
    if (!data.isCorrect && r.data.nextQuestion && adaptiveDepth < 5) {
      setAdaptiveQuestion(r.data.nextQuestion); setAdaptiveDepth(d => d + 1); return;
    }
    const result = {
      questionId: questions[currentIndex].id,
      status: data.isCorrect ? (isAdaptive ? 'partial' : 'correct') : 'incorrect',
      points: data.isCorrect ? (isAdaptive ? 5 : Math.min(10, Number(data.score) || 10)) : 0,
      attempts: adaptiveDepth + 1
    };
    const finalResults = [...results.filter(x => x.questionId !== result.questionId), result];
    setResults(finalResults);
    advance(finalResults);
  };

  const handleCode = async (ok, analysis) => {
    if (analysis?.requestSimilar) {
      try {
        const r = await api.post('/api/ai/similar-question', { questionId: questions[currentIndex].id });
        if (r.data && adaptiveDepth < 5) { setAdaptiveQuestion(r.data); setAdaptiveDepth(d => d + 1); }
      } catch (e) { console.error(e); }
      return;
    }
    const q = adaptiveQuestion || questions[currentIndex];
    try { await submitResult({ question: q, data: { isCorrect: ok, score: ok ? 10 : 0, feedback: analysis }, isAdaptive: Boolean(adaptiveQuestion) }); } catch (e) { console.error(e); }
  };

  const handleVerbal = async (data) => {
    try { await submitResult({ question: adaptiveQuestion || questions[currentIndex], data, isAdaptive: Boolean(adaptiveQuestion) }); } catch (e) { console.error(e); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>;
  if (error) return <div className="card text-center text-red-600">{error}</div>;
  if (!questions.length) return <div className="card text-center">Soru bulunamadı.</div>;

  const q = adaptiveQuestion || questions[currentIndex];
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Karma Simülasyon</h2>
        <div className="text-gray-600">Soru {currentIndex + 1} / {questions.length}{adaptiveQuestion ? ' • Pekiştirme' : ''}</div>
      </div>

      <QuestionNavigator
        questions={questions}
        results={results}
        currentIndex={currentIndex}
        onJump={goTo}
        onPrev={goPrev}
        onNext={goNext}
        onFinish={handleFinishClick}
        adaptive={Boolean(adaptiveQuestion)}
      />

      {adaptiveQuestion && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <strong>Benzer soru:</strong> Aynı konuyu pekiştirmek için üretildi.
        </div>
      )}

      {q.type === 'coding'
        ? <CodeEditor key={q.id} question={q} language={q.language || language} onSuccess={() => handleCode(true)} onFailure={(_, a) => handleCode(false, a)} />
        : <VerbalQuestion key={q.id} question={q} onAnswer={handleVerbal} />}
    </div>
  );
};

export default MixedSimulation;
