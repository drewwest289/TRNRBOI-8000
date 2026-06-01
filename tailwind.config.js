/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Press Start 2P"', 'monospace'],
        mono: ['"Press Start 2P"', 'monospace'],
      },
    },
  },
  plugins: [],
}
