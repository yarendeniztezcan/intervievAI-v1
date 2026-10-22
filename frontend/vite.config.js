import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Geliştirmede /api istekleri backend'e yönlendirilir (CORS gerekmez).
// Docker'da VITE_PROXY_TARGET=http://backend:3001 olarak ayarlanır.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
