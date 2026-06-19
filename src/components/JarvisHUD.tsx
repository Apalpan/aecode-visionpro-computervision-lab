/**
 * JarvisHUD — interfaz HUD futurista (núcleo Aecodito).
 *
 *  Capas: barra superior (logo + selector de modo + toggles), esquineros,
 *  escáner circular, retícula que sigue la mano, "nivel de poder" (en cámara)
 *  y panel de telemetría. La "vista limpia" oculta los paneles para más espacio.
 */
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { assets, onImgError } from '../lib/assetFinder'
import type { Reticle as ReticleData, Telemetry, CoreAction } from '../hooks/useGestureControls'
import type { TrackingMode, TrackingStatus } from '../hooks/useHandTracking'

type ViewMode = 'aecodito' | 'camera'

interface Props {
  telemetry: Telemetry
  reticleRef: React.MutableRefObject<ReticleData>
  status: TrackingStatus
  mode: TrackingMode
  view: ViewMode
  fps: number
  debug: boolean
  clean: boolean
  power: number | null
  faceEnabled: boolean
  onToggleDebug: () => void
  onToggleClean: () => void
  onToggleFace: () => void
  onSwitchMode: (target: ViewMode) => void
  onStop: () => void
}

const ACTION_LABEL: Record<CoreAction, string> = {
  idle: 'EN ESPERA',
  grab: 'AGARRANDO',
  move: 'MOVIENDO',
  scale: 'ESCALANDO',
  rotate: 'ROTANDO',
  energize: 'ENERGIZANDO',
}

export default function JarvisHUD({
  telemetry,
  reticleRef,
  status,
  mode,
  view,
  fps,
  debug,
  clean,
  power,
  faceEnabled,
  onToggleDebug,
  onToggleClean,
  onToggleFace,
  onSwitchMode,
  onStop,
}: Props) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 30, pointerEvents: 'none' }}>
      {!clean && <Scanner />}
      {!clean && <CornerBrackets />}
      <Reticle reticleRef={reticleRef} />

      {/* Nivel de poder (cámara) */}
      {power != null && <PowerLevel value={power} />}

      {/* ── Barra superior ───────────────────────────────────────────────── */}
      <div className="absolute left-0 right-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3"
        >
          <img
            src={assets.logo}
            onError={onImgError}
            alt="AECODE"
            className="h-6 w-auto opacity-95 drop-shadow-[0_0_10px_var(--neon-soft)] sm:h-7"
          />
          <div className="hidden h-7 w-px bg-line sm:block" />
          <div className="hidden leading-tight sm:block">
            <div className="font-display text-sm font-semibold tracking-wide text-ink">
              VisionPro <span className="text-neon">Lab</span>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Red Neuronal</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="flex max-w-[74vw] flex-wrap items-center justify-end gap-2"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-core opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-core shadow-core" />
            </span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-core">
              {statusLabel(status, mode, view)}
            </span>
          </div>

          <ModeSwitch view={view} onSwitch={onSwitchMode} />

          {view === 'camera' && (
            <button
              onClick={onToggleFace}
              aria-pressed={faceEnabled}
              className={`glass rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
                faceEnabled ? 'text-electric shadow-neon' : 'text-muted hover:text-ink'
              }`}
            >
              Rostro {faceEnabled ? 'ON' : 'OFF'}
            </button>
          )}

          <button
            onClick={onToggleClean}
            aria-pressed={clean}
            aria-label="Mostrar u ocultar paneles"
            className={`glass flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
              clean ? 'text-neon shadow-neon' : 'text-muted hover:text-ink'
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {clean ? (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </>
              ) : (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
            {clean ? 'Mostrar' : 'Ocultar'}
          </button>

          <button
            onClick={onToggleDebug}
            aria-pressed={debug}
            className={`glass rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
              debug ? 'text-neon shadow-neon' : 'text-muted hover:text-ink'
            }`}
          >
            Debug {debug ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={onStop}
            aria-label="Salir"
            className="glass rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition hover:text-ink"
          >
            ✕ Salir
          </button>
        </motion.div>
      </div>

      {/* ── Telemetría inferior (oculta en vista limpia) ─────────────────── */}
      {!clean && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="absolute bottom-4 left-1/2 w-[min(92vw,720px)] -translate-x-1/2 sm:bottom-6"
        >
          <div className="glass rounded-2xl px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  Estado de la red neuronal
                </div>
                <div
                  className={`font-display text-xl font-bold sm:text-2xl ${
                    telemetry.action === 'idle' ? 'text-ink' : 'text-neon text-glow'
                  }`}
                >
                  {ACTION_LABEL[telemetry.action]}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-right sm:gap-5">
                <Stat label="Manos" value={String(telemetry.handCount)} />
                <Stat label="Escala" value={`${telemetry.scale.toFixed(2)}×`} />
                <Stat label="FPS" value={String(fps || '—')} />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-5">
              <Meter label="Confianza" value={telemetry.confidence} accent="electric" />
              <Meter label="Energía" value={telemetry.energy} accent="core" />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

function statusLabel(status: TrackingStatus, mode: TrackingMode, view: ViewMode): string {
  if (view === 'aecodito') return 'NÚCLEO AECODITO'
  if (mode === 'mouse') return 'AI VISION · MOUSE'
  switch (status) {
    case 'requesting-camera':
      return 'SOLICITANDO CÁMARA'
    case 'loading-model':
      return 'CARGANDO MODELO IA'
    case 'tracking':
      return 'AI VISION ACTIVE'
    case 'error':
      return 'ERROR'
    default:
      return 'STANDBY'
  }
}

/* ── Nivel de poder (estilo "scouter" elegante) ──────────────────────────── */
function PowerLevel({ value }: { value: number }) {
  const frac = Math.max(0, Math.min(1, (value - 135) / 10))
  const bars = 7
  const lit = Math.round(frac * bars)
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="pointer-events-none absolute left-1/2 top-[4.5rem] -translate-x-1/2 sm:top-24"
    >
      <div className="glass flex items-center gap-3 rounded-2xl px-5 py-2.5">
        <div className="text-right leading-none">
          <div className="font-mono text-[8.5px] uppercase tracking-[0.26em] text-muted">Nivel de poder</div>
          <div className="tabular font-display text-[26px] font-bold text-ink text-glow">{Math.round(value)}</div>
        </div>
        <div className="h-9 w-px bg-line" />
        <div className="flex h-9 items-end gap-[3px]">
          {Array.from({ length: bars }).map((_, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full transition-all duration-150"
              style={{
                height: `${30 + i * 9}%`,
                background: i < lit ? 'var(--core)' : 'rgba(255,255,255,0.12)',
                boxShadow: i < lit ? '0 0 8px var(--core)' : 'none',
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function ModeSwitch({ view, onSwitch }: { view: ViewMode; onSwitch: (t: ViewMode) => void }) {
  const items: Array<{ id: ViewMode; label: string }> = [
    { id: 'aecodito', label: 'Aecodito' },
    { id: 'camera', label: 'Cámara' },
  ]
  return (
    <div className="glass flex items-center rounded-full p-0.5">
      {items.map((it) => {
        const on = view === it.id
        return (
          <button
            key={it.id}
            onClick={() => onSwitch(it.id)}
            className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
              on ? 'text-ink' : 'text-muted hover:text-ink'
            }`}
            style={
              on
                ? { background: 'color-mix(in oklab, var(--neon) 22%, transparent)', boxShadow: '0 0 0 1px var(--neon-dim)' }
                : undefined
            }
          >
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="tabular text-base font-bold text-ink sm:text-lg">{value}</div>
      <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">{label}</div>
    </div>
  )
}

