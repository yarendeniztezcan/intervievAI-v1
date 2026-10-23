import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Volume2, VolumeX, Loader2, Send, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { QuestionMeta, EvaluationResult, tone } from './VerbalParts';
import { errorMessage } from '../utils/api';
import {
  speak, stopSpeaking, startRecording, transcribe, micErrorMessage, voiceSupport, MAX_RECORD_SECONDS
} from '../utils/voice';

const MIN_RECORD_MS = 800;

const questionText = (q) => q.question || q.description || q.title;

const evaluationSpeech = (evaluation) => {
  const parts = [`${tone(evaluation).label}. 10 üzerinden ${evaluation.score} puan.`];
  if (evaluation.feedback) parts.push(evaluation.feedback);
  if (!evaluation.isCorrect && evaluation.correctAnswer) parts.push(`Doğru cevap: ${evaluation.correctAnswer}`);
  return parts.join(' ');
};

/**
 * Sesli (sözlü) soru: AI soruyu seslendirir, kullanıcı mikrofonla cevaplar, konuşma yazıya çevrilip
 * değerlendirilir. VerbalAnswerBox ile aynı arayüze sahiptir (question, onSubmit, children).
 *
 * Aşamalar: speaking -> ready -> recording -> transcribing -> review -> evaluating -> done
 *  - intro: soru metninden önce okunacak giriş ("Birinci soru.")
 */
