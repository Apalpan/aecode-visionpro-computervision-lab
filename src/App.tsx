/**
 * App — orquestador de AECODE VisionPro Lab.
 *  · Inicio: eliges MODO AECODITO (solo el núcleo neuronal, sin cámara, mouse) o
 *    MODO INTERACTIVO (cámara + manos + detección facial).
 *  · Activo: red neuronal manipulable + HUD; cambio de modo en caliente, vista
 *    limpia (ocultar paneles) y "nivel de poder" en cámara.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useHandTracking } from './hooks/useHandTracking'
import { useGestureControls } from './hooks/useGestureControls'
import { assets, onImgError } from './lib/assetFinder'
import CameraVision from './components/CameraVision'
import ParticleField from './components/ParticleField'
import NeuralNetwork from './components/NeuralNetwork'
import FaceTracker from './components/FaceTracker'
import JarvisHUD from './components/JarvisHUD'
import GesturePanel from './components/GesturePanel'

type Phase = 'intro' | 'active'
export type ViewMode = 'aecodito' | 'camera'

export default function App() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [view, setView] = useState<ViewMode>('camera')
  const [debug, setDebug] = useState(false)
  const [clean, setClean] = useState(false)
  const [power, setPower] = useState(140)
  const powerRef = useRef(140)
  const energyRef = useRef(0)

  const tracking = useHandTracking()
  const { mv, telemetry, reticleRef, BOX } = useGestureControls(
    tracking.handsRef,
    tracking.mode,
    phase === 'active',
  )
  energyRef.current = telemetry.energy

  const startAecodito = useCallback(() => {
    setView('aecodito')
    setPhase('active')
    tracking.startMouse()
  }, [tracking])

  const startCamera = useCallback(async () => {
    setView('camera')
    setPhase('active')
    await tracking.start()
  }, [tracking])

  const switchMode = useCallback(
    async (target: ViewMode) => {
      if (target === view) return
      if (target === 'aecodito') {
        tracking.stop()
        setView('aecodito')
        tracking.startMouse()
      } else {
        setView('camera')
        await tracking.start()
      }
    },
    [tracking, view],
  )

  const exit = useCallback(() => {
    tracking.stop()
    setPhase('intro')
  }, [tracking])

  // ── Nivel de poder (135–145), sube con la interacción. Solo en cámara. ────
  useEffect(() => {
    if (phase !== 'active' || view !== 'camera') return
    let raf = 0
    let last = 0
    const loop = () => {
      const now = performance.now()
      const base = 140 + Math.sin(now / 700) * 3 + Math.sin(now / 233) * 1.3 + energyRef.current * 3
      const v = Math.max(135, Math.min(145, base))
      powerRef.current = v
      if (now - last > 110) {
        last = now
        setPower(v)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase, view])

  const initializing =
    phase === 'active' &&
    view === 'camera' &&
    (tracking.status === 'requesting-camera' || tracking.status === 'loading-model')

  const isMouse = tracking.mode === 'mouse'

  return (
    <main
      className="relative h-full w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(120% 90% at 50% -10%, oklch(0.22 0.12 285 / 0.6), transparent 60%), var(--void)',
      }}
    >
      <div className="tech-grid pointer-events-none absolute inset-0 opacity-[0.12]" />

      <AnimatePresence mode="wait">
        {phase === 'intro' ? (
          <Intro key="intro" onAecodito={startAecodito} onCamera={startCamera} />
        ) : (
          <motion.div
            key="active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            <CameraVision
              videoRef={tracking.videoRef}
              handsRef={tracking.handsRef}
              mode={tracking.mode}
              debug={debug}
            />
            <ParticleField mv={mv} box={BOX} />
            <NeuralNetwork mv={mv} box={BOX} />
            {view === 'camera' && tracking.faceEnabled && (
              <FaceTracker facesRef={tracking.facesRef} mode={tracking.mode} powerRef={powerRef} />
            )}
            {!clean && <GesturePanel telemetry={telemetry} mouse={isMouse} />}
            <JarvisHUD
              telemetry={telemetry}
              reticleRef={reticleRef}
              status={tracking.status}
              mode={tracking.mode}
              view={view}
              fps={tracking.fps}
              debug={debug}
              clean={clean}
              power={view === 'camera' ? power : null}
              faceEnabled={tracking.faceEnabled}
              onToggleDebug={() => setDebug((d) => !d)}
              onToggleClean={() => setClean((c) => !c)}
              onToggleFace={() => tracking.setFaceEnabled(!tracking.faceEnabled)}
              onSwitchMode={switchMode}
              onStop={exit}
            />

            {/* Loader de inicialización */}
            <AnimatePresence>
              {initializing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-40 grid place-items-center bg-abyss/60 backdrop-blur-sm"
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-14 w-14 animate-spin-slow rounded-full border-2 border-neon/30 border-t-neon" />
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
                      {tracking.status === 'requesting-camera'
                        ? 'Solicitando cámara…'
                        : 'Cargando modelo de IA…'}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Aviso de fallback */}
            <AnimatePresence>
              {tracking.error && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="glass absolute left-1/2 top-20 z-40 w-[min(90vw,460px)] -translate-x-1/2 rounded-xl px-4 py-3"
                >
                  <p className="text-center text-xs text-ink">{tracking.error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Hint inicial */}
            {!clean && (
              <motion.p
                key={view + String(isMouse)}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{ duration: 6, times: [0, 0.1, 0.85, 1], delay: 0.8 }}
                className="pointer-events-none absolute left-1/2 top-[26%] z-30 -translate-x-1/2 text-center font-mono text-xs uppercase tracking-[0.2em] text-neon/80"
              >
                {isMouse
                  ? 'Click para agarrar el núcleo · arrastra para mover · rueda para escalar'
                  : 'Pellizca cerca de la red para agarrarla · abre la mano para escalar'}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   Pantalla de inicio con selector de modo
   ════════════════════════════════════════════════════════════════════════ */
function Intro({ onAecodito, onCamera }: { onAecodito: () => void; onCamera: () => void }) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.6 }}
      className="absolute inset-0 grid place-items-center overflow-y-auto px-6 py-10"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2"
        style={{ width: 'min(70vmin,520px)', height: 'min(70vmin,520px)', opacity: 0.5 }}
      >
        <div className="absolute inset-0 animate-spin-slow rounded-full border border-dashed border-neon/30" />
        <div className="absolute inset-[10%] animate-spin-reverse rounded-full border border-electric/20" />
      </div>

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center">
        <motion.img
          src={assets.logo}
          onError={onImgError}
          alt="AECODE"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 h-7 w-auto opacity-90 drop-shadow-[0_0_14px_var(--neon-soft)] sm:h-8"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <NeuralNetwork box={300} ambient />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="-mt-2 text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl"
        >
          AECODE <span className="text-neon text-glow">VisionPro</span> Lab
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-4 font-mono text-xs uppercase tracking-[0.22em] text-muted sm:text-sm"
        >
          Red Neuronal + Computer Vision + Gesture Control
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mt-9 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <ModeCard
            onClick={onAecodito}
            accent="neon"
            title="Modo Aecodito"
            desc="Solo el núcleo neuronal. Sin cámara. Contrólalo con el mouse: click para agarrar, arrastra para mover, rueda para escalar."
            icon={
              <>
                <circle cx="12" cy="12" r="3" />
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
              </>
            }
          />
          <ModeCard
            onClick={onCamera}
            accent="electric"
            title="Modo Interactivo"
            desc="Cámara + manos. Manipula la red con gestos reales (pinch, mover, escalar) y activa la detección facial."
            icon={
              <>
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" />
              </>
            }
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-8 flex max-w-md items-center gap-2.5 rounded-full border border-line bg-white/[0.03] px-4 py-2.5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--core)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p className="text-left text-[11px] leading-snug text-muted">
            La cámara se usa <span className="text-ink">localmente en tu navegador</span>. No se graba ni se sube video.
          </p>
        </motion.div>
      </div>
    </motion.section>
  )
}

function ModeCard({
  onClick,
  title,
  desc,
  icon,
  accent,
}: {
  onClick: () => void
  title: string
  desc: string
  icon: React.ReactNode
  accent: 'neon' | 'electric'
}) {
  const color = accent === 'neon' ? 'var(--neon)' : 'var(--electric)'
  return (
    <button
      onClick={onClick}
      className="glass group relative flex flex-col items-start gap-3 rounded-2xl p-5 text-left transition will-change-transform hover:-translate-y-1"
      style={{ boxShadow: '0 8px 40px -12px rgba(0,0,0,.6)' }}
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-xl border transition group-hover:scale-105"
        style={{ borderColor: color, color, boxShadow: `0 0 24px -6px ${color}` }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </span>
      <span className="font-display text-lg font-bold text-ink">{title}</span>
      <span className="text-[12.5px] leading-snug text-muted">{desc}</span>
      <span className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color }}>
        Entrar →
      </span>
    </button>
  )
}
