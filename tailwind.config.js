/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/popup/**/*.{ts,tsx,html}',
    './src/content/**/*.{ts,css}',
  ],
  theme: {
    extend: {
      colors: {
        // Zenprax brand palette: deep emerald + slate dark mode.
        zenprax: {
          950: '#02120c',
          900: '#04231a',
          800: '#063a2b',
          700: '#0a5a44',
          600: '#0f7a5c',
          500: '#10b981',
          400: '#34d399',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
