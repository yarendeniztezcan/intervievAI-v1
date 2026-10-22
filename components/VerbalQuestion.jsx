import React, { useState } from 'react';
import { Send, Lightbulb, CheckCircle, XCircle } from 'lucide-react';
import api from '../utils/api';

const VerbalQuestion = ({ question, onAnswer, onHintUsed }) => {
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!answer.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      const response = await api.post('/api/ai/analyze-verbal', {
        question: question,
        answer: answer
      });
      
      const analysis = response.data;
      setFeedback(analysis);
      
      onAnswer?.({
        questionId: question.id,
        answer: answer,
        score: analysis.score,
        isCorrect: analysis.score >= 7
      });
    } catch (error) {
      setFeedback({
        score: 5,
        feedback: 'Yanıtınız alındı.',
        strengths: ['Yanıt verildi'],
        improvements: ['Daha detaylı açıklama yapılabilir']
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getHint = () => {
    setShowHint(true);
    onHintUsed?.();
  };

  return (
    <div className="card space-y-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-xl">📝</span>
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-semibold mb-2">{question.title}</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{question.question}</p>
          
          {question.hints && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={getHint}
                className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-sm hover:bg-yellow-200"
              >
                <Lightbulb size={16} />
                İpucu Göster
              </button>
            </div>
          )}
        </div>
      </div>

      {showHint && question.hints && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <h4 className="font-semibold text-yellow-800 mb-2">İpuçları:</h4>
          <ul className="list-disc list-inside text-yellow-700 space-y-1">
            {question.hints.map((hint, i) => (
              <li key={i}>{hint}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Yanıtınızı buraya yazın..."
          className="w-full h-48 p-4 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500"
        />
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">{answer.length} karakter</span>
          <button
            onClick={handleSubmit}
            disabled={!answer.trim() || isSubmitting}
            className="btn-primary flex items-center gap-2"
          >
            <Send size={16} />
            {isSubmitting ? 'Gönderiliyor...' : 'Gönder'}
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-lg ${
          feedback.score >= 7 ? 'bg-green-50 border border-green-200' :
          feedback.score >= 4 ? 'bg-yellow-50 border border-yellow-200' :
          'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            {feedback.score >= 7 ? <CheckCircle className="text-green-600" /> :
             feedback.score >= 4 ? <HelpCircle className="text-yellow-600" /> :
             <XCircle className="text-red-600" />}
            <span className="font-semibold">Puan: {feedback.score}/10</span>
          </div>
          
          <p className="text-gray-700 mb-3">{feedback.feedback}</p>
          
          {feedback.strengths && (
            <div className="mb-3">
              <h5 className="font-semibold text-green-800 mb-1">Güçlü Yönler:</h5>
              <ul className="list-disc list-inside text-green-700">
                {feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
          
          {feedback.improvements && (
            <div>
              <h5 className="font-semibold text-red-800 mb-1">İyileştirme Alanları:</h5>
              <ul className="list-disc list-inside text-red-700">
                {feedback.improvements.map((imp, i) => <li key={i}>{imp}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VerbalQuestion;