/** @type {import('tailwindcss').Config} */
export default {
  // Tailwind is only used by the popup UI. The content-script overlay is styled
  // with self-contained plain CSS injected into a Shadow Root (overlayStyles.ts),
  // so it intentionally does not participate in Tailwind generation.
  content: ['./src/popup/**/*.{ts,tsx,html}'],
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
