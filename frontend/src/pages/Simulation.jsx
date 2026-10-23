import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Code, MessageSquare, Mic, Flag, CheckCircle, Loader2, Volume2 } from 'lucide-react';
import CodingPanel from '../components/CodingPanel';
import VerbalPanel from '../components/VerbalPanel';
import api, { AI_TIMEOUT, errorMessage } from '../utils/api';
import { unlockAudio, stopSpeaking, requestMic, voiceSupport, micErrorMessage } from '../utils/voice';
import { LEVEL_LABELS } from '../utils/constants';

const parseList = (value) => (value || '').split(',').filter(Boolean);
const parseCount = (value) => parseInt(value, 10) || 5;

const SectionHeader = ({ icon: Icon, color, title, subtitle }) => (
  <div className="flex items-center gap-3">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div>
      <h3 className="text-lg font-bold leading-tight">{title}</h3>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  </div>
);

/**
 * Simülasyon sayfası.
 *  - karma  : sol tarafta kod soruları, sağ tarafta sözel sorular (yan yana)
 *  - kod    : yalnızca kod soruları
 *  - sözel  : yalnızca sözel sorular (yazarak cevaplanır)
 *  - sözlü  : sözel sorular, ama AI soruyu sesli sorar ve kullanıcı konuşarak cevaplar (yazı yok)
 */
