/**
 * ParticleField — campo de partículas moradas + ondas de energía (Canvas 2D).
 *
 *  · Ambiente: partículas violetas/azules que ascienden suavemente.
 *  · Reactivo: cuando la energía de Aecodito sube (al agarrarlo), emite ráfagas
 *    y ondas que irradian desde su centro.
 *  Canvas 2D con composición aditiva = glow neón eficiente (sin WebGL).
 */
import { useEffect, useRef } from 'react'
import type { GestureMotion } from '../hooks/useGestureControls'

interface Props {
  mv: GestureMotion
  box: number
}

interface P {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  hue: number
}

export default function ParticleField({ mv, box }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let W = 0
    let H = 0
    const ambient: P[] = []
    const bursts: P[] = []
    let prevGlow = 0

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

    const spawnAmbient = (): P => ({
      x: Math.random() * W,
      y: H + 10,
      vx: (Math.random() - 0.5) * 12,
      vy: -(8 + Math.random() * 26),
      life: 0,
      max: 6 + Math.random() * 8,
      size: 0.6 + Math.random() * 2.2,
      hue: Math.random() < 0.78 ? 285 : 250, // violeta o azul eléctrico
    })

    const AMBIENT_COUNT = reduced ? 22 : 90
    for (let i = 0; i < AMBIENT_COUNT; i++) {
      const p = spawnAmbient()
      p.y = Math.random() * H
      p.life = Math.random() * p.max
      ambient.push(p)
    }

    const emitBurst = (cx: number, cy: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = 60 + Math.random() * 220
        bursts.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0,
          max: 0.5 + Math.random() * 0.8,
          size: 1.4 + Math.random() * 2.6,
          hue: Math.random() < 0.5 ? 165 : 285, // núcleo verde o violeta
        })
      }
    }

    let raf = 0
    let prev = performance.now()
    const tick = () => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now

      ctx.clearRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'

      // Centro de Aecodito (mv.x/y = esquina superior izq. de su caja)
      const cx = mv.x.get() + box / 2
      const cy = mv.y.get() + box / 2
      const glow = mv.glow.get()

      // Ráfaga al subir la energía bruscamente
      if (!reduced && glow - prevGlow > 0.06) emitBurst(cx, cy, 14)
      // Goteo continuo mientras hay energía alta
      if (!reduced && glow > 0.6 && Math.random() < 0.4) emitBurst(cx, cy, 3)
      prevGlow = glow

      // Ondas de energía (anillos)
      if (glow > 0.25 && !reduced) {
        const r = ((now / 8) % 220) + 20
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(165, 90%, 65%, ${0.25 * glow * (1 - r / 240)})`
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Ambiente
      for (const p of ambient) {
        p.life += dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        if (p.life > p.max || p.y < -10) Object.assign(p, spawnAmbient())
        const t = p.life / p.max
        const alpha = Math.sin(t * Math.PI) * 0.5
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue}, 90%, 68%, ${alpha})`
        ctx.fill()
      }

      // Ráfagas
      for (let i = bursts.length - 1; i >= 0; i--) {
        const p = bursts[i]
        p.life += dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vx *= 0.94
        p.vy *= 0.94
        if (p.life > p.max) {
          bursts.splice(i, 1)
          continue
        }
        const alpha = (1 - p.life / p.max) * 0.8
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue}, 95%, 66%, ${alpha})`
        ctx.fill()
      }

      ctx.globalCompositeOperation = 'source-over'
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [mv, box])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none' }}
    />
  )
}
