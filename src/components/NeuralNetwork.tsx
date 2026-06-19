/**
 * NeuralNetwork — red neuronal 3D manipulable (plexus) en estilo AECODE morado.
 *
 *  Reemplaza a Aecodito como objeto central. Es una esfera de NODOS conectados
 *  por aristas (grafo rígido precomputado) que rota en 3D y por la que viajan
 *  PULSOS DE SEÑAL (actividad neuronal). Se dibuja vectorialmente en un canvas
 *  a pantalla completa leyendo los MotionValues de la física → nítida a cualquier
 *  escala (sin blur al agrandar) y se puede:
 *    · mover (sigue la posición),  · escalar (crece/encoge),
 *    · aplastar (se comprime),     · rotar (gira con el gesto),
 *    · energizar (al agarrarla: más brillo, más giro, más señales).
 *
 *  Modo `ambient`: versión contenida y auto-rotatoria para la pantalla de inicio.
 *  Render con composición aditiva ('lighter') = glow neón eficiente, sin WebGL.
 */
import { useEffect, useRef } from 'react'
import type { GestureMotion } from '../hooks/useGestureControls'

interface Props {
  mv?: GestureMotion
  box: number
  ambient?: boolean
}

interface Node3 {
  x: number
  y: number
  z: number
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

export default function NeuralNetwork({ mv, box, ambient = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    // ── Geometría (se construye una sola vez) ────────────────────────────────
    const GA = Math.PI * (3 - Math.sqrt(5)) // ángulo áureo
    const nodes: Node3[] = []
    const OUTER = 100 // cáscara externa (esfera de Fibonacci)
    const INNER = 50 // nube interior (densidad hacia el centro)

    for (let i = 0; i < OUTER; i++) {
      const y = 1 - (i / (OUTER - 1)) * 2
      const r = Math.sqrt(Math.max(0, 1 - y * y))
      const th = i * GA
      const rad = 0.82 + Math.random() * 0.18 // grosor de cáscara
      nodes.push({ x: Math.cos(th) * r * rad, y: y * rad, z: Math.sin(th) * r * rad })
    }
    for (let i = 0; i < INNER; i++) {
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      const rad = 0.15 + Math.random() * 0.55
      nodes.push({
        x: Math.sin(ph) * Math.cos(th) * rad,
        y: Math.cos(ph) * rad,
        z: Math.sin(ph) * Math.sin(th) * rad,
      })
    }
    const CENTER = nodes.length // índice del nodo central (origen)
    nodes.push({ x: 0, y: 0, z: 0 })
    const N = nodes.length

    // ── Aristas (grafo rígido, una sola vez) ─────────────────────────────────
    const edges: Array<[number, number]> = []
    const seen = new Set<string>()
    const addEdge = (a: number, b: number) => {
      if (a === b) return
      const k = a < b ? `${a}_${b}` : `${b}_${a}`
      if (!seen.has(k)) {
        seen.add(k)
        edges.push([a, b])
      }
    }
    // k vecinos más cercanos (malla orgánica)
    const K = 3
    for (let i = 0; i < CENTER; i++) {
      const d: Array<{ j: number; v: number }> = []
      for (let j = 0; j < CENTER; j++) {
        if (i === j) continue
        const dx = nodes[i].x - nodes[j].x
        const dy = nodes[i].y - nodes[j].y
        const dz = nodes[i].z - nodes[j].z
        d.push({ j, v: dx * dx + dy * dy + dz * dz })
      }
      d.sort((a, b) => a.v - b.v)
      for (let k = 0; k < K; k++) addEdge(i, d[k].j)
    }
    // ráfaga radial desde el centro (las líneas que convergen, como la referencia)
    for (let i = 0; i < CENTER; i++) if (Math.random() < 0.42) addEdge(CENTER, i)

    // ── Señales (pulsos que viajan por las aristas) ──────────────────────────
    interface Sig {
      e: number
      t: number
      sp: number
    }
    const signals: Sig[] = []

    // Buffers de proyección en pantalla
    const sx = new Float32Array(N)
    const sy = new Float32Array(N)
    const dep = new Float32Array(N)

    // ── Tamaño de canvas ─────────────────────────────────────────────────────
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let W = 0
    let H = 0
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (ambient) {
        W = box
        H = box
      } else {
        W = window.innerWidth
        H = window.innerHeight
      }
      canvas.width = W * dpr
      canvas.height = H * dpr
      canvas.style.width = W + 'px'
      canvas.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    if (!ambient) window.addEventListener('resize', resize)

    let angleY = 0
    const tiltX = -0.32 // ligera inclinación (vista de la referencia)
    let raf = 0
    let prev = performance.now()

    const tick = () => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now

      // ── Parámetros de transformación (de la física o del modo ambiente) ────
      let cx: number
      let cy: number
      let rX: number
      let rY: number
      let rot2d: number
      let energy: number
      if (ambient) {
        cx = W / 2
        cy = H / 2
        const base = box * 0.42
        rX = base
        rY = base
        rot2d = 0
        energy = 0.5 + Math.sin(now / 1400) * 0.12
      } else if (mv) {
        cx = mv.x.get() + box / 2
        cy = mv.y.get() + box / 2
        const base = box * 0.46
        rX = base * mv.scaleX.get()
        rY = base * mv.scaleY.get()
        rot2d = (mv.rotate.get() * Math.PI) / 180
        energy = mv.glow.get()
      } else {
        cx = W / 2
        cy = H / 2
        rX = rY = box * 0.46
        rot2d = 0
        energy = 0.3
      }

      const spin = reduced ? 0 : 0.12 + energy * 0.55
      angleY += dt * spin

      const cosY = Math.cos(angleY)
      const sinY = Math.sin(angleY)
      const cosX = Math.cos(tiltX)
      const sinX = Math.sin(tiltX)
      const cos2 = Math.cos(rot2d)
      const sin2 = Math.sin(rot2d)

      // ── Proyección 3D → 2D ─────────────────────────────────────────────────
      for (let i = 0; i < N; i++) {
        const p = nodes[i]
        // rotación Y
        const x1 = p.x * cosY + p.z * sinY
        const z1 = -p.x * sinY + p.z * cosY
        // inclinación X
        const y2 = p.y * cosX - z1 * sinX
        const z2 = p.y * sinX + z1 * cosX
        // perspectiva suave
        const persp = 1 / (1 - z2 * 0.26)
        const px = x1 * persp
        const py = y2 * persp
        // rotación 2D (gesto) + escala/squash
        const rx = px * cos2 - py * sin2
        const ry = px * sin2 + py * cos2
        sx[i] = cx + rx * rX
        sy[i] = cy + ry * rY
        dep[i] = clamp01((z2 + 1) / 2) // 0 (atrás) .. 1 (frente)
      }

      ctx.clearRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'

      const bright = 0.5 + energy * 0.8

      // ── Aristas ────────────────────────────────────────────────────────────
      ctx.lineWidth = 1
      for (let e = 0; e < edges.length; e++) {
        const a = edges[e][0]
        const b = edges[e][1]
        const dn = (dep[a] + dep[b]) * 0.5
        const isBurst = a === CENTER || b === CENTER
        const alpha = (isBurst ? 0.12 : 0.2) * (0.35 + dn) * bright
        if (alpha <= 0.012) continue
        const hue = isBurst ? 288 : 268 + dn * 34
        ctx.strokeStyle = `hsla(${hue}, 92%, ${52 + dn * 22}%, ${alpha})`
        ctx.beginPath()
        ctx.moveTo(sx[a], sy[a])
        ctx.lineTo(sx[b], sy[b])
        ctx.stroke()
      }

      // ── Nodos ──────────────────────────────────────────────────────────────
      for (let i = 0; i < CENTER; i++) {
        const dn = dep[i]
        const size = 0.6 + dn * 1.9
        const a = (0.28 + dn * 0.62) * bright
        ctx.fillStyle = `hsla(286, 90%, 72%, ${a * 0.45})`
        ctx.beginPath()
        ctx.arc(sx[i], sy[i], size * 2.6, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = `hsla(282, 96%, 80%, ${a})`
        ctx.beginPath()
        ctx.arc(sx[i], sy[i], size, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── Señales viajando (más actividad al manipular) ──────────────────────
      const want = reduced ? 5 : Math.round(10 + energy * 38)
      while (signals.length < want)
        signals.push({ e: (Math.random() * edges.length) | 0, t: Math.random(), sp: 0.5 + Math.random() * 1.3 })
      if (signals.length > want) signals.length = want
      for (const s of signals) {
        s.t += dt * s.sp
        if (s.t > 1) {
          s.t = 0
          s.e = (Math.random() * edges.length) | 0
          s.sp = 0.5 + Math.random() * 1.3
        }
        const a = edges[s.e][0]
        const b = edges[s.e][1]
        const x = sx[a] + (sx[b] - sx[a]) * s.t
        const y = sy[a] + (sy[b] - sy[a]) * s.t
        const hue = (s.e & 1) === 0 ? 282 : 248 // mezcla violeta / azul eléctrico
        ctx.fillStyle = `hsla(${hue}, 100%, 82%, ${0.95 * bright})`
        ctx.beginPath()
        ctx.arc(x, y, 1.9, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = `hsla(${hue}, 100%, 76%, ${0.4 * bright})`
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── Núcleo brillante (pulsa con la energía) ────────────────────────────
      const coreR = Math.max(2, rX * 0.18 * (1 + Math.sin(now / 300) * 0.12) + energy * rX * 0.12)
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3.2)
      grd.addColorStop(0, `hsla(288, 100%, 82%, ${0.55 * bright})`)
      grd.addColorStop(0.4, `hsla(282, 92%, 62%, ${0.2 * bright})`)
      grd.addColorStop(1, 'hsla(280, 90%, 50%, 0)')
      ctx.fillStyle = grd
      ctx.beginPath()
      ctx.arc(cx, cy, coreR * 3.2, 0, Math.PI * 2)
      ctx.fill()

      ctx.globalCompositeOperation = 'source-over'
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      if (!ambient) window.removeEventListener('resize', resize)
    }
  }, [mv, box, ambient])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={
        ambient
          ? { width: box, height: box, display: 'block' }
          : { position: 'fixed', inset: 0, zIndex: 12, pointerEvents: 'none' }
      }
    />
  )
}
