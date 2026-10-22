import React, { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Play, RotateCcw, Lightbulb, HelpCircle, CheckCircle, XCircle, Plus, Minus } from 'lucide-react';
import api from '../utils/api';

const MIN_EDITOR_HEIGHT = 320;
const MAX_EDITOR_HEIGHT = 900;

// stacked: dar alanlarda (bölünmüş ekran) soru açıklaması ile editör alt alta dizilir.
const CodeEditor = ({ question, language, onSuccess, onFailure, onHintUsed, stacked = false }) => {
  const [code, setCode] = useState(question.starterCode || '');
  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [editorHeight, setEditorHeight] = useState(480);
  const editorRef = useRef(null);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monaco.editor.defineTheme('interviewTheme', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
      }
    });
    monaco.editor.setTheme('interviewTheme');
  };

  const resizeEditor = (delta) => {
    setEditorHeight(h => Math.min(MAX_EDITOR_HEIGHT, Math.max(MIN_EDITOR_HEIGHT, h + delta)));
  };

  const runCode = async () => {
    setIsLoading(true);
    setOutput('');
    setFeedback(null);

    try {
      const response = await api.post('/api/execute', {
        code,
        language,
        testCases: question.testCases,
        questionId: question.id,
        question
      });

      const { results, passed, failed, aiAnalysis } = response.data;

      setOutput(formatOutput(results));

      if (passed === question.testCases?.length) {
        setFeedback({
          type: 'success',
          message: 'Tebrikler! Tüm testleri geçtiniz.',
          optimization: aiAnalysis?.optimization
        });
        onSuccess?.(question.id);
      } else {
        setFeedback({
          type: 'error',
          message: `${failed} test başarısız oldu.`,
          hints: aiAnalysis?.hints,
          errorAnalysis: aiAnalysis?.errorAnalysis
        });
        onFailure?.(question.id, aiAnalysis);
      }
    } catch (error) {
      setOutput(`Hata: ${error.message}`);
      setFeedback({
        type: 'error',
        message: 'Kod çalıştırılırken bir hata oluştu.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatOutput = (results) => {
    if (!results) return '';
    return results.map((r, i) =>
      `Test ${i + 1}: ${r.passed ? '✓' : '✗'}\n` +
      `Input: ${JSON.stringify(r.input)}\n` +
      `Expected: ${JSON.stringify(r.expected)}\n` +
      `Got: ${JSON.stringify(r.actual)}\n` +
      `${r.error ? `Hata: ${r.error}` : ''}\n---`
    ).join('\n');
  };

  const getHint = async () => {
    if (hintLevel >= 3) return;

    try {
      const response = await api.post('/api/ai/hint', {
        questionId: question.id,
        currentCode: code,
        level: hintLevel + 1
      });

      setFeedback(prev => ({
        ...prev,
        currentHint: response.data.hint
      }));
      setHintLevel(prev => prev + 1);
      setShowHint(true);
      onHintUsed?.();
    } catch (error) {
      console.error('İpucu alınamadı:', error);
    }
  };

  const showSolution = () => {
    if (editorRef.current) {
      editorRef.current.setValue(question.solution);
    }
    setFeedback({
      type: 'info',
      message: 'Çözüm gösterildi. Anlamaya çalıştıktan sonra benzer bir soru deneyebilirsiniz.',
      showSimilarButton: true
    });
  };

  const resetCode = () => {
    setCode(question.starterCode || '');
    if (editorRef.current) {
      editorRef.current.setValue(question.starterCode || '');
    }
    setOutput('');
    setFeedback(null);
    setHintLevel(0);
    setShowHint(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="bg-gray-800 text-white p-4 flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold">{question.title}</h3>
          <span className={`px-2 py-1 rounded text-xs ${
            question.difficulty === 'easy' ? 'bg-green-600' :
            question.difficulty === 'medium' ? 'bg-yellow-600' : 'bg-red-600'
          }`}>
            {question.difficulty === 'easy' ? 'Junior' :
             question.difficulty === 'medium' ? 'Mid-Level' : 'Senior'}
          </span>
          <span className="text-xs text-gray-400">{language.toUpperCase()}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={getHint}
            disabled={hintLevel >= 3}
            className="flex items-center gap-2 px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-sm disabled:opacity-50"
          >
            <Lightbulb size={16} />
            İpucu ({3 - hintLevel})
          </button>
          <button
            onClick={showSolution}
            className="flex items-center gap-2 px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
          >
            <HelpCircle size={16} />
            Çözüm
          </button>
          <button
            onClick={resetCode}
            className="flex items-center gap-2 px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
          >
            <RotateCcw size={16} />
            Sıfırla
          </button>
        </div>
      </div>

      {/* Küçük ekranlarda (ve `stacked` iken her zaman) alt alta; geniş ekranda yan yana. */}
      <div className={`grid grid-cols-1 gap-0 ${stacked ? '' : 'lg:grid-cols-2'}`}>
        <div className={`p-6 border-b border-gray-200 bg-gray-50 overflow-y-auto ${stacked ? 'max-h-[280px]' : 'lg:border-b-0 lg:border-r max-h-[600px]'}`}>
          <div className="prose max-w-none">
            <h4 className="text-lg font-semibold mb-3">Soru Açıklaması</h4>
            <p className="text-gray-700 mb-4 whitespace-pre-wrap">{question.description}</p>

            {question.examples && question.examples.length > 0 && (
              <div className="mt-4">
                <h5 className="font-semibold mb-2">Örnekler:</h5>
                {question.examples.map((ex, i) => (
                  <div key={i} className="bg-gray-800 text-green-400 p-3 rounded mb-2 font-mono text-sm overflow-x-auto">
                    <div>Input: {ex.input}</div>
                    <div>Output: {ex.output}</div>
                    {ex.explanation && <div className="text-gray-400 mt-1">// {ex.explanation}</div>}
                  </div>
                ))}
              </div>
            )}

            {showHint && feedback?.currentHint && (
              <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                <h5 className="font-semibold text-yellow-800 mb-1">İpucu Seviye {hintLevel}:</h5>
                <p className="text-yellow-700">{feedback.currentHint}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col min-w-0">
          {/* Editor height is user-adjustable; Monaco scrolls internally so no arrow-key page jumping */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-700">
            <span className="text-xs text-gray-400 font-semibold">KOD EDİTÖRÜ</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => resizeEditor(-80)}
                disabled={editorHeight <= MIN_EDITOR_HEIGHT}
                className="p-1 text-gray-300 hover:text-white disabled:opacity-30"
                title="Editörü küçült"
              >
                <Minus size={14} />
              </button>
              <span className="text-xs text-gray-400 w-14 text-center">{editorHeight}px</span>
              <button
                onClick={() => resizeEditor(80)}
                disabled={editorHeight >= MAX_EDITOR_HEIGHT}
                className="p-1 text-gray-300 hover:text-white disabled:opacity-30"
                title="Editörü büyüt"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1" style={{ minHeight: editorHeight }}>
            <Editor
              height={editorHeight}
              language={language}
              value={code}
              onChange={setCode}
              onMount={handleEditorDidMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                insertSpaces: true,
                wordWrap: 'on',
                scrollbar: { vertical: 'auto', horizontal: 'auto', verticalScrollbarSize: 12 }
              }}
            />
          </div>

          {feedback && (
            <div className={`p-4 border-t ${
              feedback.type === 'success' ? 'bg-green-50 border-green-200' :
              feedback.type === 'error' ? 'bg-red-50 border-red-200' :
              'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-start gap-3">
                {feedback.type === 'success' ? <CheckCircle className="text-green-600 shrink-0" /> :
                 feedback.type === 'error' ? <XCircle className="text-red-600 shrink-0" /> :
                 <HelpCircle className="text-blue-600 shrink-0" />}
                <div className="flex-1">
                  <p className={`font-medium ${
                    feedback.type === 'success' ? 'text-green-800' :
                    feedback.type === 'error' ? 'text-red-800' :
                    'text-blue-800'
                  }`}>
                    {feedback.message}
                  </p>

                  {feedback.optimization && (
                    <div className="mt-2 text-sm text-green-700">
                      <strong>Optimizasyon:</strong> {feedback.optimization}
                    </div>
                  )}

                  {feedback.errorAnalysis && (
                    <div className="mt-2 text-sm text-red-700">
                      <strong>Hata Analizi:</strong> {feedback.errorAnalysis}
                    </div>
                  )}

                  {feedback.showSimilarButton && (
                    <button
                      onClick={() => onFailure?.(question.id, { requestSimilar: true })}
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      Benzer Soru Dene
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 bg-gray-900 text-gray-100 p-4 max-h-[200px] overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-400">Konsol</span>
              <button
                onClick={runCode}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50"
              >
                <Play size={16} />
                {isLoading ? 'Çalıştırılıyor...' : 'Kodu Çalıştır'}
              </button>
            </div>
            <pre className="font-mono text-sm whitespace-pre-wrap">{output || 'Çıktı burada görünecek...'}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
