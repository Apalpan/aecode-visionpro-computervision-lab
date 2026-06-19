/**
 * CameraVision — fondo de video de la cámara + capas de ambiente + tracking.
 *
 *  · <video> a pantalla completa, espejado (vista selfie), teñido de morado y
 *    atenuado para que el HUD respire.
 *  · Scanlines, viñeta y degradados para legibilidad.
 *  · Incluye el overlay HandTracker.
 *  En modo mouse (sin cámara) muestra una rejilla técnica animada en su lugar.
 */
import HandTracker from './HandTracker'
import type { HandSample } from '../lib/gestureEngine'
import type { TrackingMode } from '../hooks/useHandTracking'

interface Props {
  videoRef: React.RefObject<HTMLVideoElement>
  handsRef: React.MutableRefObject<HandSample[]>
  mode: TrackingMode
  debug: boolean
}

export default function CameraVision({ videoRef, handsRef, mode, debug }: Props) {
  const isCamera = mode === 'mediapipe'

  return (
    <>
      {/* Fondo: video o rejilla (fallback) */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden' }} className="bg-void">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: isCamera ? 'scaleX(-1)' : 'none',
            filter: 'saturate(0.85) brightness(0.6) contrast(1.05)',
            opacity: isCamera ? 0.85 : 0,
            transition: 'opacity .6s ease',
          }}
        />

        {/* Rejilla técnica (visible sobre todo en modo mouse) */}
        <div
          className="tech-grid animate-grid-pan"
          style={{ position: 'absolute', inset: 0, opacity: isCamera ? 0.18 : 0.4 }}
        />

        {/* Teñido morado + viñeta */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(120% 80% at 50% 0%, transparent 40%, rgba(12,3,20,0.55) 100%), linear-gradient(180deg, rgba(124,58,237,0.18), rgba(12,3,20,0.5))',
            mixBlendMode: 'multiply',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 0 220px 40px rgba(8,2,14,0.85)',
            pointerEvents: 'none',
          }}
        />
        {/* Scanlines sutiles */}
        <div className="scanlines" style={{ position: 'absolute', inset: 0, opacity: 0.5 }} />
      </div>

      {/* Overlay de tracking de manos */}
      <HandTracker handsRef={handsRef} mode={mode} debug={debug} />
    </>
  )
}
