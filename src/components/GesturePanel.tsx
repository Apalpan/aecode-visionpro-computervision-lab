/**
 * GesturePanel — panel lateral con la lista de gestos.
 *  Cada gesto se ENCIENDE (glow núcleo) cuando está activo según la telemetría.
 *  Sirve de leyenda interactiva para la demo pública.
 */
import { motion } from 'framer-motion'
import type { Telemetry } from '../hooks/useGestureControls'

interface Props {
  telemetry: Telemetry
}

interface GestureDef {
  id: string
  label: string
  hint: string
  icon: React.ReactNode
  active: (t: Telemetry) => boolean
}

const I = {
  pinch: (
    <path d="M7 14c0-3 2-5 5-5s5 2 5 5M9 14l3-3 3 3" />
  ),
  move: <path d="M12 4v16M4 12h16M9 7l3-3 3 3M9 17l3 3 3-3M7 9l-3 3 3 3M17 9l3 3-3 3" />,
  scale: <path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6" />,
  squash: <path d="M4 8h16M6 12h12M9 16h6M12 20l-3-3M12 20l3-3" />,
  jump: <path d="M12 21V8M8 12l4-4 4 4M6 4h12" />,
  walk: <path d="M9 4l2 5-2 6M13 7l1 5 3 4M11 9l4-1" />,
}

const GESTURES: GestureDef[] = [
  { id: 'grab', label: 'Agarrar', hint: 'Pinch pulgar + índice', icon: I.pinch, active: (t) => t.grabbed || t.action === 'grab' },
  { id: 'move', label: 'Mover', hint: 'Arrastra con la mano', icon: I.move, active: (t) => t.action === 'move' },
  { id: 'scale', label: 'Escalar', hint: 'Abre la mano o usa 2', icon: I.scale, active: (t) => t.action === 'scale' || t.handCount >= 2 },
  { id: 'squash', label: 'Aplastar', hint: 'Empuja hacia abajo', icon: I.squash, active: (t) => t.action === 'squash' },
  { id: 'jump', label: 'Saltar', hint: 'Sube la mano rápido', icon: I.jump, active: (t) => t.action === 'jump' },
  { id: 'walk', label: 'Caminar', hint: 'Mueve la mano de lado', icon: I.walk, active: (t) => t.action === 'walk' || t.walking },
]

export default function GesturePanel({ telemetry }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="absolute left-4 top-1/2 z-30 hidden -translate-y-1/2 sm:left-6 lg:block"
      style={{ pointerEvents: 'none' }}
    >
      <div className="glass thin-scroll w-60 rounded-2xl p-3">
        <div className="mb-2 px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          Manipular red neuronal
        </div>
        <ul className="space-y-1.5">
          {GESTURES.map((g) => {
            const on = g.active(telemetry)
            return (
              <li
                key={g.id}
                className="flex items-center gap-3 rounded-xl px-2 py-2 transition"
                style={{
                  background: on ? 'color-mix(in oklch, var(--core) 14%, transparent)' : 'transparent',
                  boxShadow: on ? '0 0 0 1px var(--core), 0 0 20px -6px var(--core)' : 'none',
                }}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                  style={{
                    borderColor: on ? 'var(--core)' : 'var(--line)',
                    color: on ? 'var(--core)' : 'var(--muted)',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {g.icon}
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${on ? 'text-core' : 'text-ink'}`}>
                    {g.label}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-muted">{g.hint}</span>
                </span>
                <span
                  className="h-2 w-2 shrink-0 rounded-full transition"
                  style={{
                    background: on ? 'var(--core)' : 'var(--line)',
                    boxShadow: on ? '0 0 10px var(--core)' : 'none',
                  }}
                />
              </li>
            )
          })}
        </ul>
      </div>
    </motion.div>
  )
}