function Meter({ label, value, accent }: { label: string; value: number; accent: 'electric' | 'core' }) {
  const color = accent === 'core' ? 'var(--core)' : 'var(--electric)'
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">{label}</span>
        <span className="tabular text-[10px] text-ink">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-150"
          style={{ width: `${Math.round(value * 100)}%`, background: color, boxShadow: `0 0 12px ${color}` }}
        />
      </div>
    </div>
  )
}

function Reticle({ reticleRef }: { reticleRef: React.MutableRefObject<ReticleData> }) {
  const ref = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const r = reticleRef.current
      const el = ref.current
      const ring = ringRef.current
      if (el) {
        el.style.opacity = r.visible ? '1' : '0'
        el.style.transform = `translate(${r.x}px, ${r.y}px) translate(-50%, -50%)`
      }
      if (ring) {
        const s = 1 - r.pinch * 0.55
        ring.style.transform = `scale(${s})`
        ring.style.borderColor = r.pinch > 0.55 ? 'var(--core)' : 'var(--neon)'
        ring.style.boxShadow = r.pinch > 0.55 ? '0 0 22px var(--core)' : '0 0 16px var(--neon-soft)'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reticleRef])

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: 70,
        height: 70,
        opacity: 0,
        transition: 'opacity .2s ease',
        pointerEvents: 'none',
        willChange: 'transform, opacity',
      }}
    >
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--neon-dim)', transform: 'translateX(-50%)' }} />
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'var(--neon-dim)', transform: 'translateY(-50%)' }} />
      <div ref={ringRef} style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--neon)', boxShadow: '0 0 16px var(--neon-soft)' }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 5, height: 5, borderRadius: '50%', background: 'var(--core)', transform: 'translate(-50%,-50%)', boxShadow: '0 0 10px var(--core)' }} />
    </div>
  )
}

function Scanner() {
  return (
    <div
      aria-hidden
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ width: 'min(78vmin, 680px)', height: 'min(78vmin, 680px)', opacity: 0.16 }}
    >
      <div className="absolute inset-0 animate-spin-slow rounded-full border border-dashed border-neon" />
      <div className="absolute inset-[8%] animate-spin-reverse rounded-full border border-electric/40" />
      <div
        className="absolute inset-[16%] rounded-full border border-neon/30"
        style={{ background: 'conic-gradient(from 0deg, transparent 0%, var(--neon-soft) 8%, transparent 16%)' }}
      />
      <div className="absolute inset-[30%] animate-spin-slow rounded-full border border-dashed border-core/30" />
    </div>
  )
}

function CornerBrackets() {
  const base = 'absolute h-10 w-10 border-neon/40'
  return (
    <div aria-hidden className="absolute inset-3 sm:inset-5">
      <div className={`${base} left-0 top-0 rounded-tl-lg border-l-2 border-t-2`} />
      <div className={`${base} right-0 top-0 rounded-tr-lg border-r-2 border-t-2`} />
      <div className={`${base} bottom-0 left-0 rounded-bl-lg border-b-2 border-l-2`} />
      <div className={`${base} bottom-0 right-0 rounded-br-lg border-b-2 border-r-2`} />
    </div>
  )
}
