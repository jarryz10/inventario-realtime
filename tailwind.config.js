/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
      colors: {
        premium: {
          50: '#f8f9fa',
          100: '#eef1f6',
          200: '#dbe2ee',
          300: '#bfccd8',
          400: '#9cb1c5',
          500: '#7d95b0',
          600: '#647b97',
          700: '#52647c',
          800: '#465467',
          900: '#3c4756',
          950: '#252c36',
        }
      }
    },
  },
  plugins: [],
}
