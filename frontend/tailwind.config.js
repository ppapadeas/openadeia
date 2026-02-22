/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'DM Sans'", 'sans-serif'],
        mono: ["'JetBrains Mono'", 'monospace'],
      },
      colors: {
        bg: {
          base: '#0B0E14',
          surface: '#10141C',
          card: 'rgba(255,255,255,0.03)',
          hover: 'rgba(255,255,255,0.05)',
        },
        border: {
          subtle: 'rgba(255,255,255,0.06)',
          default: 'rgba(255,255,255,0.1)',
        },
        text: {
          primary: '#E2E4E9',
          secondary: '#9CA3AF',
          muted: '#6B7280',
        },
        accent: {
          blue: '#3B82F6',
          amber: '#F59E0B',
          red: '#EF4444',
          green: '#10B981',
          purple: '#7C3AED',
        },
      },
    },
  },
  plugins: [],
};
