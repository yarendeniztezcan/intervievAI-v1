# Yeniden düzenleme raporu

## 1) Eksik olan dosyalar (eklendi)

| Dosya | Neden gerekliydi |
|---|---|
| `frontend/package.json` (+ lock) | Frontend'in bağımlılık listesi hiç yoktu; kök `package.json` backend'e aitti. Frontend kurulamıyordu. |
| `backend/.env.example` | README bu dosyadan bahsediyordu ama repoda yoktu. |
| `.gitignore` | `database.sqlite` (kullanıcı hesapları dahil), `logs/` ve IDE dosyaları repoya girmişti. |
| `backend/Dockerfile`, `frontend/Dockerfile` | `docker-compose.yml` `./backend` ve `./frontend` klasörlerini derliyordu ama bu klasörler ve Dockerfile'ları yoktu. Eski tek Dockerfile `node:18-alpine` idi ve `python3/gcc/java` olmadığı için kod çalıştırma Docker içinde çalışamazdı. |
| `frontend/public/favicon.svg` | `index.html` `/vite.svg` dosyasına bakıyordu, dosya yoktu. |
| `backend/tests/*` içindeki geçerli testler | Eski testler token göndermeden korumalı endpoint'leri çağırıyordu (hep 401 alırdı) ve vitest ayarı (`src/test/setup.js`) dosyası yoktu. |

## 2) Fazla / yinelenen dosyalar (kaldırıldı)

