/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          cyan: '#00f5ff',
          purple: '#b400ff',
          pink: '#ff006e',
          green: '#39ff14',
          orange: '#ff6200',
        },
        dark: {
          900: '#050508',
          800: '#0a0a12',
          700: '#0f0f1a',
          600: '#141422',
          500: '#1a1a2e',
          400: '#16213e',
          300: '#0f3460',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Orbitron', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 0 10px #00f5ff, 0 0 20px #00f5ff, 0 0 40px #00f5ff',
        'neon-purple': '0 0 10px #b400ff, 0 0 20px #b400ff',
        'neon-pink': '0 0 10px #ff006e, 0 0 20px #ff006e',
      },
      animation: {
        'pulse-neon': 'pulseNeon 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'scan': 'scan 2s linear infinite',
      },
      keyframes: {
        pulseNeon: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
    },
  },
  plugins: [],
}
