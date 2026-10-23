# InterviewAI - Mülakat Hazırlık Platformu

AI destekli kodlama ve sözel mülakat pratiği platformu. Sorular seçtiğin ders ve seviyeye göre yapay zeka tarafından üretilir, cevapların değerlendirilir; yanlış cevapta doğru cevap gösterilir ve aynı konudan benzer bir soru sorulur.

## Özellikler

- **Bölünmüş simülasyon ekranı (Karma):** solda kod soruları (editör + test çalıştırma), sağda sözel sorular.
- **Sözel sorular:** AI soruyu üretir → cevabını yazarsın → AI kontrol eder → yanlışsa **doğru cevap gösterilir** ve aynı konudan **benzer soru** gelir.
- **Konu seçimi:** Sorular yalnızca seçtiğin derslerin konularından üretilir (ör. *Mantıksal Devre Tasarımı* seçtiysen "Flip-flopların kullanım amacı ve yerleri nelerdir?" gibi sorular gelir).
- **Sözel dersler:** Mantıksal Devre Tasarımı, İşletim Sistemleri, Bilgisayar Mimarisi ve Organizasyonu, Bilgisayar Ağları, Veri Yapıları.
- **Seviyeler:** Junior / Mid-Level / Senior (soru tarzını ve zorluğunu belirler).
- Kod çalıştırma (Python, C, Java), aşamalı ipucu, serbest soru gezinmesi, puanlama, profil ve zayıf konu raporu.
- Profilden doğru / yanlış cevaplanan soruları tekrar çözme.
- **Sözlü simülasyon:** AI "birinci soru" diyerek soruyu sesli sorar, sen mikrofonla konuşarak cevaplarsın (yazı yok). Konuşman yazıya çevrilip onayına sunulur, değerlendirilir; yanlışta doğru cevap okunur ve benzer soru gelir. Bitirince sonuçlar yazılı simülasyonla aynıdır. Bkz. [SOZLU.md](SOZLU.md).
- **Mobil:** Android / iOS uygulaması (Capacitor) ve PWA desteği — bkz. [MOBIL.md](MOBIL.md).

## Klasör yapısı

```
.
├── backend/                 Express + SQLite API
│   ├── src/
│   │   ├── config.js        Ortam değişkenleri (JWT_SECRET vb.) tek yerde
│   │   ├── index.js         Uygulama girişi
│   │   ├── data/            subjects.js (ders/konu kataloğu), questions.js (eski sorular)
│   │   ├── middleware/      auth, errorHandler, logger
│   │   ├── models/          database.js (tablolar ve sorgu yardımcıları)
│   │   ├── routes/          users, subjects, questions, ai, execute
│   │   └── services/        ai.js (soru üretimi/değerlendirme), sandbox.js (kod çalıştırma)
│   ├── tests/               Jest + Supertest
│   ├── .env.example
│   └── Dockerfile
├── frontend/                React + Vite + Tailwind
│   ├── src/
│   │   ├── components/      Navbar, CodeEditor, CodingPanel, VerbalPanel, VerbalAnswerBox, QuestionNavigator
│   │   ├── pages/           Home, Login, Register, SimulationSetup, Simulation, Results, Profile, RedoQuestions
│   │   ├── utils/           api.js, auth.js, constants.js
│   │   └── styles/
│   └── Dockerfile
├── docker-compose.yml
├── SOZLU.md                 Sözlü (sesli) simülasyon: nasıl çalışır, ayarlar
├── MOBIL.md                 Mobil uygulama / PWA kurulumu
└── DEGISIKLIKLER.md         Yeniden düzenlemede neyin değiştiği
```

## Kurulum (yerel)

Gereksinimler: **Node.js 20.19+** (veya 22), Kod çalıştırma için sisteminde `python3`, `gcc` ve `javac`.

```bash
# 1) Backend
cd backend
cp .env.example .env        # OPENAI_API_KEY ve JWT_SECRET değerlerini doldurun
npm install
npm run dev                 # http://localhost:3001

# 2) Frontend (yeni terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Frontend, `/api` isteklerini Vite proxy'si ile `localhost:3001`'e iletir; ek bir ayar gerekmez.
Veritabanı tabloları backend ilk açıldığında otomatik oluşturulur / güncellenir.

> **Not:** Sorular OpenAI ile üretildiği için `OPENAI_API_KEY` olmadan yeni soru üretilemez. Kod editörü (Monaco) dosyalarını internetten (CDN) yükler.

## Docker

```bash
cp .env.example .env        # OPENAI_API_KEY ve JWT_SECRET değerlerini doldurun
docker compose up --build
```

Frontend: http://localhost:5173 • Backend: http://localhost:3001 • Veritabanı `backend-data` volume'unda saklanır.

## Testler

```bash
cd backend && npm test
```

Testler OpenAI'yi taklit ederek sözel akışı uçtan uca doğrular (soru üretimi, konu kapsamı, yanlış cevapta doğru cevabın dönmesi, benzer soru, karma simülasyon).

## Yeni ders veya konu ekleme

Ders ve konular tek bir dosyada tutulur: `backend/src/data/subjects.js`. `VERBAL_SUBJECTS` (veya `CODING_SUBJECTS`) içine bir kayıt eklemek yeterlidir; kurulum ekranı listeyi `/api/subjects` üzerinden okur ve AI, soruları dersin `topics` listesindeki konulara dağıtarak üretir.

```js
networks: {
  name: 'Bilgisayar Ağları',
  topics: ['OSI ve TCP/IP katmanları', 'TCP ve UDP farkları', /* ... */]
}
```

## Sorular nasıl çalışır?

1. Simülasyon başlarken, seçilen derslerden kullanıcının daha önce görmediği hazır AI soruları seçilir; eksik kalanlar dersin konularına dağıtılarak yeni üretilir ve SQLite'a kaydedilir (SHA-256 ile tekrar önlenir).
2. Sözel cevap backend'de değerlendirilir (10 üzerinden; 7 ve üstü doğru). Sorunun ideal cevabı, cevap verilmeden istemciye gönderilmez.
3. Yanlış cevapta doğru cevap gösterilir, arka planda aynı ders/konudan benzer soru üretilir. Bir soru için en fazla 5 benzer soru istenir.
4. İlk denemede doğru cevap tam puan, benzer soruda doğru cevap kısmi puan (5) verir.
5. Cevaplar ve denemeler soruyla ayrı saklanır; profilden tekrar çözülebilir.

`database.sqlite`, `.env`, API anahtarları ve `node_modules` asla commit edilmemelidir (`.gitignore` bunları dışarıda bırakır).
