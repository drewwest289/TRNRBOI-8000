/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Body / UI text — Space Mono (sentence case, UI labels, data)
        sans:    ['"Space Mono"', 'monospace'],
        mono:    ['"Space Mono"', 'monospace'],
        // Display / titles / large stats — Press Start 2P
        display: ['"Press Start 2P"', 'monospace'],
      },
      colors: {
        // ── Remap slate → design tokens so all existing Tailwind classes
        //    automatically pick up the new palette without JSX changes ───────
        slate: {
          950: '#0B0F1A',   // bg-primary
          900: '#111827',   // bg-panel
          800: '#1A2232',   // panel nested / subtle bg
          700: '#283442',   // border
          600: '#344455',
          500: '#8AA0B2',   // text-muted
          400: '#A8BCCB',
          300: '#C8D8E4',
          200: '#DDE8F0',
          100: '#EEF4F8',
        },
        // Remap emerald → brand green
        emerald: {
          400: '#7CFF9E',
          500: '#7CFF9E',
          600: '#5ECC7E',
        },
        // text-white / bg-white → spec text-primary with green tint
        white: '#E6F5E6',
        // Remap red
        red: {
          400: '#FF5C5C',
          500: '#FF5C5C',
          600: '#CC4444',
        },
        // orange → achievements yellow
        orange: {
          400: '#FFD44D',
          500: '#FFD44D',
        },
        // Named semantic tokens for new class usage
        green:  '#7CFF9E',
        blue:   '#4DA3FF',
        purple: '#B36BFF',
      },
    },
  },
  plugins: [],
}
