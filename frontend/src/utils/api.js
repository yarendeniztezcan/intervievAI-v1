import axios from 'axios';

// Web: boş baseURL -> istekler aynı origin'e gider; geliştirmede Vite proxy'si /api'yi backend'e yönlendirir.
// Mobil (Capacitor) uygulamada sayfa telefonun içinden (http://localhost) servis edilir, bu yüzden
// backend adresi derleme sırasında VITE_API_URL ile verilmelidir (bkz. MOBIL.md).
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
if (!API_URL && window.Capacitor?.isNativePlatform?.()) {
  console.error('VITE_API_URL tanımlı değil: mobil uygulama backend\'e ulaşamaz.');
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Yalnızca oturumu açık kullanıcının token'ı geçersizleşince giriş sayfasına yönlendir.
    // (Giriş formunda yanlış şifre girildiğinde hata mesajı sayfa yenilenmeden gösterilmeli.)
    if (error.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    if (error.response?.status === 429) {
      alert('Çok fazla istek gönderdiniz. Lütfen bekleyin.');
    }
    return Promise.reject(error);
  }
);

// Soru üretimi AI'ya bağlıdır ve ilk kullanımda uzun sürebilir.
export const AI_TIMEOUT = 180000;

export const errorMessage = (error, fallback) => error?.response?.data?.error || fallback;

export default api;
