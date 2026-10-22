import axios from 'axios';

// Boş baseURL: istekler aynı origin'e gider; geliştirmede Vite proxy'si /api'yi backend'e yönlendirir.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
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
