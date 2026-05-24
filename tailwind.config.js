/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        coffee: {
          950: '#110a06',
          900: '#1a0f09',
          800: '#2b1a11',
          700: '#4a3121',
          600: '#6b4630',
        },
        cream: '#fff7eb',
        gold: '#f5b94c',
        ember: '#ff8a4c',
      },
      boxShadow: {
        glow: '0 24px 90px rgba(0, 0, 0, 0.45)',
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
        display: ['Fraunces', 'serif'],
      },
      backgroundImage: {
        grain: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 60%)',
      },
    },
  },
  plugins: [],
};
