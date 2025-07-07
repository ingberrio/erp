/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          'primary-dark': '#2a365a',
          'button-blue': '#4a69bb',
          'button-blue-dark': '#3a57a0',
          'app-bg': '#1a202c',
          'header-text': '#fff', // Un blanco muy ligero para asegurar visibilidad en fondos oscuros
        },
        fontFamily: {
          inter: ['Inter', 'sans-serif'],
        },
        keyframes: {
          'bounce-once': {
            '0%, 100%': {
              transform: 'translateY(0)',
              animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)',
            },
            '50%': {
              transform: 'translateY(-10px)',
              animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
            },
          },
        },
        animation: {
          'bounce-once': 'bounce-once 1s ease-in-out 1',
        },
      },
    },
    plugins: [],
  }
  