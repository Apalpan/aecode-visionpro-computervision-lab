/**
 * App — orquestador de AECODE VisionPro Lab.
 *  · Pantalla de inicio (intro) con Aecodito + CTA "Activar cámara".
 *  · Experiencia activa: cámara + tracking + Aecodito manipulable + HUD.
 */
import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useHandTracking } from './hooks/useHandTracking'
import { useGestureControls } from './hooks/useGestureControls'
import { assets, onImgError } from './lib/assetFinder'
import CameraVision from './components/CameraVision'
import ParticleField from './components/ParticleField'
import AecoditoAvatar from './components/AecoditoAvatar'
import JarvisHUD from './components/JarvisHUD'
import GesturePanel from './components/GesturePanel'

type Phase = 'intro' | 'active'

export default function App() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [debug, setDebug] = useState(false)
  const tracking = useHandTracking()
  const { mv, telemetry, reticleRef, BOX } = useGestureControls(
    tracking.handsRef,
    tracking.mode,
    phase === 'active',
  )

  const activateCamera = useCallback(async () => {
    setPhase('active')
    await tracking.start()
  }, [tracking])

  const activateMouse = useCallback(() => {
    setPhase('active')
    tracking.startMouse()
  }, [tracking])

  const stop = useCallback(() => {
    tracking.stop()
    setPhase('intro')
  }, [tracking])

  const initializing =
    phase === 'active' &&
    (tracking.status === 'requesting-camera' || tracking.status === 'loading-model')

  return (
    <main
      className="relative h-full w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(120% 90% at 50% -10%, oklch(0.22 0.12 285 / 0.6), transparent 60%), var(--void)',
      }}
    >
      {/* Malla técnica de fondo siempre presente */}
      <div className="tech-grid pointer-events-none absolute inset-0 opacity-[0.12]" />

      <AnimatePresence mode="wait">
        {phase === 'intro' ? (
          <Intro key="intro" onCamera={activateCamera} onMouse={activateMouse} />
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
            <AecoditoAvatar mv={mv} box={BOX} />
            <GesturePanel telemetry={telemetry} />
            <JarvisHUD
              telemetry={telemetry}
              reticleRef={reticleRef}
              status={tracking.status}
              mode={tracking.mode}
              fps={tracking.fps}
              debug={debug}
              onToggleDebug={() => setDebug((d) => !d)}
              onStop={stop}
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

            {/* Aviso de fallback (cámara/modelo no disponible) */}
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

            {/* Hint inicial de gestos */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{ duration: 6, times: [0, 0.1, 0.85, 1], delay: 1 }}
              className="pointer-events-none absolute left-1/2 top-1/3 z-30 -translate-x-1/2 text-center font-mono text-xs uppercase tracking-[0.2em] text-core/80"
            >
              {tracking.mode === 'mouse'
                ? 'Mueve el cursor · mantén click para agarrar'
                : 'Muestra tu mano a la cámara'}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   Pantalla de inicio
   ════════════════════════════════════════════════════════════════════════ */
function Intro({ onCamera, onMouse }: { onCamera: () => void; onMouse: () => void }) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.6 }}
      className="absolute inset-0 grid place-items-center px-6"
    >
      {/* Escáner ambiental detrás de Aecodito */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[34%] -translate-x-1/2 -translate-y-1/2"
        style={{ width: 'min(70vmin,520px)', height: 'min(70vmin,520px)', opacity: 0.5 }}
      >
        <div className="absolute inset-0 animate-spin-slow rounded-full border border-dashed border-neon/30" />
        <div className="absolute inset-[10%] animate-spin-reverse rounded-full border border-electric/20" />
        <div
          className="absolute inset-[4%] rounded-full"
          style={{ background: 'radial-gradient(circle, var(--neon-soft), transparent 65%)', opacity: 0.45 }}
        />
      </div>

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center">
        {/* Logo */}
        <motion.img
          src={assets.logo}
          onError={onImgError}
          alt="AECODE"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 h-7 w-auto opacity-90 drop-shadow-[0_0_14px_var(--neon-soft)] sm:h-8"
        />

        {/* Aecodito */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative mb-2"
        >
          <img
            src={assets.aecoditoPng}
            onError={onImgError}
            alt="Aecodito"
            className="animate-float h-44 w-44 object-contain drop-shadow-[0_18px_50px_var(--neon-soft)] sm:h-56 sm:w-56"
            style={{ filter: 'drop-shadow(0 0 40px rgba(108,255,174,0.25))' }}
          />
        </motion.div>

        {/* Título */}
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl"
        >
          AECODE <span className="text-neon text-glow">VisionPro</span> Lab
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-4 font-mono text-xs uppercase tracking-[0.22em] text-muted sm:text-sm"
        >
          Computer Vision + Gesture Interaction + AI Interface
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mt-9 flex flex-col items-center gap-4"
        >
          <button onClick={onCamera} className="btn-neon flex items-center gap-3 px-8 py-4 font-display text-base font-semibold">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
            Activar cámara
          </button>

          <button
            onClick={onMouse}
            className="font-mono text-xs uppercase tracking-[0.16em] text-muted underline-offset-4 transition hover:text-ink hover:underline"
          >
            Probar sin cámara (modo mouse) →
          </button>
        </motion.div>

        {/* Aviso de privacidad */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-10 flex max-w-sm items-center gap-2.5 rounded-full border border-line bg-white/[0.03] px-4 py-2.5"
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
