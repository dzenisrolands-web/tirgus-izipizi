/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Museo Sans"', '"Mulish"', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#E8FFF3',
          100: '#D0F9E4',
          200: '#A0F3C9',
          300: '#70EDAE',
          400: '#53F3A4',  // primary mint
          500: '#3DD88E',
          600: '#1ec97b',  // mint-deep
          700: '#15A563',
          800: '#0D7A4A',
          900: '#064F31',
        },
        violet: {
          50:  '#F3E8FF',
          100: '#E2D0F9',
          200: '#C5A1F3',
          300: '#B878ED',
          400: '#AD47FF',  // primary violet
          500: '#9333EA',
          600: '#7928CA',
          700: '#5F1FA8',
          800: '#451786',
          900: '#2C0F64',
        },
        navy: {
          DEFAULT: '#192635',
          soft: '#22344a',
          dark: '#0f1e2d',
        },
      },
    },
  },
};
