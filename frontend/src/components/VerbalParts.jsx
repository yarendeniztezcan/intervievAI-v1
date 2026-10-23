import React from 'react';
import { CheckCircle, XCircle, AlertCircle, BookOpen } from 'lucide-react';

const LEVEL_LABEL = { easy: 'Junior', medium: 'Mid-Level', hard: 'Senior' };
const LEVEL_STYLE = {
  easy: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  hard: 'bg-red-100 text-red-800'
};

export const tone = (evaluation) => {
  if (evaluation.isCorrect) return { box: 'bg-green-50 border-green-200', text: 'text-green-800', label: 'Doğru', Icon: CheckCircle, icon: 'text-green-600' };
  if (evaluation.score >= 4) return { box: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-800', label: 'Eksik cevap', Icon: AlertCircle, icon: 'text-yellow-600' };
  return { box: 'bg-red-50 border-red-200', text: 'text-red-800', label: 'Yanlış', Icon: XCircle, icon: 'text-red-600' };
};

/** Sorunun ders / konu / seviye etiketleri (yazılı ve sesli sözel sorularda ortak). */
export const QuestionMeta = ({ question }) => (
  <div className="flex gap-2 flex-wrap mb-2">
    {question.subjectName && <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">{question.subjectName}</span>}
    {question.topic && question.topic !== question.subject && (
      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">{question.topic}</span>
    )}
    <span className={`text-xs px-2 py-1 rounded ${LEVEL_STYLE[question.difficulty] || LEVEL_STYLE.medium}`}>
      {LEVEL_LABEL[question.difficulty] || LEVEL_LABEL.medium}
    </span>
  </div>
);

/** Değerlendirme sonucu: puan, geri bildirim, güçlü/eksik yönler ve doğru cevap (yazılı ve sesli ortak). */
export const EvaluationResult = ({ evaluation }) => {
  const t = tone(evaluation);
  return (
    <>
      <div className={`p-4 rounded-lg border ${t.box}`}>
        <div className="flex items-center gap-2 mb-2">
          <t.Icon className={t.icon} size={22} />
          <span className={`font-semibold ${t.text}`}>{t.label}</span>
          <span className="ml-auto font-semibold text-gray-700">{evaluation.score}/10</span>
        </div>
        {evaluation.feedback && <p className="text-gray-700 text-sm mb-3">{evaluation.feedback}</p>}
        {evaluation.strengths?.length > 0 && (
          <div className="mb-2">
            <h5 className="font-semibold text-green-800 text-sm mb-1">Güçlü yönler</h5>
            <ul className="list-disc list-inside text-green-700 text-sm">{evaluation.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}
        {evaluation.improvements?.length > 0 && (
          <div>
            <h5 className="font-semibold text-red-800 text-sm mb-1">Eksik / geliştirilecek noktalar</h5>
            <ul className="list-disc list-inside text-red-700 text-sm">{evaluation.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}
      </div>

      {evaluation.correctAnswer && (evaluation.isCorrect ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-blue-700 font-medium flex items-center gap-1 w-fit">
            <BookOpen size={14} /> İdeal cevabı göster
          </summary>
          <p className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-400 rounded whitespace-pre-wrap text-gray-700">{evaluation.correctAnswer}</p>
        </details>
      ) : (
        <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
          <h5 className="font-semibold text-blue-900 mb-1 flex items-center gap-2"><BookOpen size={16} /> Doğru cevap</h5>
          <p className="text-gray-800 text-sm whitespace-pre-wrap">{evaluation.correctAnswer}</p>
        </div>
      ))}
    </>
  );
};
