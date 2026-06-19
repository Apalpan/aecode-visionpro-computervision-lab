/**
 * FaceTracker — detección facial con estilo elegante y moderno.
 *
 *  Por cada rostro: contorno tenue redondeado, esquineros finos con glow, línea
 *  de escaneo sutil, puntos clave refinados y una "tarjeta" limpia con el
 *  NIVEL DE PODER (135–145). Lee `facesRef` y `powerRef` cada frame.
 */
import { useEffect, useRef } from 'react'
import type { FaceSample, TrackingMode } from '../hooks/useHandTracking'

interface Props {
  facesRef: React.MutableRefObject<FaceSample[]>
  mode: TrackingMode
  powerRef: React.MutableRefObject<number>
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof (ctx as any).roundRect === 'function') {
    ctx.beginPath()
    ;(ctx as any).roundRect(x, y, w, h, r)
    return
  }
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export default function FaceTracker({ facesRef, mode, powerRef }: Props) {
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
      const power = Math.round(powerRef.current)

      faces.forEach((f, idx) => {
        const w = f.w * W
        const h = f.h * H
        const x = (mirror ? 1 - (f.x + f.w) : f.x) * W
        const y = f.y * H
        const pad = 10
        const bx = x - pad
        const by = y - pad
        const bw = w + pad * 2
        const bh = h + pad * 2

        // Contorno redondeado tenue
        roundRect(ctx, bx, by, bw, bh, 16)
        ctx.strokeStyle = 'rgba(168,85,247,0.22)'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.fillStyle = 'rgba(124,58,237,0.05)'
        ctx.fill()

        // Esquineros finos con glow
        const c = Math.min(26, bw * 0.26)
        ctx.strokeStyle = 'rgba(199,160,255,0.95)'
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.shadowColor = '#a855f7'
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.moveTo(bx, by + c); ctx.lineTo(bx, by + 8); ctx.arcTo(bx, by, bx + 8, by, 8); ctx.lineTo(bx + c, by)
        ctx.moveTo(bx + bw - c, by); ctx.lineTo(bx + bw - 8, by); ctx.arcTo(bx + bw, by, bx + bw, by + 8, 8); ctx.lineTo(bx + bw, by + c)
        ctx.moveTo(bx, by + bh - c); ctx.lineTo(bx, by + bh - 8); ctx.arcTo(bx, by + bh, bx + 8, by + bh, 8); ctx.lineTo(bx + c, by + bh)
        ctx.moveTo(bx + bw - c, by + bh); ctx.lineTo(bx + bw - 8, by + bh); ctx.arcTo(bx + bw, by + bh, bx + bw, by + bh - 8, 8); ctx.lineTo(bx + bw, by + bh - c)
        ctx.stroke()
        ctx.shadowBlur = 0

        // Línea de escaneo sutil
        const scanY = by + ((now / 16) % bh)
        const grad = ctx.createLinearGradient(0, scanY - 10, 0, scanY + 10)
        grad.addColorStop(0, 'rgba(74,168,255,0)')
        grad.addColorStop(0.5, 'rgba(74,168,255,0.4)')
        grad.addColorStop(1, 'rgba(74,168,255,0)')
        ctx.fillStyle = grad
        ctx.fillRect(bx + 2, scanY - 10, bw - 4, 20)

        // Puntos clave refinados
        for (const k of f.keypoints) {
          const kx = (mirror ? 1 - k.x : k.x) * W
          const ky = k.y * H
          ctx.beginPath()
          ctx.arc(kx, ky, 2.2, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(199,160,255,0.95)'
          ctx.fill()
        }

        // Tarjeta de nivel de poder (debajo del rostro)
        const cardW = Math.max(168, bw)
        const cardH = 44
        const cardX = bx + bw / 2 - cardW / 2
        const cardY = by + bh + 10
        roundRect(ctx, cardX, cardY, cardW, cardH, 12)
        ctx.fillStyle = 'rgba(13,8,22,0.74)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(168,85,247,0.4)'
        ctx.lineWidth = 1
        ctx.stroke()

        // Punto + etiqueta
        ctx.fillStyle = '#6cffae'
        ctx.shadowColor = '#6cffae'
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.arc(cardX + 14, cardY + 15, 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(183,166,200,0.95)'
        ctx.font = '600 9px "JetBrains Mono", monospace'
        ctx.fillText('NIVEL DE PODER', cardX + 26, cardY + 15)

        ctx.fillStyle = '#eef0fb'
        ctx.font = '700 22px "Space Grotesk", system-ui, sans-serif'
        ctx.fillText(String(power), cardX + 14, cardY + 31)

        ctx.fillStyle = 'rgba(74,168,255,0.95)'
        ctx.font = '600 9px "JetBrains Mono", monospace'
        ctx.textAlign = 'right'
        ctx.fillText(`AECODITO · ID-${String(idx + 1).padStart(2, '0')}`, cardX + cardW - 12, cardY + 22)
        ctx.textAlign = 'left'
      })

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [facesRef, powerRef])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ position: 'fixed', inset: 0, zIndex: 16, pointerEvents: 'none' }}
    />
  )
}
