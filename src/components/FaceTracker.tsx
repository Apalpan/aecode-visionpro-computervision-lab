/**
 * FaceTracker — overlay de detección facial estilo Jarvis.
 *
 *  Dibuja, por cada rostro detectado: una caja de "objetivo" con esquineros
 *  animados, una línea de escaneo, los puntos clave (ojos/nariz/boca) con glow
 *  y la etiqueta "ROSTRO FIJADO" + confianza. Lee `facesRef` cada frame.
 */
import { useEffect, useRef } from 'react'
import type { FaceSample, TrackingMode } from '../hooks/useHandTracking'

interface Props {
  facesRef: React.MutableRefObject<FaceSample[]>
  mode: TrackingMode
}

export default function FaceTracker({ facesRef, mode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modeRef = useRef(mode)
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
      const faces = facesRef.current
      const mirror = modeRef.current === 'mediapipe'
      const now = performance.now()

      for (const f of faces) {
        // Caja en pantalla (espejada en X cuando es cámara selfie)
        const w = f.w * W
        const h = f.h * H
        const x = (mirror ? 1 - (f.x + f.w) : f.x) * W
        const y = f.y * H
        const pad = 8
        const bx = x - pad
        const by = y - pad
        const bw = w + pad * 2
        const bh = h + pad * 2

        // Relleno tenue
        ctx.fillStyle = 'rgba(168,85,247,0.07)'
        ctx.fillRect(bx, by, bw, bh)

        // Esquineros tipo HUD
        const c = Math.min(28, bw * 0.3)
        ctx.strokeStyle = 'rgba(192,132,252,0.95)'
        ctx.lineWidth = 2.5
        ctx.shadowColor = '#a855f7'
        ctx.shadowBlur = 12
        ctx.beginPath()
        // sup-izq
        ctx.moveTo(bx, by + c); ctx.lineTo(bx, by); ctx.lineTo(bx + c, by)
        // sup-der
        ctx.moveTo(bx + bw - c, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + c)
        // inf-izq
        ctx.moveTo(bx, by + bh - c); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + c, by + bh)
        // inf-der
        ctx.moveTo(bx + bw - c, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - c)
        ctx.stroke()
        ctx.shadowBlur = 0

        // Línea de escaneo vertical
        const scanY = by + ((now / 14) % bh)
        const grad = ctx.createLinearGradient(bx, scanY - 12, bx, scanY + 12)
        grad.addColorStop(0, 'rgba(74,168,255,0)')
        grad.addColorStop(0.5, 'rgba(74,168,255,0.55)')
        grad.addColorStop(1, 'rgba(74,168,255,0)')
        ctx.fillStyle = grad
        ctx.fillRect(bx, scanY - 12, bw, 24)

        // Puntos clave
        ctx.fillStyle = '#4aa8ff'
        ctx.shadowColor = '#4aa8ff'
        ctx.shadowBlur = 8
        for (const k of f.keypoints) {
          const kx = (mirror ? 1 - k.x : k.x) * W
          const ky = k.y * H
          ctx.beginPath()
          ctx.arc(kx, ky, 2.6, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.shadowBlur = 0

        // Etiqueta
        ctx.fillStyle = '#c084fc'
        ctx.font = '600 12px "JetBrains Mono", monospace'
        ctx.fillText(`ROSTRO FIJADO · ${Math.round(f.score * 100)}%`, bx, by - 10)
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [facesRef])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ position: 'fixed', inset: 0, zIndex: 16, pointerEvents: 'none' }}
    />
  )
}
