import React, { useState } from 'react';
import { Send, Lightbulb, Loader2 } from 'lucide-react';
import { errorMessage } from '../utils/api';
import { QuestionMeta, EvaluationResult } from './VerbalParts';

/**
 * Tek bir sözel soru: soru metni, cevap kutusu ve değerlendirme sonucu.
 *  - onSubmit(answer): değerlendirmeyi (score, isCorrect, feedback, strengths, improvements, correctAnswer)
 *    döndüren async fonksiyon. Hata fırlatırsa mesaj gösterilir ve cevap korunur.
 *  - children(evaluation): değerlendirme geldikten sonra altta gösterilecek eylem butonları.
 */
const VerbalAnswerBox = ({ question, onSubmit, children }) => {
  const [answer, setAnswer] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showHint, setShowHint] = useState(false);

  const submit = async () => {
    if (!answer.trim() || submitting || evaluation) return;
    setSubmitting(true);
    setError('');
    try {
      setEvaluation(await onSubmit(answer.trim()));
    } catch (e) {
      setError(errorMessage(e, 'Cevap değerlendirilemedi. Lütfen tekrar deneyin.'));
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit();
  };

  return (
    <div className="card space-y-5">
      <div>
        <QuestionMeta question={question} />
        <h3 className="text-lg font-semibold mb-2">{question.title}</h3>
        <p className="text-gray-700 whitespace-pre-wrap">{question.question || question.description}</p>

        {question.hints?.length > 0 && !evaluation && (
          <button
            onClick={() => setShowHint((v) => !v)}
            className="mt-3 flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-sm hover:bg-yellow-200 cursor-pointer"
          >
            <Lightbulb size={16} /> {showHint ? 'İpuçlarını Gizle' : 'İpucu Göster'}
          </button>
        )}
      </div>

      {showHint && !evaluation && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
          <ul className="list-disc list-inside text-yellow-800 text-sm space-y-1">
            {question.hints.map((hint, i) => <li key={i}>{hint}</li>)}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={onKeyDown}
          readOnly={Boolean(evaluation)}
          maxLength={5000}
          placeholder="Cevabınızı buraya yazın... (Ctrl+Enter ile gönderebilirsiniz)"
          className={`w-full h-40 p-4 border rounded-lg resize-y focus:ring-2 focus:ring-blue-500 focus:outline-none ${evaluation ? 'bg-gray-50 text-gray-600' : ''}`}
        />
        {!evaluation && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">{answer.length} karakter</span>
            <button onClick={submit} disabled={!answer.trim() || submitting} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {submitting ? 'Değerlendiriliyor...' : 'Cevabı Kontrol Et'}
            </button>
          </div>
        )}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded">{error}</div>}
      </div>

      {evaluation && (
        <div className="space-y-4">
          <EvaluationResult evaluation={evaluation} />

          {children?.(evaluation)}
        </div>
      )}
    </div>
  );
};

export default VerbalAnswerBox;
