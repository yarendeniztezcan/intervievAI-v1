import React from 'react';
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react';

const pillStyles = {
  correct: 'bg-green-500 border-green-600 text-white',
  partial: 'bg-yellow-400 border-yellow-500 text-white',
  incorrect: 'bg-red-500 border-red-600 text-white',
  skipped: 'bg-gray-300 border-gray-400 text-gray-700',
  default: 'bg-white border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
};

const QuestionNavigator = ({
  questions,
  results,
  currentIndex,
  onJump,
  onPrev,
  onNext,
  onFinish,
  adaptive = false
}) => {
  const statusOf = (q) => results.find(r => r.questionId === q.id)?.status;
  const answered = questions.filter(q => results.some(r => r.questionId === q.id)).length;
  const allAnswered = answered === questions.length;

  return (
    <div className="card !p-4 space-y-3 sticky top-20 z-10">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-gray-600">
          <span className="font-semibold text-gray-800">{answered}/{questions.length}</span> soru cevaplandı
          {adaptive && <span className="ml-2 text-yellow-600 font-medium">• Pekiştirme sorusu aktif</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            disabled={currentIndex === 0}
            className="btn-secondary !px-3 !py-1.5 text-sm flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} /> Önceki
          </button>
          <button
            onClick={onNext}
            disabled={currentIndex === questions.length - 1}
            className="btn-secondary !px-3 !py-1.5 text-sm flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Sonraki <ChevronRight size={16} />
          </button>
          <button
            onClick={onFinish}
            className="btn-primary !px-3 !py-1.5 text-sm flex items-center gap-1"
          >
            <Flag size={14} /> Bitir
          </button>
        </div>
      </div>

      {/* Question lineup: click any number to jump in any order (Q1 -> Q4 -> Q2) */}
      <div className="flex gap-1.5 flex-wrap">
        {questions.map((q, idx) => {
          const status = statusOf(q);
          const isCurrent = idx === currentIndex && !adaptive;
          return (
            <button
              key={q.id}
              onClick={() => onJump(idx)}
              title={q.title}
              className={`w-9 h-9 rounded-lg border-2 text-sm font-semibold transition-all ${pillStyles[status] || pillStyles.default} ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Doğru</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-400 inline-block" /> Kısmi</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Yanlış</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-300 inline-block" /> Atlandı</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border border-gray-300 inline-block" /> Cevapsız</span>
      </div>

      {!allAnswered && (
        <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
          Cevapsız sorular bitirildiğinde "Atlandı" sayılır (0 puan). Numaralara tıklayarak istediğiniz sırayla ilerleyebilirsiniz.
        </p>
      )}
    </div>
  );
};

export default QuestionNavigator;