const Simulation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const requestedType = searchParams.get('type');
  const type = ['coding', 'verbal', 'voice', 'mixed'].includes(requestedType) ? requestedType : 'mixed';
  const isVoice = type === 'voice';
  const level = searchParams.get('level') || 'mid';
  const language = searchParams.get('language') || 'python';
  const codingCount = parseCount(searchParams.get('codingCount'));
  const verbalCount = parseCount(searchParams.get('verbalCount'));
  const codingCourses = parseList(searchParams.get('codingCourses'));
  const verbalCourses = parseList(searchParams.get('verbalCourses'));

  const [session, setSession] = useState({ loading: true, error: '', questions: [], simulationId: null });
  const [results, setResults] = useState([]);
  const [finishing, setFinishing] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false); // sözlü simülasyon: mikrofon izni alındı ve ses açıldı
  const [voiceError, setVoiceError] = useState('');
  const started = useRef(false);

  const start = async () => {
    setSession({ loading: true, error: '', questions: [], simulationId: null });
    const body = type === 'coding'
      ? { type, count: codingCount, courses: codingCourses, language, level }
      : type === 'verbal' || isVoice
        ? { type, count: verbalCount, courses: verbalCourses, level }
        : { type, codingCount, verbalCount, codingCourses, verbalCourses, language, level };
    try {
      const { data } = await api.post('/api/questions/start', body, { timeout: AI_TIMEOUT });
      setSession({ loading: false, error: '', questions: data.questions || [], simulationId: data.simulationId });
    } catch (e) {
      setSession({ loading: false, error: errorMessage(e, 'Sorular oluşturulamadı.'), questions: [], simulationId: null });
    }
  };

  useEffect(() => {
    if (started.current) return; // StrictMode'da çift soru üretimini (ve çift AI maliyetini) önler
    started.current = true;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { loading, error, questions, simulationId } = session;
  const codingQuestions = questions.filter((q) => q.type === 'coding');
  const verbalQuestions = questions.filter((q) => q.type === 'verbal');
  const hasCoding = codingQuestions.length > 0;
  const hasVerbal = verbalQuestions.length > 0;
  const split = hasCoding && hasVerbal;

  const recordResult = (result) =>
    setResults((prev) => [...prev.filter((r) => r.questionId !== result.questionId), result]);

  const answeredCount = questions.filter((q) => results.some((r) => r.questionId === q.id)).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  // Sayfadan ayrılırken AI'nın konuşması kesilir.
  useEffect(() => () => stopSpeaking(), []);

  // Tıklamayla çağrılır: sesli okumayı ve mikrofonu hazırlar (tarayıcılar bunu tıklama olmadan engeller).
  const beginVoice = async () => {
    setVoiceError('');
    unlockAudio();
    const support = voiceSupport();
    if (!support.ok) { setVoiceError(support.reason); return; }
    try {
      await requestMic();
      setVoiceReady(true);
    } catch (e) {
      setVoiceError(micErrorMessage(e));
    }
  };

  const finish = async () => {
    stopSpeaking();
    const unanswered = questions.length - answeredCount;
    if (unanswered > 0 &&
        !window.confirm(`${unanswered} soru cevapsız. Cevapsız sorular "Atlandı" sayılacak (0 puan). Bitirmek istiyor musunuz?`)) {
      return;
    }
    setFinishing(true);
    const finalResults = questions.map((q) =>
      results.find((r) => r.questionId === q.id) || { questionId: q.id, status: 'skipped', points: 0, attempts: 0 });
    const totalPoints = finalResults.reduce((sum, r) => sum + (r.points || 0), 0);
    const maxPoints = questions.length * 10;
    const percentage = maxPoints ? (totalPoints / maxPoints) * 100 : 0;
    try {
      await api.post('/api/questions/simulations/finish', {
        simulationId, type, questionCount: questions.length, score: percentage, totalPoints, maxPoints
      });
    } catch (e) { console.error(e); }
    navigate('/results', { state: { type, results: finalResults, totalPoints, maxPoints, percentage, questions } });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
        <div>
          <p className="font-medium text-gray-800">AI sorularınızı hazırlıyor...</p>
          <p className="text-sm text-gray-500">Yeni konularda bu işlem birkaç on saniye sürebilir.</p>
        </div>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="card max-w-xl mx-auto text-center space-y-4">
        <p className="text-red-600">{error || 'Soru bulunamadı.'}</p>
        <div className="flex gap-3 justify-center">
          <button className="btn-primary" onClick={start}>Tekrar Dene</button>
          <button className="btn-secondary" onClick={() => navigate('/setup')}>Ayarlara Dön</button>
        </div>
      </div>
    );
  }

  if (isVoice && !voiceReady) {
    return (
      <div className="card max-w-xl mx-auto text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-500 flex items-center justify-center">
          <Mic className="w-8 h-8 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Sözlü Simülasyon</h2>
          <p className="text-gray-600 mt-1">{questions.length} soru hazır • {LEVEL_LABELS[level] || level}</p>
        </div>
        <ul className="text-left text-sm text-gray-700 space-y-2 bg-gray-50 rounded-lg p-4">
          <li className="flex gap-2"><Volume2 size={16} className="mt-0.5 shrink-0 text-orange-600" /> AI her soruyu sesli okur ("Birinci soru…").</li>
          <li className="flex gap-2"><Mic size={16} className="mt-0.5 shrink-0 text-orange-600" /> Mikrofon düğmesine basıp cevabını konuşarak ver, bitince tekrar bas.</li>
          <li className="flex gap-2"><MessageSquare size={16} className="mt-0.5 shrink-0 text-orange-600" /> Söylediklerin yazıya çevrilir; onayladıktan sonra değerlendirilir. Yanlışsa doğru cevap okunur ve benzer soru gelir.</li>
        </ul>
        <p className="text-xs text-gray-500">Sessiz bir ortamda ol ve tarayıcı mikrofon izni isterse <strong>İzin ver</strong> de.</p>
        {voiceError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded">{voiceError}</div>}
        <div className="flex gap-3 justify-center">
          <button className="btn-primary flex items-center gap-2" onClick={beginVoice}><Mic size={16} /> Başla</button>
          <button className="btn-secondary" onClick={() => navigate('/setup?type=voice')}>Ayarlara Dön</button>
        </div>
      </div>
    );
  }

  const title = type === 'mixed' ? 'Karma Simülasyon' : type === 'coding' ? 'Kod Simülasyonu' : isVoice ? 'Sözlü Simülasyon' : 'Sözel Simülasyon';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-sm text-gray-500">
            {LEVEL_LABELS[level] || level}
            {hasCoding && ` • ${language.toUpperCase()}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-gray-800">{answeredCount}/{questions.length}</span> soru cevaplandı
          </span>
          <button
            onClick={finish}
            disabled={finishing}
            className={`${allAnswered ? 'btn-success' : 'btn-primary'} flex items-center gap-2 disabled:opacity-60`}
          >
            {allAnswered ? <CheckCircle size={16} /> : <Flag size={16} />}
            {allAnswered ? 'Sonuçları Gör' : 'Bitir'}
          </button>
        </div>
      </div>

      {allAnswered && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
          Tüm sorular cevaplandı. Geri bildirimleri incelemeyi bitirdiğinde <strong>Sonuçları Gör</strong> butonuna tıklayabilirsin.
        </div>
      )}

      <div className={split ? 'grid grid-cols-1 lg:grid-cols-2 gap-6 items-start' : ''}>
        {hasCoding && (
          <section className="min-w-0 space-y-4">
            <SectionHeader icon={Code} color="bg-blue-600" title="Kod Soruları" subtitle={`${codingQuestions.length} soru • çözümünü editöre yaz`} />
            <CodingPanel
              questions={codingQuestions}
              results={results}
              simulationId={simulationId}
              language={language}
              onResult={recordResult}
              stacked={split}
            />
          </section>
        )}

        {hasVerbal && (
          <section className={`min-w-0 space-y-4 ${split ? '' : 'max-w-3xl mx-auto w-full'}`}>
            <SectionHeader
              icon={isVoice ? Mic : MessageSquare}
              color={isVoice ? 'bg-orange-500' : 'bg-green-600'}
              title={isVoice ? 'Sözlü Sorular' : 'Sözel Sorular'}
              subtitle={`${verbalQuestions.length} soru • ${isVoice ? 'cevabını konuşarak ver' : 'cevabını yazarak yanıtla'}`}
            />
            <VerbalPanel
              questions={verbalQuestions}
              results={results}
              simulationId={simulationId}
              onResult={recordResult}
              voice={isVoice}
            />
          </section>
        )}
      </div>
    </div>
  );
};

export default Simulation;
