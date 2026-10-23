/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base:    '#08080f',
        surface: '#0f0f1a',
        card:    '#16162a',
        border:  '#252538',
        accent:  '#7c3aed',
        'accent-light': '#a78bfa',
        'accent-dim':   '#4c1d95',
        emerald: '#10b981',
        muted:   '#6b6b8a',
        soft:    '#c4c4e0',
        bright:  '#f0f0ff',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow:    '0 0 20px rgba(124,58,237,0.25)',
        'glow-sm': '0 0 10px rgba(124,58,237,0.15)',
        card:    '0 4px 24px rgba(0,0,0,0.4)',
      },
      keyframes: {
        'fade-in':     { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'pulse-slow':  { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
        'spin-slow':   { to: { transform: 'rotate(360deg)' } },
        shimmer:       { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'scale-in':    { from: { opacity: '0', transform: 'scale(0.95)' }, to: { opacity: '1', transform: 'scale(1)' } },
      },
      animation: {
        'fade-in':    'fade-in 0.3s ease-out',
        'pulse-slow': 'pulse-slow 2s ease-in-out infinite',
        'spin-slow':  'spin-slow 3s linear infinite',
        shimmer:      'shimmer 2s linear infinite',
        'scale-in':   'scale-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
