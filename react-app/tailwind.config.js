/** @type {import('tailwindcss').Config} */
// Tokens del design system (mockup "Fridge Tracker" de Claude Design,
// 2026-07-26): tema claro, marino #1F3A5F + cian #12B5C9, tarjetas blancas
// con borde suave, pastillas de estatus con punto de color, Roboto.
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        marino: {
          DEFAULT: '#1F3A5F', // barra de app, sidebar, botón primario
          900: '#16293F', // titulares
          700: '#2E4E75', // avatar / hover sobre marino
          300: '#A9BDD1', // texto secundario sobre marino
          100: '#EAF1F7', // fondo de icono marino
        },
        cian: {
          DEFAULT: '#12B5C9', // acento principal
          600: '#0E8FA3',
          700: '#0B6E7D',
          300: '#7FE3EF', // acento sobre marino
          100: '#E1F3F6',
          50: '#EAF6F8',
        },
        lienzo: '#F5FAFC', // fondo de la app (móvil)
        panel: '#F1F5F8', // fondo de áreas de escritorio
        borde: '#E4EDF2', // borde de tarjetas
        divisor: '#EEF3F6', // divisores internos
        tinta: {
          DEFAULT: '#16293F', // texto principal
          2: '#5C6B76', // texto secundario
          3: '#8A99A3', // texto atenuado / etiquetas
        },
        exito: { bg: '#E4F5EC', tx: '#1E7A44', dot: '#2E9E5B' },
        alerta: { bg: '#FBF0DC', tx: '#9A6410', dot: '#E0952B', borde: '#F2DFA8' },
        refur: { bg: '#E3F2F6', tx: '#16697A' },
        peligro: { bg: '#F1E7E9', tx: '#8A2F3D', dot: '#B23A48' },
        oscuro: { DEFAULT: '#101820', 800: '#26313B', tx: '#CBD8E0' }, // pantalla de escaneo
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        carta: '0 2px 6px rgba(31,58,95,.05)',
        marino: '0 10px 22px rgba(31,58,95,.28)',
        cian: '0 12px 26px rgba(14,143,163,.34)',
      },
      borderRadius: {
        carta: '16px',
      },
    },
  },
  plugins: [],
};