const VoiceAnswerBox = ({ question, onSubmit, intro = '', children }) => {
  const [phase, setPhase] = useState('speaking');
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [error, setError] = useState('');
  const [showText, setShowText] = useState(true);
  const [talking, setTalking] = useState(false); // AI şu an konuşuyor mu
  const recorder = useRef(null);
  const lastBlob = useRef(null);
  const mounted = useRef(true);
  const talkId = useRef(0);

  // Okur; yalnızca en son başlatılan okuma bittiğinde durumu günceller ve true döner.
  const talk = async (text) => {
    const id = ++talkId.current;
    setTalking(true);
    await speak(text);
    const latest = mounted.current && talkId.current === id;
    if (latest) setTalking(false);
    return latest;
  };

  // Soru açıldığında otomatik okunur.
  useEffect(() => {
    mounted.current = true;
    (async () => {
      const finished = await talk(`${intro} ${questionText(question)}`.trim());
      if (finished) setPhase((p) => (p === 'speaking' ? 'ready' : p));
    })();
    return () => {
      mounted.current = false;
      stopSpeaking();
      recorder.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kayıt süresi sayacı ve en uzun süre sınırı.
  useEffect(() => {
    if (phase !== 'recording') return undefined;
    setSeconds(0);
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === 'recording' && seconds >= MAX_RECORD_SECONDS) stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, phase]);

  const startRec = async () => {
    setError('');
    const support = voiceSupport();
    if (!support.ok) { setError(support.reason); return; }
    talkId.current += 1;
    stopSpeaking();
    setTalking(false);
    setPhase((p) => (p === 'speaking' ? 'ready' : p));
    try {
      recorder.current = await startRecording({ onLevel: (v) => mounted.current && setLevel(v) });
      setPhase('recording');
    } catch (e) {
      setError(micErrorMessage(e));
      setPhase('ready');
    }
  };

  const transcribeBlob = async (blob) => {
    setPhase('transcribing');
    setError('');
    try {
      const text = await transcribe(blob, question.topic || question.title || '');
      if (!mounted.current) return;
      setTranscript(text);
      setPhase('review');
    } catch (e) {
      if (!mounted.current) return;
      setError(errorMessage(e, 'Ses yazıya çevrilemedi. Lütfen tekrar deneyin.'));
      setPhase('ready');
    }
  };

  async function stopRecording() {
    const active = recorder.current;
    recorder.current = null;
    if (!active) return;
    setLevel(0);
    try {
      const { blob, durationMs } = await active.stop();
      if (durationMs < MIN_RECORD_MS || blob.size < 1000) {
        setError('Kayıt çok kısaydı. Mikrofon düğmesine basıp cevabınızı konuşun, bitince tekrar basın.');
        setPhase('ready');
        return;
      }
      lastBlob.current = blob;
      await transcribeBlob(blob);
    } catch (e) {
      setError(micErrorMessage(e));
      setPhase('ready');
    }
  }

  const rerecord = () => {
    setTranscript('');
    setError('');
    lastBlob.current = null;
    setPhase('ready');
  };

  const submit = async () => {
    if (!transcript.trim()) return;
    setPhase('evaluating');
    setError('');
    try {
      const result = await onSubmit(transcript.trim());
      if (!mounted.current) return;
      setEvaluation(result);
      setPhase('done');
      talk(evaluationSpeech(result));
    } catch (e) {
      if (!mounted.current) return;
      setError(errorMessage(e, 'Cevap değerlendirilemedi. Lütfen tekrar deneyin.'));
      setPhase('review');
    }
  };

  const busy = phase === 'transcribing' || phase === 'evaluating';
  const canRecord = phase === 'speaking' || phase === 'ready';
  const ring = phase === 'recording' ? { transform: `scale(${1 + level * 0.6})` } : undefined;
  const mm = String(Math.floor(seconds / 60)).padStart(1, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <div className="card space-y-5">
      <div>
        <QuestionMeta question={question} />
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold mb-2">{question.title}</h3>
          <button
            type="button"
            onClick={() => setShowText((v) => !v)}
            className="shrink-0 text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 cursor-pointer"
          >
            {showText ? <EyeOff size={14} /> : <Eye size={14} />} {showText ? 'Soru metnini gizle' : 'Soru metnini göster'}
          </button>
        </div>
        {showText && <p className="text-gray-700 whitespace-pre-wrap">{questionText(question)}</p>}

        <div className={`mt-3 flex items-center gap-2 text-sm ${phase === 'done' ? 'hidden' : ''}`}>
          {talking ? (
            <button type="button" onClick={() => { stopSpeaking(); setTalking(false); setPhase((p) => (p === 'speaking' ? 'ready' : p)); }}
              className="flex items-center gap-2 px-3 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer">
              <VolumeX size={16} /> <span className="animate-pulse">AI konuşuyor</span> • Durdur
            </button>
          ) : (
            !busy && phase !== 'recording' && (
              <button type="button" onClick={() => talk(questionText(question))}
                className="flex items-center gap-2 px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer">
                <Volume2 size={16} /> Soruyu tekrar dinle
              </button>
            )
          )}
        </div>
      </div>

      {/* Mikrofon alanı */}
      {phase !== 'done' && (
        <div className="flex flex-col items-center gap-3 py-2">
          {(canRecord || phase === 'recording') && (
            <>
              <div className="relative flex items-center justify-center w-28 h-28">
                {phase === 'recording' && (
                  <span className="absolute inset-0 rounded-full bg-red-200 opacity-60 transition-transform duration-100" style={ring} />
                )}
                <button
                  type="button"
                  onClick={phase === 'recording' ? stopRecording : startRec}
                  aria-label={phase === 'recording' ? 'Kaydı bitir' : 'Konuşmaya başla'}
                  className={`relative w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg cursor-pointer transition-colors ${
                    phase === 'recording' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {phase === 'recording' ? <Square size={28} fill="currentColor" /> : <Mic size={32} />}
                </button>
              </div>
              <p className="text-sm text-gray-600 text-center">
                {phase === 'recording'
                  ? <>Dinliyorum… <span className="font-mono">{mm}:{ss}</span> • Bitirince kareye basın</>
                  : 'Cevabınızı söylemek için mikrofona basın'}
              </p>
            </>
          )}

          {phase === 'transcribing' && (
            <p className="flex items-center gap-2 text-gray-600"><Loader2 size={18} className="animate-spin" /> Cevabınız yazıya çevriliyor…</p>
          )}

          {phase === 'review' && (
            <div className="w-full space-y-3">
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-1">Anladığım cevabınız</h5>
                <p className="p-3 bg-gray-50 border rounded-lg whitespace-pre-wrap text-gray-800" data-testid="transcript">{transcript}</p>
              </div>
              <div className="flex gap-2 justify-end flex-wrap">
                <button type="button" onClick={rerecord} className="btn-secondary flex items-center gap-2">
                  <RotateCcw size={16} /> Tekrar kaydet
                </button>
                <button type="button" onClick={submit} className="btn-primary flex items-center gap-2">
                  <Send size={16} /> Cevabı Kontrol Et
                </button>
              </div>
            </div>
          )}

          {phase === 'evaluating' && (
            <p className="flex items-center gap-2 text-gray-600"><Loader2 size={18} className="animate-spin" /> Değerlendiriliyor…</p>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded flex items-center justify-between gap-3 flex-wrap">
          <span>{error}</span>
          {phase === 'ready' && lastBlob.current && (
            <button type="button" onClick={() => transcribeBlob(lastBlob.current)} className="underline cursor-pointer">Aynı kaydı tekrar çöz</button>
          )}
        </div>
      )}

      {evaluation && (
        <div className="space-y-4">
          {transcript && (
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-1">Cevabınız</h5>
              <p className="p-3 bg-gray-50 border rounded-lg whitespace-pre-wrap text-gray-600 text-sm">{transcript}</p>
            </div>
          )}
          <EvaluationResult evaluation={evaluation} />
          <button type="button" onClick={() => (talking ? (stopSpeaking(), setTalking(false)) : talk(evaluationSpeech(evaluation)))}
            className="text-sm text-blue-700 hover:underline flex items-center gap-2 cursor-pointer">
            {talking ? <><VolumeX size={16} /> Okumayı durdur</> : <><Volume2 size={16} /> Değerlendirmeyi dinle</>}
          </button>
          {children?.(evaluation)}
        </div>
      )}
    </div>
  );
};

export default VoiceAnswerBox;
