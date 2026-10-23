const { OpenAI, toFile } = require('openai');
const { OPENAI_STT_MODEL, OPENAI_TTS_MODEL, OPENAI_TTS_VOICE } = require('../config');

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const httpError = (status, message) => Object.assign(new Error(message), { status });

const MAX_SPEAK_CHARS = 1500;
const MIN_AUDIO_BYTES = 1000; // bundan küçük kayıt boş sayılır

// Tarayıcının/telefonun gönderdiği MIME türünden OpenAI'nin tanıdığı dosya uzantısı.
function extensionFor(mime = '') {
  const m = mime.toLowerCase();
  if (m.includes('webm')) return 'webm';
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'mp4';
  if (m.includes('ogg') || m.includes('opus')) return 'ogg';
  if (m.includes('wav')) return 'wav';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  return 'webm';
}

/** Ses kaydını yazıya çevirir. `hint` (soru başlığı/konusu) teknik terimlerin doğru yazılmasına yardım eder. */
async function transcribeAudio(buffer, mime, hint = '') {
  if (!client) throw httpError(503, 'OPENAI_API_KEY tanımlı değil');
  if (!buffer || buffer.length < MIN_AUDIO_BYTES) throw httpError(400, 'Kayıt çok kısa veya boş. Lütfen tekrar konuşun.');

  const ext = extensionFor(mime);
  let text;
  try {
    const result = await client.audio.transcriptions.create({
      file: await toFile(buffer, `cevap.${ext}`, { type: mime || `audio/${ext}` }),
      model: OPENAI_STT_MODEL,
      language: 'tr',
      prompt: hint ? `Teknik bir mülakat cevabı. Konu: ${hint}`.slice(0, 300) : undefined
    });
    text = (result.text || '').trim();
  } catch (error) {
    console.error('Ses yazıya çevrilemedi:', error.message);
    throw httpError(502, 'Ses yazıya çevrilemedi. Lütfen tekrar deneyin.');
  }
  if (!text) throw httpError(422, 'Ses anlaşılamadı. Biraz daha yüksek sesle ve net konuşup tekrar deneyin.');
  return text;
}

/** Metni Türkçe konuşmaya çevirir (mp3 Buffer döner). */
async function synthesizeSpeech(text) {
  if (!client) throw httpError(503, 'OPENAI_API_KEY tanımlı değil');
  const input = String(text || '').trim().slice(0, MAX_SPEAK_CHARS);
  if (!input) throw httpError(400, 'Okunacak metin boş');
  try {
    const response = await client.audio.speech.create({
      model: OPENAI_TTS_MODEL,
      voice: OPENAI_TTS_VOICE,
      input,
      instructions: 'Türkçe konuş. Sakin, net ve profesyonel bir mülakatçı gibi, orta hızda oku.',
      response_format: 'mp3'
    });
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.error('Konuşma üretilemedi:', error.message);
    throw httpError(502, 'Konuşma üretilemedi.');
  }
}

module.exports = { transcribeAudio, synthesizeSpeech, extensionFor, MAX_SPEAK_CHARS };
