import React, { useRef, useState } from 'react';
import { ArrowRight, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import VerbalAnswerBox from './VerbalAnswerBox';
import QuestionNavigator from './QuestionNavigator';
import api, { AI_TIMEOUT, errorMessage } from '../utils/api';
import { MAX_ADAPTIVE } from '../utils/constants';

/**
 * Sözel soru bölümü (simülasyon sayfasının sağ tarafı).
 * Akış: soru -> kullanıcı yazarak cevaplar -> AI kontrol eder ->
 *   doğruysa: sonraki soruya geçilir
 *   yanlışsa: doğru cevap gösterilir ve aynı konudan benzer bir soru hazırlanır
 */
const VerbalPanel = ({ questions, results, simulationId, onResult }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [adaptive, setAdaptive] = useState(null); // benzer (pekiştirme) soru
  const [depth, setDepth] = useState(0); // zincirdeki benzer soru sayısı
  const [similar, setSimilar] = useState({ status: 'idle', question: null, message: '' });
  const requestId = useRef(0);

  const base = questions[currentIndex];
  const current = adaptive || base;

  const resetTo = (index) => {
    requestId.current += 1; // bekleyen benzer-soru isteğini geçersiz kıl
    setAdaptive(null);
    setDepth(0);
    setSimilar({ status: 'idle', question: null, message: '' });
    setCurrentIndex(index);
  };

  // Sıradaki cevapsız soru (sondan sonra başa dönerek); yoksa null.
  const nextUnansweredIndex = () => {
    const answered = new Set(results.map((r) => r.questionId));
    for (let step = 1; step < questions.length; step++) {
      const i = (currentIndex + step) % questions.length;
      if (!answered.has(questions[i].id)) return i;
    }
    return null;
  };

  const startSimilar = async (question, currentDepth) => {
    if (currentDepth >= MAX_ADAPTIVE) {
      setSimilar({ status: 'none', question: null, message: '' });
      return;
    }
    const id = ++requestId.current;
    setSimilar({ status: 'loading', question: null, message: '' });
    try {
      const { data } = await api.post(`/api/questions/${question.id}/similar`, { simulationId }, { timeout: AI_TIMEOUT });
      if (id === requestId.current) setSimilar({ status: 'ready', question: data, message: '' });
    } catch (e) {
      if (id !== requestId.current) return;
      if (e.response?.status === 409) setSimilar({ status: 'none', question: null, message: '' });
      else setSimilar({ status: 'error', question: null, message: errorMessage(e, 'Benzer soru oluşturulamadı.') });
    }
  };

  const submit = async (answer) => {
    const isAdaptive = Boolean(adaptive);
    const { data } = await api.post(
      `/api/questions/${current.id}/verbal-answer`,
      { answer, simulationId },
      { timeout: AI_TIMEOUT }
    );
    const evaluation = data.evaluation;

    // Sonuç ana soru adına yazılır: ilk denemede doğru = tam puan, benzer soruda doğru = kısmi puan.
    onResult({
      questionId: base.id,
      status: evaluation.isCorrect ? (isAdaptive ? 'partial' : 'correct') : 'incorrect',
      points: evaluation.isCorrect ? (isAdaptive ? 5 : Math.min(10, evaluation.score)) : 0,
      attempts: depth + 1
    });

    if (!evaluation.isCorrect) startSimilar(current, depth); // kullanıcı doğru cevabı okurken arka planda hazırlanır
    return evaluation;
  };

  const goToSimilar = () => {
    setAdaptive(similar.question);
    setDepth((d) => d + 1);
    setSimilar({ status: 'idle', question: null, message: '' });
  };

  const renderActions = (evaluation) => {
    const next = nextUnansweredIndex();
    const nextButton = next !== null && (
      <button onClick={() => resetTo(next)} className="btn-secondary flex items-center gap-2">
        Sonraki soru <ArrowRight size={16} />
      </button>
    );

    if (evaluation.isCorrect) {
      return (
        <div className="flex justify-end items-center gap-3">
          {nextButton || <span className="text-sm text-green-700 font-medium">Sözel sorular tamamlandı ✓</span>}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {similar.status === 'ready' && <p className="text-sm text-gray-600">Doğru cevabı inceledikten sonra aynı konudan benzer bir soruya geçebilirsiniz.</p>}
        {similar.status === 'none' && <p className="text-sm text-gray-600">Bu konu için benzer soru sınırına ulaşıldı.</p>}
        {similar.status === 'error' && <p className="text-sm text-red-600">{similar.message}</p>}

        <div className="flex justify-end items-center gap-2 flex-wrap">
          {similar.status === 'loading' && (
            <button disabled className="btn-primary opacity-70 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Benzer soru hazırlanıyor...
            </button>
          )}
          {similar.status === 'ready' && (
            <button onClick={goToSimilar} className="btn-primary flex items-center gap-2">
              Benzer soruya geç <ArrowRight size={16} />
            </button>
          )}
          {similar.status === 'error' && (
            <button onClick={() => startSimilar(current, depth)} className="btn-primary flex items-center gap-2">
              <RefreshCw size={16} /> Tekrar dene
            </button>
          )}
          {nextButton}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <QuestionNavigator
        questions={questions}
        results={results}
        currentIndex={currentIndex}
        adaptive={Boolean(adaptive)}
        onJump={resetTo}
        onPrev={() => resetTo(Math.max(0, currentIndex - 1))}
        onNext={() => resetTo(Math.min(questions.length - 1, currentIndex + 1))}
      />

      {adaptive && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm flex items-start gap-2">
          <MessageSquare size={16} className="text-yellow-700 mt-0.5 shrink-0" />
          <span>
            <strong>Benzer soru ({depth}/{MAX_ADAPTIVE}):</strong> Önceki soruda yanlış yaptığın konuyu pekiştirmek için
            aynı konudan yeni bir soru. Bu soruyu doğru cevaplarsan kısmi puan alırsın.
          </span>
        </div>
      )}

      <VerbalAnswerBox key={current.id} question={current} onSubmit={submit}>
        {renderActions}
      </VerbalAnswerBox>
    </div>
  );
};

export default VerbalPanel;
