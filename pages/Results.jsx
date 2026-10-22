import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Trophy, AlertCircle, CheckCircle, HelpCircle, XCircle, MinusCircle, RotateCcw, Home } from 'lucide-react';

const Results = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = location;

  if (!state) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Sonuç Bulunamadı</h2>
        <p className="text-gray-600 mb-4">Lütfen önce bir simülasyon tamamlayın.</p>
        <button onClick={() => navigate('/setup')} className="btn-primary">
          Simülasyona Başla
        </button>
      </div>
    );
  }

  const { type, results, totalPoints, maxPoints, percentage, questions } = state;

  const getGrade = () => {
    if (percentage >= 90) return { letter: 'A', color: 'text-green-600', message: 'Mükemmel!' };
    if (percentage >= 80) return { letter: 'B', color: 'text-blue-600', message: 'Çok İyi!' };
    if (percentage >= 70) return { letter: 'C', color: 'text-yellow-600', message: 'İyi!' };
    if (percentage >= 60) return { letter: 'D', color: 'text-orange-600', message: 'Orta' };
    return { letter: 'F', color: 'text-red-600', message: 'Geliştirilmeli' };
  };

  const getWeakTopics = () => {
    const weakTopics = [];
    results.forEach((result, index) => {
      if (result.status === 'incorrect' || result.status === 'partial' || result.status === 'skipped') {
        const topic = questions[index]?.topic || questions[index]?.category;
        if (topic && !weakTopics.includes(topic)) {
          weakTopics.push(topic);
        }
      }
    });
    return weakTopics;
  };

  const grade = getGrade();
  const weakTopics = getWeakTopics();
  const skippedCount = results.filter(r => r.status === 'skipped').length;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'correct': return <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />;
      case 'partial': return <HelpCircle className="w-6 h-6 text-yellow-600 shrink-0" />;
      case 'incorrect': return <XCircle className="w-6 h-6 text-red-600 shrink-0" />;
      case 'skipped': return <MinusCircle className="w-6 h-6 text-gray-400 shrink-0" />;
      default: return null;
    }
  };

  const statusText = (status) => {
    switch (status) {
      case 'correct': return 'Doğru';
      case 'partial': return 'Kısmi';
      case 'incorrect': return 'Yanlış';
      case 'skipped': return 'Atlandı';
      default: return '';
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-3xl font-bold mb-2">Simülasyon Tamamlandı!</h2>
        <p className="text-gray-600">İşte sonuçların:</p>
      </div>

      {/* Score Card */}
      <div className="card text-center">
        <div className={`text-6xl font-bold mb-2 ${grade.color}`}>
          {grade.letter}
        </div>
        <div className="text-2xl font-semibold mb-1">
          {percentage.toFixed(1)}%
        </div>
        <div className="text-gray-600 mb-4">
          {totalPoints} / {maxPoints} puan
        </div>
        {skippedCount > 0 && (
          <div className="text-sm text-gray-500 mb-2">
            {skippedCount} soru atlandı (0 puan)
          </div>
        )}
        <div className={`text-xl font-medium ${grade.color}`}>
          {grade.message}
        </div>
      </div>

      {/* Weak Topics */}
      {weakTopics.length > 0 && (
        <div className="card bg-red-50 border border-red-200">
          <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
            <AlertCircle size={20} />
            Geliştirilmesi Gereken Konular
          </h3>
          <ul className="space-y-2">
            {weakTopics.map((topic, i) => (
              <li key={i} className="text-red-700 flex items-center gap-2">
                <span>•</span> {topic}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Question Details */}
      <div className="card">
        <h3 className="font-semibold mb-4">Soru Detayları</h3>
        <div className="space-y-3">
          {results.map((result, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg gap-2">
              <div className="flex items-center gap-3 min-w-0">
                {getStatusIcon(result.status)}
                <span className="font-medium shrink-0">Soru {index + 1}</span>
                <span className="text-sm text-gray-600 truncate">
                  {questions[index]?.title || questions[index]?.topic}
                </span>
                <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">{statusText(result.status)}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`font-semibold ${
                  result.status === 'correct' ? 'text-green-600' :
                  result.status === 'partial' ? 'text-yellow-600' :
                  result.status === 'skipped' ? 'text-gray-400' :
                  'text-red-600'
                }`}>
                  {result.points} / 10
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={() => navigate('/setup')}
          className="flex-1 btn-primary flex items-center justify-center gap-2"
        >
          <RotateCcw size={20} />
          Yeni Simülasyon
        </button>
        <button
          onClick={() => navigate('/')}
          className="flex-1 btn-secondary flex items-center justify-center gap-2"
        >
          <Home size={20} />
          Ana Sayfa
        </button>
      </div>
    </div>
  );
};

export default Results;
