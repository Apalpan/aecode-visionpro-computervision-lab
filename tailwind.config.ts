import type { Config } from 'tailwindcss'

/**
 * Sistema de marca AECODE VisionPro — paleta "Jarvis morado".
 * Los colores se exponen como variables CSS en globals.css (tokens OKLCH),
 * así que aquí solo los referenciamos. Re-tematizar = cambiar --brand-hue.
 *
 * Cada color es una FUNCIÓN alpha-aware: así los modificadores de opacidad de
 * Tailwind (p.ej. `border-neon/40`) funcionan sobre variables CSS vía color-mix.
 */
const c =
  (cssVar: string) =>
  ({ opacityValue }: { opacityValue?: string }) =>
    opacityValue == null
      ? `var(${cssVar})`
      : `color-mix(in oklab, var(${cssVar}) calc(${opacityValue} * 100%), transparent)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Lienzo profundo
        void: c('--void'),
        abyss: c('--abyss'),
        // Violeta neón (acento principal)
        neon: {
          DEFAULT: c('--neon'),
          soft: 'var(--neon-soft)',
          dim: 'var(--neon-dim)',
        },
        // Azul eléctrico (acento secundario / data)
        electric: c('--electric'),
        // Verde núcleo IA (el "ojo" de Aecodito)
        core: c('--core'),
        // Texto
        ink: c('--fg'),
        muted: c('--muted'),
        line: c('--line'),
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 0 1px var(--neon-dim), 0 0 24px -4px var(--neon-soft)',
        'neon-lg': '0 0 60px -12px var(--neon-soft), 0 0 0 1px var(--neon-dim)',
        core: '0 0 40px -6px var(--core)',
        glass: '0 8px 40px -12px rgba(0,0,0,.6), inset 0 1px 0 0 rgba(255,255,255,.06)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
        'spin-reverse': { to: { transform: 'rotate(-360deg)' } },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.04)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(2000%)' },
        },
        flicker: {
          '0%, 19%, 21%, 23%, 25%, 54%, 56%, 100%': { opacity: '1' },
          '20%, 22%, 24%, 55%': { opacity: '0.4' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'grid-pan': {
          from: { backgroundPosition: '0 0' },
          to: { backgroundPosition: '60px 60px' },
        },
      },
      animation: {
        'spin-slow': 'spin-slow 18s linear infinite',
        'spin-reverse': 'spin-reverse 26s linear infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        scan: 'scan 4s linear infinite',
        flicker: 'flicker 6s infinite',
        float: 'float 6s ease-in-out infinite',
        'fade-up': 'fade-up .7s cubic-bezier(.22,1,.36,1) both',
        'grid-pan': 'grid-pan 8s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
