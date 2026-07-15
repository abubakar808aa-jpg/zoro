/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Electric purple — main brand color
        primary: {
          50:  '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          900: '#581c87',
        },
        // Hot pink — call-to-action pop
        accent: {
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
        },
        // Acid lime — highlights, stickers, hover states
        acid: {
          200: '#d9f99d',
          300: '#bef264',
          400: '#a3e635',
          500: '#84cc16',
        },
        violet: {
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
        },
        ink: '#1e1033',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'pop-sm': '3px 3px 0 0 #1e1033',
        'pop':    '5px 5px 0 0 #1e1033',
        'pop-lg': '8px 8px 0 0 #1e1033',
        'pop-pink': '5px 5px 0 0 #ec4899',
        'pop-lime': '5px 5px 0 0 #a3e635',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
        float: 'float 4s ease-in-out infinite',
        wiggle: 'wiggle 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
