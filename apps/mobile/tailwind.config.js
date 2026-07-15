/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Electric purple — main brand color (matches apps/web)
        primary: { 50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce' },
        // Hot pink — call-to-action pop
        accent: { 400: '#f472b6', 500: '#ec4899', 600: '#db2777' },
        // Acid lime — highlights and badges
        acid: { 200: '#d9f99d', 300: '#bef264', 400: '#a3e635', 500: '#84cc16' },
        ink: '#1e1033',
      },
    },
  },
};
