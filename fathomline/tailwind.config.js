/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,html}'],
  theme: {
    extend: {
      colors: {
        deep: '#0a1f2e',
        tide: '#123a4d',
        foam: '#dff3f7',
        coin: '#f4c542',
        pearl: '#c9d6e8',
      },
    },
  },
  plugins: [],
};
