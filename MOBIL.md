# Mobil uygulama (Android / iOS) ve PWA

Aynı React kodu iki şekilde telefona gelir:

1. **PWA (en kolay):** Siteyi yayınlayınca telefonun tarayıcısından "Ana ekrana ekle" ile uygulama gibi açılır. Ek kurulum gerekmez (`manifest.webmanifest` ve ikonlar eklendi). HTTPS gerekir.
2. **Gerçek uygulama (Capacitor):** Aynı web derlemesi Android Studio / Xcode projesine sarılır; mağazaya yüklenebilir.

Kod yeniden yazılmadı: giriş, simülasyon, sözel sorular, profil aynen çalışır. Telefon dar ekranda simülasyon sol/sağ yerine alt alta dizilir, menüde yalnızca ikonlar görünür.

## Gerekli araçlar

| Araç | Ne için | Not |
|---|---|---|
| **Node.js 22+** | Capacitor 8 gerektirir | `node -v` ile kontrol edin |
| **Android Studio** | Android uygulaması | JDK 21 ve Android SDK ile gelir |
| **Xcode** (yalnızca macOS) | iOS uygulaması | Windows'ta iOS derlenemez; Android veya PWA kullanın |
| `npm install` | `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios` | `package.json`'a eklendi |

## Kurulum (bir kez)

```bash
cd frontend
npm install
cp .env.mobile.example .env.mobile     # VITE_API_URL'yi düzenleyin (aşağıya bakın)
npm run build:mobile                   # derler ve native projeye kopyalar
npx cap add android                    # android/ klasörünü oluşturur (iOS için: npx cap add ios)
npm run mobile:icons                   # (isteğe bağlı) uygulama ikonu ve açılış ekranını üretir
npm run android                        # Android Studio'yu açar -> ▶ Run
```

Web kodunu her değiştirdiğinizde: `npm run build:mobile` yeterlidir (kopyalamayı o yapar), sonra Android Studio'dan tekrar çalıştırın.

## Backend adresi (en sık takıldığınız yer)

Telefonda `localhost` **telefonun kendisidir**. `frontend/.env.mobile` içindeki `VITE_API_URL` şöyle olmalı:

| Nerede çalışıyor | VITE_API_URL |
|---|---|
| Gerçek telefon, aynı Wi-Fi | `http://BILGISAYARIN_IP:3001` (ör. `http://192.168.1.25:3001`) |
| Android emülatörü | `http://10.0.2.2:3001` |
| iOS simülatörü | `http://localhost:3001` |
| Yayın | `https://api.siteniz.com` |

- Bilgisayarın IP'sini Windows'ta `ipconfig`, macOS/Linux'ta `ifconfig`/`ip a` ile bulun.
- Bilgisayarın güvenlik duvarı 3001 portuna izin vermeli.
- Backend `3001`'de çalışıyor olmalı (`cd backend && npm run dev`). Backend zaten tüm arayüzleri dinler.
- Geliştirme için HTTP'ye izin verilmiştir (`capacitor.config.json` → `cleartext`). **Mağazaya çıkarken HTTPS kullanın** ve `cleartext` ile `androidScheme` ayarlarını kaldırın/`https` yapın.

Backend, mobil uygulamanın kaynaklarını (`http://localhost`, `https://localhost`, `capacitor://localhost`) CORS'ta otomatik kabul eder. Web sitenizi başka bir adreste yayınlarsanız `backend/.env` içine ekleyin:

```
FRONTEND_URL=https://siteniz.com
CORS_ORIGINS=https://www.siteniz.com
```

## Bilinen noktalar

- **Kod editörü (Monaco)** telefonda çalışır ama dar ekranda uzun kod yazmak zordur; dokunmatik klavye açıkken görünür alan azalır. Sözel sorular mobilde sorunsuzdur.
- Monaco dosyalarını CDN'den yükler: uygulama **internet bağlantısı** ister (zaten AI için gerekli).
- Giriş bilgisi (token) uygulamanın içinde saklanır; uygulama silinince çıkış yapılmış olur.
- Android sürümü, iOS bundle kimliği ve uygulama adı için `frontend/capacitor.config.json` içindeki `appId` / `appName` değerlerini yayın öncesi kendinize göre değiştirin.
