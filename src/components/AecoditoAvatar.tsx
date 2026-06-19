/**
 * AecoditoAvatar — Aecodito como personaje manipulable.
 *
 *  Es un SVG INLINE (recreado del asset de marca `aecodito-clear.svg`, sin
 *  fondo) para poder animar cada parte: el ojo pulsa como un núcleo de IA, el
 *  cuerpo se aplasta/estira (squash & stretch), y un anillo de energía aparece
 *  al agarrarlo. Toda la transformación llega por MotionValues → 60fps sin
 *  re-render. Colores de marca: cuerpo claro + ojo verde núcleo + glow violeta.
 */
import { motion, useMotionTemplate, useTransform } from 'framer-motion'
import type { GestureMotion } from '../hooks/useGestureControls'

interface Props {
  mv: GestureMotion
  box: number
}

export default function AecoditoAvatar({ mv, box }: Props) {
  // Glow global según la energía (al agarrar / interactuar)
  const glowBlur = useTransform(mv.glow, [0, 1], [10, 48])
  const filter = useMotionTemplate`drop-shadow(0 10px 24px rgba(0,0,0,.55)) drop-shadow(0 0 ${glowBlur}px var(--neon))`

  // Anillo de energía
  const ringOpacity = useTransform(mv.glow, [0, 0.2, 1], [0, 0.3, 0.95])
  const ringScale = useTransform(mv.glow, [0, 1], [0.65, 1.18])

  // Ojo / núcleo IA
  const eyeR = useTransform(mv.eye, [0, 1], [20, 30])
  const eyeOpacity = useTransform(mv.eye, [0, 1], [0.5, 1])
  const haloOpacity = useTransform(mv.eye, [0, 1], [0.15, 0.55])

  return (
    <motion.div
      aria-hidden
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: box,
        height: box,
        x: mv.x,
        y: mv.y,
        scaleX: mv.scaleX,
        scaleY: mv.scaleY,
        rotate: mv.rotate,
        transformOrigin: 'center 78%', // pivote en los "pies" → squash creíble
        filter,
        pointerEvents: 'none',
        zIndex: 20,
        willChange: 'transform',
      }}
    >
      {/* Anillo de energía al agarrar */}
      <motion.div
        style={{
          position: 'absolute',
          inset: '6%',
          borderRadius: '50%',
          border: '2px solid var(--core)',
          boxShadow: '0 0 40px var(--core), inset 0 0 30px var(--neon-soft)',
          opacity: ringOpacity,
          scale: ringScale,
        }}
      />

      <svg viewBox="0 0 512 512" width="100%" height="100%" role="img" aria-label="Aecodito">
        <defs>
          <radialGradient id="aec-head" cx="50%" cy="40%" r="62%">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#E7ECF5" />
          </radialGradient>
          <linearGradient id="aec-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FBFCFF" />
            <stop offset="1" stopColor="#D9E0EC" />
          </linearGradient>
          <filter id="aec-eyeblur" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>

        {/* Cabeza */}
        <circle cx="256" cy="166" r="108" fill="url(#aec-head)" />
        <circle cx="256" cy="166" r="94" fill="none" stroke="#C7D2E3" strokeWidth="8" />
        {/* Rim light violeta (identidad HUD) */}
        <circle cx="256" cy="166" r="105" fill="none" stroke="#a855f7" strokeOpacity="0.5" strokeWidth="2.5" />

        {/* Lente */}
        <circle cx="256" cy="166" r="76" fill="#0E1422" />
        <circle cx="256" cy="166" r="54" fill="#1B2336" stroke="#5A6B86" strokeWidth="5" />

        {/* Halo del ojo (pulso IA) */}
        <motion.circle cx="256" cy="166" r="46" fill="var(--core)" filter="url(#aec-eyeblur)" style={{ opacity: haloOpacity }} />
        {/* Núcleo verde animado */}
        <motion.circle cx="256" cy="166" r={eyeR} fill="var(--core)" style={{ opacity: eyeOpacity }} />
        <circle cx="246" cy="154" r="7" fill="#FFFFFF" opacity="0.9" />

        {/* Cuello */}
        <rect x="230" y="267" width="52" height="46" rx="14" fill="#C7D2E3" />

        {/* Cuerpo */}
        <path
          d="M148 310C162 284 196 270 256 270C316 270 350 284 364 310L394 438H118L148 310Z"
          fill="url(#aec-body)"
          stroke="#33415A"
          strokeWidth="8"
        />
        <path
          d="M180 356C206 338 230 330 256 330C282 330 306 338 332 356"
          stroke="#C7D2E3"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Placa de pecho con la marca */}
        <rect x="190" y="300" width="132" height="45" rx="18" fill="#0F172A" stroke="#33415A" strokeWidth="5" />
        <text
          x="256"
          y="329"
          textAnchor="middle"
          fontFamily="'Space Grotesk', Arial, sans-serif"
          fontSize="22"
          fontWeight="800"
          fill="#FFFFFF"
          letterSpacing="1"
        >
          AECODE
        </text>

        {/* Brazos */}
        <path
          d="M135 380L86 346C70 335 66 313 78 296C90 279 113 276 129 288L179 326"
          fill="url(#aec-body)"
          stroke="#33415A"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M377 380L426 346C442 335 446 313 434 296C422 279 399 276 383 288L333 326"
          fill="url(#aec-body)"
          stroke="#33415A"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Manos: núcleos verdes */}
        <circle cx="93" cy="299" r="13" fill="var(--core)" />
        <circle cx="419" cy="299" r="13" fill="var(--core)" />
      </svg>
    </motion.div>
  )
}
