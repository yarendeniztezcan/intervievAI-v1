import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import CodeEditor from '../components/CodeEditor';
import QuestionNavigator from '../components/QuestionNavigator';
import api from '../utils/api';

const CodingSimulation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adaptiveQuestion, setAdaptiveQuestion] = useState(null);
  const [adaptiveDepth, setAdaptiveDepth] = useState(0);
  const [error, setError] = useState('');

  const language = searchParams.get('language') || 'python';
  const count = parseInt(searchParams.get('count'), 10) || 10;
  const level = searchParams.get('level') || 'mid';
  const courses = (searchParams.get('courses') || '').split(',').filter(Boolean);
  const simulationIdFromUrl = searchParams.get('simulationId');
  const [simulationId, setSimulationId] = useState(simulationIdFromUrl);

  useEffect(() => { fetchQuestions(); }, []);

  const fetchQuestions = async () => {
    try {
      const response = await api.post('/api/questions/start', { type: 'coding', count, language, courses, level });
      setQuestions(response.data.questions || []);
      setSimulationId(response.data.simulationId);
    } catch (e) {
      setError(e.response?.data?.error || 'Sorular oluşturulamadı. Giriş yaptığınızdan ve OPENAI_API_KEY tanımlı olduğundan emin olun.');
    } finally { setLoading(false); }
  };

  const buildFinalResults = (res) => questions.map(q =>
    res.find(r => r.questionId === q.id) || { questionId: q.id, status: 'skipped', points: 0, attempts: 0 });

  const finish = async (res) => {
    const finalResults = buildFinalResults(res);
    const totalPoints = finalResults.reduce((sum, r) => sum + (r.points || 0), 0);
    const maxPoints = questions.length * 10;
    const percentage = maxPoints ? (totalPoints / maxPoints) * 100 : 0;
    try {
      await api.post('/api/questions/simulations/finish', { simulationId, type: 'coding', questionCount: questions.length, score: percentage, totalPoints, maxPoints });
    } catch (e) { console.error(e); }
    navigate('/results', { state: { type: 'coding', results: finalResults, totalPoints, maxPoints, percentage, questions } });
  };

  const handleFinishClick = () => {
    const unanswered = questions.filter(q => !results.some(r => r.questionId === q.id));
    if (unanswered.length > 0 &&
        !window.confirm(`${unanswered.length} soru cevapsız. Cevapsız sorular "Atlandı" sayılacak (0 puan). Bitirmek istiyor musunuz?`)) {
      return;
    }
    finish(results);
  };

  // Free navigation: jump to any question in any order (Q1 -> Q4 -> Q2)
  const goTo = (idx) => {
    setAdaptiveQuestion(null);
    setAdaptiveDepth(0);
    setCurrentIndex(idx);
  };
  const goPrev = () => { if (currentIndex > 0) goTo(currentIndex - 1); };
  const goNext = () => { if (currentIndex < questions.length - 1) goTo(currentIndex + 1); };

  const advance = (finalResults) => {
    setAdaptiveQuestion(null);
    setAdaptiveDepth(0);
    const nextUnanswered = questions.findIndex((q, i) =>
      i > currentIndex && !finalResults.some(r => r.questionId === q.id));
    if (nextUnanswered !== -1) {
      setCurrentIndex(nextUnanswered);
      return;
    }
    const anyUnanswered = questions.some(q => !finalResults.some(r => r.questionId === q.id));
    if (!anyUnanswered) finish(finalResults);
    // otherwise stay put: user may review answered questions or hit Bitir
  };

  const upsertResult = (newResult) => {
    const filtered = results.filter(r => r.questionId !== newResult.questionId);
    return [...filtered, newResult];
  };

  const saveAttempt = async ({ question, status, score, answer, feedback, adaptive = true }) => {
    const response = await api.post(`/api/questions/${question.id}/attempt`, {
      simulationId, status, score, answer, feedback, generateAdaptive: adaptive
    });
    return response.data;
  };

  const handleSuccess = async (questionId) => {
    const question = adaptiveQuestion || questions[currentIndex];
    const isAdaptive = Boolean(adaptiveQuestion);
    try {
      await saveAttempt({ question, status: 'correct', score: isAdaptive ? 5 : 10, answer: '', feedback: null, adaptive: false });
    } catch (e) { console.error(e); }
    const newResult = {
      questionId: questions[currentIndex].id,
      status: isAdaptive ? 'partial' : 'correct',
      points: isAdaptive ? 5 : 10,
      attempts: isAdaptive ? adaptiveDepth + 1 : 1
    };
    const finalResults = upsertResult(newResult);
    setResults(finalResults);
    advance(finalResults);
  };

  const handleFailure = async (questionId, analysis) => {
    if (analysis?.requestSimilar) {
      // "Benzer Soru Dene" from the solution view: treat as adaptive trigger only
      try {
        await api.post(`/api/questions/${questionId}/attempt`, {
          simulationId, status: 'incorrect', score: 0, answer: '', feedback: { requestSimilar: true }, generateAdaptive: true
        });
      } catch (e) { console.error(e); }
      try {
        const r = await api.post(`/api/ai/similar-question`, { questionId });
        if (r.data && adaptiveDepth < 5) {
          setAdaptiveQuestion(r.data);
          setAdaptiveDepth(d => d + 1);
          return;
        }
      } catch (e) { console.error(e); }
      return;
    }

    const question = adaptiveQuestion || questions[currentIndex];
    try {
      const response = await saveAttempt({
        question, status: 'incorrect', score: 0, answer: '',
        feedback: analysis, adaptive: !adaptiveQuestion || adaptiveDepth < 5
      });
      if (response.nextQuestion && adaptiveDepth < 5) {
        setAdaptiveQuestion(response.nextQuestion);
        setAdaptiveDepth(d => d + 1);
        return;
      }
    } catch (e) { console.error(e); }

    const newResult = {
      questionId: questions[currentIndex].id,
      status: 'incorrect',
      points: 0,
      attempts: adaptiveDepth + 1
    };
    const finalResults = upsertResult(newResult);
    setResults(finalResults);
    advance(finalResults);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>;
  if (error) return <div className="card text-center text-red-600">{error}</div>;
  if (!questions.length) return <div className="card text-center">Soru bulunamadı.</div>;

  const currentQuestion = adaptiveQuestion || questions[currentIndex];
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Kod Simülasyonu</h2>
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
          <strong>Benzer soru:</strong> Önceki soruyu pekiştirmek için aynı konudan yeni bir soru üretildi.
          Ana soruya dönmek için soru numaralarından birine tıklayabilirsiniz.
        </div>
      )}

      <CodeEditor
        key={currentQuestion.id}
        question={currentQuestion}
        language={language}
        onSuccess={handleSuccess}
        onFailure={handleFailure}
      />
    </div>
  );
};

export default CodingSimulation;
