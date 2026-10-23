# Sözlü (sesli) simülasyon

Kurulum ekranında **Sözlü** sekmesini seç → soru sayısı ve ders (ör. Mantıksal Devre Tasarımı) → Başla.

## Akış

1. **Başla** ekranı: tıklayınca mikrofon izni istenir ve ses açılır (tarayıcılar sesi tıklamasız başlatmaz).
2. AI soruyu seslendirir: *"Birinci soru. Flip-flopların kullanım amacı ve yerleri nelerdir?"*
3. Mikrofon düğmesine bas, cevabını konuş, bitince kare düğmesine bas. Soru okunurken de basarak AI'yı susturup hemen konuşabilirsin.
4. Konuşman yazıya çevrilir ve **"Anladığım cevabınız"** olarak gösterilir. Yanlış anlaşıldıysa *Tekrar kaydet*, doğruysa *Cevabı Kontrol Et*.
5. AI değerlendirir ve sonucu sesli okur. Yanlışsa **doğru cevap** da okunur; *Benzer soruya geç* ile aynı konudan yeni soru gelir.
6. **Bitir** / **Sonuçları Gör**: sonuçlar yazılı simülasyonla aynıdır (puan, zayıf konular, profil geçmişi; türü "Sözlü" görünür).

Sorular yazılı sözel sorularla aynı havuzdan gelir; ders ve konu seçimi aynı çalışır. Soru metni ekranda da görünür (istersen *Soru metnini gizle* ile kapatabilirsin).

## Teknik

| Parça | Nasıl |
|---|---|
| Kayıt | Tarayıcıda `MediaRecorder` (webm/mp4), en fazla 3 dakika |
| Ses → yazı | `POST /api/speech/transcribe` → OpenAI `gpt-4o-mini-transcribe` (Türkçe, soru konusu ipucu olarak verilir) |
| Yazı → ses | `POST /api/speech/speak` → OpenAI `gpt-4o-mini-tts`; olmazsa tarayıcının Türkçe sesi |
| Değerlendirme | Yazılı sözel sorularla aynı `verbal-answer` uç noktası |

Modeller `backend/.env` ile değiştirilebilir (hepsi isteğe bağlı):

```
OPENAI_STT_MODEL=gpt-4o-mini-transcribe
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=alloy
```

Her soru için yaklaşık 4 OpenAI isteği yapılır (soruyu okuma, yazıya çevirme, değerlendirme, geri bildirimi okuma); ses istekleri sohbet isteklerinden ayrı ücretlendirilir.

## Dikkat

- **Mikrofon yalnızca `https://` veya `localhost` adreslerinde çalışır.** Bilgisayardaki siteyi telefondan `http://192.168.x.x:5173` ile açarsan tarayıcı mikrofonu engeller; telefonda Android/iOS uygulamasını ya da HTTPS ile yayınlanmış siteyi kullan.
- Mobil uygulamada mikrofon izinleri `npm run build:mobile` ve `npm run android` / `npm run ios` komutlarıyla otomatik eklenir (`frontend/scripts/patch-native.cjs`). İlk açılışta telefon izin sorar.
- Konuşma tanıma gürültüde ve teknik terimlerde hata yapabilir; bu yüzden cevap göndermeden önce yazıya çevrilmiş hali gösterilir.
