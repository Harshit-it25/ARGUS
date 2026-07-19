/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        argus: {
          // Premium palette — deep burgundy + silver, enterprise GRC / SOC platform
          bg: '#0F0810',            // primary background — near-black with burgundy undertone
          bg2: '#1A0E17',           // secondary background
          card: '#22111E',          // card surface
          line: 'rgba(233,215,224,.10)', // border — faint silver-rose

          accent: '#8C1D4D',       // deep burgundy — primary brand action
          'accent-bright': '#B32A63', // brighter burgundy for hovers/glow
          silver: '#B8BCC4',       // silver — secondary brand / informational
          'silver-bright': '#D8DBE0',
          blue: '#B8BCC4',         // alias kept for existing call sites — now maps to silver
          warning: '#D89B3C',       // amber — High priority only, per calm-authority principle
          critical: '#C9684A',      // muted terracotta — deliberately NOT red/burgundy, avoids siren read and brand-color clash
          success: '#3AA187',       // teal-green — readiness/done, distinct from brand hue

          text: '#FBF7F9',
          'text-secondary': '#C9BFC6',
          'text-faint': '#8A7D86',
        }
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'elevate': '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -8px rgba(0,0,0,0.5)',
        'elevate-lg': '0 4px 16px rgba(0,0,0,0.45), 0 32px 56px -16px rgba(0,0,0,0.6)',
        'glow-accent': '0 0 0 1px rgba(140,29,77,0.4), 0 0 28px rgba(179,42,99,0.25)',
        'glow-silver': '0 0 0 1px rgba(184,188,196,0.25), 0 0 20px rgba(184,188,196,0.12)',
        'inset-sheen': 'inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer': 'shimmer 1.8s ease-in-out infinite',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      }
    },
  },
  plugins: [],
}