| Dosya | Durum |
|---|---|
| `components/Login.jsx`, `components/Register.jsx`, `components/SimulationSetup.jsx` | `pages/` içindekilerle **birebir aynı** (hash'leri eşit). Yalnızca `pages/` kaldı. |
| `tests/New Text Document.txt`, `tests/New Text Document - Copy.txt` | Boş dosyalar. |
| `InterviewAI.iml`, `Project_Default.xml`, `modules.xml`, `workspace.xml` | IntelliJ/IDE ayar dosyaları (kişisel yol bilgisi içeriyor). `.gitignore`'a eklendi. |
| `KOMUTLAR.txt` | Kişisel `C:\Users\...` yolları içeren komutlar; yerine README'deki kurulum bölümü geldi. |
| `logs/access.log` | Kodda hiçbir yerde yazılmıyor; üretilmiş çıktı dosyası. |
| `database.sqlite` | Veritabanı repoda tutulmamalı (2 kullanıcının şifre hash'lerini içeriyor). Yerel kopyan sende kalıyor; yeni klasörde `backend/database.sqlite` yoluna koyabilirsin (şema uyumlu, 97 soru korunur). |
| `components/QuestionCard.jsx` | Hiçbir yerden import edilmiyordu. |
| `components/VerbalQuestion.jsx`, `pages/CodingSimulation.jsx`, `pages/VerbalSimulation.jsx`, `pages/MixedSimulation.jsx` | Üç sayfa aynı mantığı (bitirme, gezinme, benzer soru) kopyalıyordu. Yerine tek `Simulation.jsx` + `CodingPanel` + `VerbalPanel` + `VerbalAnswerBox` geldi. |
| `tailwind.config.js` | Tailwind v4'te gerekli değil (içindeki renkler kullanılmıyordu). |
| `weak_topics` tablosu | Hiç kullanılmıyordu; yeni kurulumda oluşturulmuyor (mevcut DB'de zararsızca durur). |

## 3) Yeni yer haritası

| Eski | Yeni |
|---|---|
| `src/**`, `tests/` , kök `package.json`, `Dockerfile` | `backend/src/**`, `backend/tests/`, `backend/package.json`, `backend/Dockerfile` |
| `App.jsx`, `main.jsx`, `index.html`, `vite.config.js` | `frontend/src/App.jsx`, `frontend/src/main.jsx`, `frontend/index.html`, `frontend/vite.config.js` |
| `components/`, `pages/`, `utils/`, `styles/` | `frontend/src/components/`, `pages/`, `utils/`, `styles/` |

`main.jsx` ve `App.jsx` kökte duruyordu ama `index.html` `/src/main.jsx` istiyordu; yeni düzende yollar tutarlı.

## 4) Yeni: simülasyon sayfası (sol kod / sağ sözel)

- **Sol:** mevcut kod simülasyonu (soru gezgini + editör). **Sağ:** sözel sorular.
- Kurulum ekranında Kod / Sözel / Karma seçilir; **her bölüm için soru sayısı ve ders ayrı** seçilir.
- Sözel akış: AI soru üretir → cevap kutusuna yazılır → AI kontrol eder → **yanlışsa doğru cevap gösterilir** → "Benzer soruya geç" ile aynı konudan yeni soru gelir.
- Konu kataloğu `backend/src/data/subjects.js`: *Mantıksal Devre Tasarımı* (flip-flop, sayaç, register, FSM...), *İşletim Sistemleri*, *Bilgisayar Mimarisi ve Organizasyonu* ve diğer dersler. AI artık dersin adını ve belirli bir alt konuyu alıyor (eskiden sadece `logic` gibi bir kimlik gidiyordu).

## 5) Bulunup düzeltilen hatalar

- `VerbalQuestion.jsx` `HelpCircle` ikonunu import etmiyordu; 4–6 puan alan cevapta sayfa çöküyordu.
- Sözel yanlış cevapta doğru cevap hiç gösterilmiyordu ve benzer soru geri bildirim görülmeden ekrana basılıyordu.
- Sözel sorunun ideal cevabı (`solution`) cevaplanmadan tarayıcıya gönderiliyordu; artık gizli.
- AI erişilemezse cevap "0 puan / yanlış" kaydediliyordu; artık hata gösterilir ve deneme kaydedilmez.
- Giriş formunda yanlış şifre girilince 401 yönlendirmesi sayfayı yenileyip hata mesajını yutuyordu.
- Giriş yapmadan simülasyon sayfalarına girilebiliyordu; artık giriş sayfasına yönlendirilir.
- Profilde simülasyon geçmişi `undefined soru` gösteriyordu (alan adı uyuşmazlığı) ve skorlar ondalıklı geliyordu.
- `uuid@14` yalnızca ESM; `require()` ile Node 18'de ve Jest'te çalışmıyordu (Node 20.19+/22.12+ bunu tolere eder). Node'un yerleşik `crypto.randomUUID()` fonksiyonuna geçildi, bağımlılık kaldırıldı.
- İstek zaman aşımı 30 sn idi; ilk kez 10+ AI sorusu üretmek bunu aşıyordu. Soru üretimi artık paralel (3 eşzamanlı) ve zaman aşımı 180 sn.
- Kod çalıştırıcıdaki yasaklı kalıp denetimi kelime sınırı olmadan çalışıyordu (`retrieval(` gibi meşru kod da engelleniyordu); düzeltildi.
- Kullanıcı adı çakışmasında kayıt 500 hatası veriyordu; 409 döner.
- `docker-compose.yml` backend'e `/var/run/docker.sock` bağlıyordu (kullanılmıyordu ve ciddi bir güvenlik riski); kaldırıldı.
- `JWT_SECRET` varsayılanı (`your-secret-key`) iki dosyada kopyaydı ve production'da da geçerliydi; tek yerde (`config.js`) toplandı, production'da zorunlu.

## 6) Doğrulama

- Backend: 16 Jest testi geçiyor (OpenAI taklit edilerek sözel akış uçtan uca).
- Frontend: temiz `npm ci` + `vite build` başarılı.
- Gerçek tarayıcıda (Chromium) sahte bir OpenAI sunucusuyla uçtan uca denendi: kayıt → kurulum → karma simülasyon (yan yana) → yanlış cevap → doğru cevap görünümü → benzer soru → doğru cevap → sonuç → profil.
- Mevcut `database.sqlite` yeni backend ile açıldı (97 soru korundu).
- **Test edilemedi:** Docker imajlarının derlenmesi (bu ortamda Docker sunucusu yok; yalnızca `docker-compose.yml` sözdizimi doğrulandı) ve gerçek OpenAI ile üretilen soruların kalitesi.
