// Sözlü simülasyon mikrofon kullanır: native projelere gerekli izinleri ekler. Birden çok kez çalıştırmak güvenlidir.
// (android/ ve ios/ klasörleri "npx cap add ..." ile üretilir; yoksa ilgili kısım atlanır.)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const log = (msg) => console.log(`[mobil izinler] ${msg}`);

function patchAndroid() {
  const file = path.join(root, 'android/app/src/main/AndroidManifest.xml');
  if (!fs.existsSync(file)) return log('android/ yok, atlandı.');
  let xml = fs.readFileSync(file, 'utf8');
  const perms = ['android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS'];
  const missing = perms.filter((p) => !xml.includes(`"${p}"`));
  if (!missing.length) return log('Android: mikrofon izinleri zaten var.');
  const lines = missing.map((p) => `    <uses-permission android:name="${p}" />`).join('\n');
  xml = xml.replace('</manifest>', `${lines}\n</manifest>`);
  fs.writeFileSync(file, xml);
  log(`Android: ${missing.length} izin eklendi.`);
}

function patchIos() {
  const file = path.join(root, 'ios/App/App/Info.plist');
  if (!fs.existsSync(file)) return log('ios/ yok, atlandı.');
  let plist = fs.readFileSync(file, 'utf8');
  if (plist.includes('NSMicrophoneUsageDescription')) return log('iOS: mikrofon izni zaten var.');
  const entry = '\t<key>NSMicrophoneUsageDescription</key>\n\t<string>Sözlü simülasyonda cevaplarınızı konuşarak vermek için mikrofon gerekir.</string>\n';
  const index = plist.lastIndexOf('</dict>');
  plist = `${plist.slice(0, index)}${entry}${plist.slice(index)}`;
  fs.writeFileSync(file, plist);
  log('iOS: mikrofon izni eklendi.');
}

patchAndroid();
patchIos();
