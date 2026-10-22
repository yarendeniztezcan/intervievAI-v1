import React from 'react';
import { CheckCircle, XCircle, HelpCircle, MinusCircle } from 'lucide-react';

const QuestionCard = ({ question, status, index, active = false, onClick }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'correct':
        return <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />;
      case 'partial':
        return <HelpCircle className="w-6 h-6 text-yellow-600 shrink-0" />;
      case 'incorrect':
        return <XCircle className="w-6 h-6 text-red-600 shrink-0" />;
      case 'skipped':
        return <MinusCircle className="w-6 h-6 text-gray-400 shrink-0" />;
      default:
        return <div className="w-6 h-6 rounded-full border-2 border-gray-300 shrink-0" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'correct':
        return 'border-green-500 bg-green-50';
      case 'partial':
        return 'border-yellow-500 bg-yellow-50';
      case 'incorrect':
        return 'border-red-500 bg-red-50';
      case 'skipped':
        return 'border-gray-300 bg-gray-50';
      default:
        return active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300';
    }
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${getStatusColor()}`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <h4 className="font-semibold mb-1">
            {index != null && <span className="text-gray-400 mr-1">#{index + 1}</span>}
            {question.title}
          </h4>
          <p className="text-sm text-gray-600 line-clamp-2">{question.description || question.question}</p>
        </div>
        {getStatusIcon()}
      </div>

      <div className="flex gap-2 mt-3 flex-wrap">
        <span className={`text-xs px-2 py-1 rounded ${
          question.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
          question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
          'bg-red-100 text-red-800'
        }`}>
          {question.difficulty === 'easy' ? 'Junior' :
           question.difficulty === 'medium' ? 'Mid-Level' : 'Senior'}
        </span>
        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
          {question.category}
        </span>
      </div>
    </button>
  );
};

export default QuestionCard;
