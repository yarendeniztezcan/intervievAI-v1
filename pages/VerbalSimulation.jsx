import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import VerbalQuestion from '../components/VerbalQuestion';
import QuestionNavigator from '../components/QuestionNavigator';
import api from '../utils/api';

const VerbalSimulation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adaptiveQuestion, setAdaptiveQuestion] = useState(null);
  const [adaptiveDepth, setAdaptiveDepth] = useState(0);
  const [simulationId, setSimulationId] = useState(null);
  const [error, setError] = useState('');
  const count = parseInt(searchParams.get('count'), 10) || 10;
  const level = searchParams.get('level') || 'mid';
  const courses = (searchParams.get('courses') || '').split(',').filter(Boolean);

  useEffect(() => { start(); }, []);

  const start = async () => {
    try {
      const response = await api.post('/api/questions/start', { type: 'verbal', count, courses, level });
      setQuestions(response.data.questions || []);
      setSimulationId(response.data.simulationId);
    } catch (e) { setError(e.response?.data?.error || 'Sorular oluşturulamadı.'); }
    finally { setLoading(false); }
  };

  const buildFinalResults = (res) => questions.map(q =>
    res.find(r => r.questionId === q.id) || { questionId: q.id, status: 'skipped', points: 0, attempts: 0 });

  const finish = async (res) => {
    const finalResults = buildFinalResults(res);
    const totalPoints = finalResults.reduce((sum, r) => sum + (r.points || 0), 0);
    const maxPoints = questions.length * 10;
    const percentage = maxPoints ? (totalPoints / maxPoints) * 100 : 0;
    try { await api.post('/api/questions/simulations/finish', { simulationId, type: 'verbal', questionCount: questions.length, score: percentage, totalPoints, maxPoints }); } catch (e) { console.error(e); }
    navigate('/results', { state: { type: 'verbal', results: finalResults, totalPoints, maxPoints, percentage, questions } });
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

  const handleAnswer = async (data) => {
    const question = adaptiveQuestion || questions[currentIndex];
    const isAdaptive = Boolean(adaptiveQuestion);
    try {
      const response = await api.post(`/api/questions/${question.id}/attempt`, {
        simulationId,
        status: data.isCorrect ? 'correct' : 'incorrect',
        score: Number(data.score) || (data.isCorrect ? 10 : 0),
        answer: data.answer || '',
        feedback: data,
        generateAdaptive: !data.isCorrect
      });
      if (!data.isCorrect && response.data.nextQuestion && adaptiveDepth < 5) {
        setAdaptiveQuestion(response.data.nextQuestion); setAdaptiveDepth(d => d + 1); return;
      }
    } catch (e) { console.error(e); }

    const points = data.isCorrect ? (isAdaptive ? 5 : Math.min(10, Number(data.score) || 10)) : 0;
    const result = {
      questionId: questions[currentIndex].id,
      status: data.isCorrect ? (isAdaptive ? 'partial' : 'correct') : 'incorrect',
      points,
      attempts: adaptiveDepth + 1
    };
    const finalResults = [...results.filter(r => r.questionId !== result.questionId), result];
    setResults(finalResults);
    advance(finalResults);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>;
  if (error) return <div className="card text-center text-red-600">{error}</div>;
  if (!questions.length) return <div className="card text-center">Soru bulunamadı.</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Sözel Simülasyon</h2>
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
          <strong>Benzer soru:</strong> Aynı konu için yeni bir soru üretildi.
        </div>
      )}

      <VerbalQuestion
        key={(adaptiveQuestion || questions[currentIndex]).id}
        question={adaptiveQuestion || questions[currentIndex]}
        onAnswer={handleAnswer}
      />
    </div>
  );
};

export default VerbalSimulation;
