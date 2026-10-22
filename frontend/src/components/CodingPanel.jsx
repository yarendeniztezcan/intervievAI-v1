import React, { useRef, useState } from 'react';
import CodeEditor from './CodeEditor';
import QuestionNavigator from './QuestionNavigator';
import api, { AI_TIMEOUT } from '../utils/api';
import { MAX_ADAPTIVE } from '../utils/constants';

/**
 * Kod soruları bölümü (simülasyon sayfasının sol tarafı).
 * Yanlış çözümde aynı konudan benzer bir soru üretilir; benzer soruyu çözmek kısmi puan verir.
 * `stacked`: bölünmüş ekranda soru açıklaması ile editör alt alta dizilir.
 */
const CodingPanel = ({ questions, results, simulationId, language, onResult, stacked = false }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [adaptive, setAdaptive] = useState(null);
  const [depth, setDepth] = useState(0);
  const busy = useRef(false); // editör her başarısız çalıştırmada onFailure çağırır; çift kayıt olmasın

  const base = questions[currentIndex];
  const current = adaptive || base;

  const goTo = (index) => {
    setAdaptive(null);
    setDepth(0);
    setCurrentIndex(index);
  };

  // Sıradaki cevapsız soru; `justAnsweredId` henüz `results` içine yansımamış olabilir.
  const nextUnansweredIndex = (justAnsweredId) => {
    const answered = new Set(results.map((r) => r.questionId));
    if (justAnsweredId) answered.add(justAnsweredId);
    for (let step = 1; step < questions.length; step++) {
      const i = (currentIndex + step) % questions.length;
      if (!answered.has(questions[i].id)) return i;
    }
    return null;
  };

  const handleSuccess = async () => {
    if (busy.current) return;
    busy.current = true;
    const isAdaptive = Boolean(adaptive);
    const points = isAdaptive ? 5 : 10;
    try {
      await api.post(`/api/questions/${current.id}/attempt`, {
        simulationId, status: 'correct', score: points, answer: '', feedback: null, generateAdaptive: false
      });
    } catch (e) { console.error(e); }

    onResult({ questionId: base.id, status: isAdaptive ? 'partial' : 'correct', points, attempts: depth + 1 });
    busy.current = false;

    const next = nextUnansweredIndex(base.id);
    if (next !== null) goTo(next);
  };

  // Hem başarısız çalıştırma hem de "Benzer Soru Dene" (çözümü gördükten sonra) buraya gelir.
  const handleFailure = async (_questionId, analysis) => {
    if (busy.current) return;
    busy.current = true;
    const currentDepth = depth;
    let nextQuestion = null;
    try {
      const { data } = await api.post(`/api/questions/${current.id}/attempt`, {
        simulationId, status: 'incorrect', score: 0, answer: '', feedback: analysis || null,
        generateAdaptive: currentDepth < MAX_ADAPTIVE
      }, { timeout: AI_TIMEOUT });
      nextQuestion = data.nextQuestion;
    } catch (e) { console.error(e); }

    onResult({ questionId: base.id, status: 'incorrect', points: 0, attempts: currentDepth + 1 });
    busy.current = false;

    if (nextQuestion) {
      setAdaptive(nextQuestion);
      setDepth(currentDepth + 1);
    } else {
      const next = nextUnansweredIndex(base.id);
      if (next !== null) goTo(next);
    }
  };

  return (
    <div className="space-y-4">
      <QuestionNavigator
        questions={questions}
        results={results}
        currentIndex={currentIndex}
        adaptive={Boolean(adaptive)}
        onJump={goTo}
        onPrev={() => goTo(Math.max(0, currentIndex - 1))}
        onNext={() => goTo(Math.min(questions.length - 1, currentIndex + 1))}
      />

      {adaptive && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
          <strong>Benzer soru ({depth}/{MAX_ADAPTIVE}):</strong> Önceki soruyu pekiştirmek için aynı konudan yeni bir soru
          üretildi. Ana soruya dönmek için soru numaralarından birine tıklayabilirsiniz.
        </div>
      )}

      <CodeEditor
        key={current.id}
        question={current}
        language={current.language || language}
        stacked={stacked}
        onSuccess={handleSuccess}
        onFailure={handleFailure}
      />
    </div>
  );
};

export default CodingPanel;
