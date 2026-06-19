/**
 * HandTracker — overlay de tracking de manos (Canvas 2D).
 *
 *  · Siempre: indicadores de seguimiento (yemas de pulgar/índice + línea de
 *    pinch) con glow neón → feedback visual del Computer Vision.
 *  · Modo debug: dibuja el esqueleto completo de los 21 landmarks.
 *
 *  Lee `handsRef` cada frame (sin re-render) y mapea coordenadas normalizadas a
 *  pantalla, espejando en X cuando la cámara está en modo selfie.
 */
import { useEffect, useRef } from 'react'
import { HAND_CONNECTIONS, type HandSample } from '../lib/gestureEngine'
import type { TrackingMode } from '../hooks/useHandTracking'

interface Props {
  handsRef: React.MutableRefObject<HandSample[]>
  mode: TrackingMode
  debug: boolean
}

export default function HandTracker({ handsRef, mode, debug }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const debugRef = useRef(debug)
  const modeRef = useRef(mode)
  debugRef.current = debug
  modeRef.current = mode

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let W = 0
    let H = 0

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      canvas.style.width = W + 'px'
      canvas.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    let raf = 0
    const tick = () => {
      ctx.clearRect(0, 0, W, H)
      const hands = handsRef.current
      const mirror = modeRef.current === 'mediapipe'
      const px = (x: number) => (mirror ? 1 - x : x) * W
      const py = (y: number) => y * H

      for (const hand of hands) {
        const lm = hand.landmarks
        if (!lm || lm.length < 21) continue

        // Esqueleto de la mano — SIEMPRE visible (detección de mano)
        ctx.lineWidth = 2.5
        ctx.strokeStyle = 'rgba(168,85,247,0.7)'
        ctx.shadowColor = 'rgba(168,85,247,0.9)'
        ctx.shadowBlur = 8
        ctx.beginPath()
        for (const [a, b] of HAND_CONNECTIONS) {
          ctx.moveTo(px(lm[a].x), py(lm[a].y))
          ctx.lineTo(px(lm[b].x), py(lm[b].y))
        }
        ctx.stroke()
        ctx.shadowBlur = 0

        for (let i = 0; i < lm.length; i++) {
          ctx.beginPath()
          ctx.arc(px(lm[i].x), py(lm[i].y), debugRef.current ? 4 : 2.8, 0, Math.PI * 2)
          ctx.fillStyle = '#c084fc'
          ctx.fill()
          // En debug: índice de cada landmark
          if (debugRef.current) {
            ctx.fillStyle = 'rgba(238,243,248,0.75)'
            ctx.font = '9px "JetBrains Mono", monospace'
            ctx.fillText(String(i), px(lm[i].x) + 6, py(lm[i].y) - 6)
          }
        }

        // Indicadores de seguimiento (siempre): yemas clave
        const thumb = lm[4]
        const index = lm[8]
        const tx = px(thumb.x)
        const ty = py(thumb.y)
        const ix = px(index.x)
        const iy = py(index.y)

        // Línea de pinch
        const pinchDist = Math.hypot(ix - tx, iy - ty)
        const close = pinchDist < 46
        ctx.strokeStyle = close ? 'rgba(108,255,174,0.9)' : 'rgba(74,168,255,0.5)'
        ctx.lineWidth = close ? 3 : 1.5
        ctx.shadowColor = close ? '#6cffae' : '#4aa8ff'
        ctx.shadowBlur = close ? 16 : 6
        ctx.beginPath()
        ctx.moveTo(tx, ty)
        ctx.lineTo(ix, iy)
        ctx.stroke()

        // Yemas con glow
        for (const [x, y] of [
          [tx, ty],
          [ix, iy],
        ]) {
          ctx.beginPath()
          ctx.arc(x, y, close ? 9 : 6, 0, Math.PI * 2)
          ctx.fillStyle = close ? '#6cffae' : '#a855f7'
          ctx.fill()
        }
        ctx.shadowBlur = 0
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [handsRef])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ position: 'fixed', inset: 0, zIndex: 15, pointerEvents: 'none' }}
    />
  )
}
