// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Configuración explícita para PostCSS (¡CRUCIAL PARA TAILWIND!)
  css: {
    postcss: './postcss.config.js', // Indica a Vite dónde encontrar tu configuración de PostCSS
  },
  // Configuración del servidor de desarrollo y proxy (para Laravel)
  server: {
    host: 'localhost',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000', // Asegúrate de que coincida con tu servidor Laravel
        changeOrigin: true,
        secure: false, // Cambia a true si tu backend usa HTTPS
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
});
