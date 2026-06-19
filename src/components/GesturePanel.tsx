/**
 * GesturePanel — panel desplegable con la lista de gestos.
 *  Tiene su propio botón para mostrar/ocultar la lista (no estorba la vista).
 *  Cada gesto se ENCIENDE cuando está activo según la telemetría.
 */
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Telemetry } from '../hooks/useGestureControls'

interface Props {
  telemetry: Telemetry
  mouse: boolean
}

interface GestureDef {
  id: string
  label: string
  hand: string
  mouse: string
  icon: React.ReactNode
  active: (t: Telemetry) => boolean
}

const I = {
  pinch: <path d="M7 14c0-3 2-5 5-5s5 2 5 5M9 14l3-3 3 3" />,
  move: <path d="M12 4v16M4 12h16M9 7l3-3 3 3M9 17l3 3 3-3M7 9l-3 3 3 3M17 9l3 3-3 3" />,
  scale: <path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6" />,
  rotate: <path d="M21 12a9 9 0 1 1-3-6.7M21 3v5h-5" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
}

const GESTURES: GestureDef[] = [
  { id: 'grab', label: 'Agarrar', hand: 'Pinch pulgar + índice', mouse: 'Click sostenido', icon: I.pinch, active: (t) => t.grabbed },
  { id: 'move', label: 'Mover', hand: 'Arrastra Aecodito Brain', mouse: 'Arrastra con el mouse', icon: I.move, active: (t) => t.moving },
  { id: 'scale', label: 'Escalar / Zoom', hand: 'Abre la mano o usa 2', mouse: 'Rueda del mouse', icon: I.scale, active: (t) => t.scaling },
  { id: 'rotate', label: 'Rotar', hand: 'Gira la mano agarrando', mouse: 'Arrastra de lado', icon: I.rotate, active: (t) => t.rotating },
  { id: 'energize', label: 'Energizar', hand: 'Pinch fuerte', mouse: 'Mantén presionado', icon: I.bolt, active: (t) => t.energized },
]

export default function GesturePanel({ telemetry, mouse }: Props) {
  const [open, setOpen] = useState(true)

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="absolute left-4 top-1/2 z-30 hidden -translate-y-1/2 sm:left-6 lg:block"
      style={{ pointerEvents: 'none' }}
    >
      <div className="glass thin-scroll w-60 rounded-2xl p-2.5" style={{ pointerEvents: 'auto' }}>
        {/* Cabecera = botón desplegable */}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-white/5"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Aecodito Brain</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-neon transition-transform duration-200"
            style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.ul
              key="list"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="mt-1.5 space-y-1.5 overflow-hidden"
            >
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
                      style={{ borderColor: on ? 'var(--core)' : 'var(--line)', color: on ? 'var(--core)' : 'var(--muted)' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        {g.icon}
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm font-semibold ${on ? 'text-core' : 'text-ink'}`}>{g.label}</span>
                      <span className="block truncate font-mono text-[10px] text-muted">{mouse ? g.mouse : g.hand}</span>
                    </span>
                    <span
                      className="h-2 w-2 shrink-0 rounded-full transition"
                      style={{ background: on ? 'var(--core)' : 'var(--line)', boxShadow: on ? '0 0 10px var(--core)' : 'none' }}
                    />
                  </li>
                )
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
