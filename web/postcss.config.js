// postcss.config.js
export default {
  plugins: {
    '@tailwindcss/postcss': {}, // <-- ¡CORREGIDO AQUÍ! Usar el nuevo paquete
    autoprefixer: {},
  },
}
