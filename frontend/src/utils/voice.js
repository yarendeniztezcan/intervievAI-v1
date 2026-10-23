import api, { AI_TIMEOUT } from './api';

/* ---------------- Mikrofon (kayıt) ---------------- */

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export const MAX_RECORD_SECONDS = 180;

/** Bu cihaz/tarayıcı ses kaydını destekliyor mu? (mikrofon yalnızca HTTPS veya localhost'ta çalışır) */
export const voiceSupport = () => {
  if (typeof window === 'undefined') return { ok: false, reason: 'Ses desteklenmiyor.' };
  if (!window.isSecureContext) {
    return { ok: false, reason: 'Mikrofon yalnızca güvenli bağlantıda (HTTPS veya localhost) çalışır.' };
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    return { ok: false, reason: 'Bu tarayıcı ses kaydını desteklemiyor. Güncel Chrome, Edge veya Safari kullanın.' };
  }
  return { ok: true, reason: '' };
};

export const micErrorMessage = (error) => {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Mikrofon izni verilmedi. Tarayıcı veya telefon ayarlarından mikrofona izin verip tekrar deneyin.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Mikrofon bulunamadı. Bir mikrofon bağlı olduğundan emin olun.';
    case 'NotReadableError':
      return 'Mikrofon açılamadı; başka bir uygulama kullanıyor olabilir.';
    default:
      return error?.message || 'Mikrofon açılamadı.';
  }
};

/** İzni baştan ister (kullanıcı tıklamasıyla çağrılmalı) ve mikrofonu hemen kapatır. */
export const requestMic = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((t) => t.stop());
};

/**
 * Kaydı başlatır. Dönüş: { stop(): Promise<{blob, durationMs}>, cancel() }
 * onLevel(0..1): anlık ses seviyesi (animasyon için).
 */
export async function startRecording({ onLevel } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true }
  });
  const mimeType = MIME_CANDIDATES.find((m) => window.MediaRecorder.isTypeSupported?.(m));
  const recorder = new window.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };

  let ctx = null;
  let raf = 0;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx();
    ctx.resume?.();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      onLevel?.(Math.min(1, peak / 64));
      raf = requestAnimationFrame(tick);
    };
    tick();
  } catch { /* seviye göstergesi isteğe bağlıdır */ }

  const cleanup = () => {
    cancelAnimationFrame(raf);
    ctx?.close?.().catch(() => {});
    stream.getTracks().forEach((t) => t.stop());
  };

  recorder.start(250);
  const startedAt = Date.now();

  return {
    stop: () => new Promise((resolve, reject) => {
      recorder.onerror = (e) => { cleanup(); reject(e.error || e); };
      recorder.onstop = () => {
        cleanup();
        resolve({
          blob: new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }),
          durationMs: Date.now() - startedAt
        });
      };
      if (recorder.state !== 'inactive') recorder.stop();
      else recorder.onstop();
    }),
    cancel: () => {
      recorder.onstop = null;
      try { if (recorder.state !== 'inactive') recorder.stop(); } catch { /* zaten durmuş */ }
      cleanup();
    }
  };
}

/** Ses kaydını backend üzerinden yazıya çevirir. */
export async function transcribe(blob, hint = '') {
  const { data } = await api.post(`/api/speech/transcribe?hint=${encodeURIComponent(hint)}`, blob, {
    headers: { 'Content-Type': blob.type || 'audio/webm' },
    timeout: AI_TIMEOUT
  });
  return data.text;
}

/* ---------------- Konuşma (yapay zeka sesi) ---------------- */

// Tek bir <audio> öğesi kullanılır; iOS/Chrome otomatik oynatma kısıtı için ilk tıklamada "açılır".
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
let player = null;
let session = 0; // her yeni konuşma/durdurma eskisini geçersiz kılar

const getPlayer = () => {
  if (!player) player = new Audio();
  return player;
};

/** Kullanıcı tıklamasıyla çağrılmalı: sonraki sesli okumaların engellenmesini önler. */
export const unlockAudio = () => {
  try {
    const p = getPlayer();
    p.src = SILENT_WAV;
    p.play()?.catch(() => {});
  } catch { /* ses yoksa sessizce devam */ }
};

export const stopSpeaking = () => {
  session += 1;
  try { player?.pause(); } catch { /* yoksay */ }
  window.speechSynthesis?.cancel();
};

const playBlob = (blob, id) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(blob);
  const p = getPlayer();
  const done = (error) => {
    p.onended = p.onerror = p.onpause = null;
    URL.revokeObjectURL(url);
    if (error) reject(error); else resolve();
  };
  p.onended = () => done();
  p.onpause = () => { if (!p.ended) done(); }; // stopSpeaking() ile durdurulduysa
  p.onerror = () => done(new Error('Ses oynatılamadı'));
  p.src = url;
  p.play().catch((e) => done(e));
  if (id !== session) done();
});

const speakWithBrowser = (text) => new Promise((resolve) => {
  const synth = window.speechSynthesis;
  if (!synth || typeof window.SpeechSynthesisUtterance === 'undefined') { resolve(); return; }
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = 'tr-TR';
  utterance.rate = 0.95;
  const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith('tr'));
  if (voice) utterance.voice = voice;
  utterance.onend = utterance.onerror = () => resolve();
  synth.speak(utterance);
});

/**
 * Metni sesli okur; okuma bitince (ya da durdurulunca) çözülür, asla hata fırlatmaz.
 * Önce OpenAI sesi, olmazsa tarayıcının kendi Türkçe sesi kullanılır.
 */
export async function speak(text) {
  stopSpeaking();
  const id = session;
  const clean = String(text || '').trim();
  if (!clean) return;
  try {
    const { data } = await api.post('/api/speech/speak', { text: clean }, { responseType: 'blob', timeout: 60000 });
    if (id !== session) return;
    await playBlob(data, id);
    return;
  } catch {
    if (id !== session) return;
  }
  await speakWithBrowser(clean);
}
