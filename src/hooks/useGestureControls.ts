/**
 * useGestureControls — convierte señales de gesto en FÍSICA del núcleo neuronal.
 *
 *  El núcleo es un objeto FLOTANTE tipo "Jarvis" (sin gravedad): reposa cerca
 *  del centro, respira/flota y, al agarrarlo (pinch), lo sigues, escalas y rotas.
 *  Al soltarlo regresa suavemente al centro.
 *
 *  Corre su propio bucle a ~60fps:
 *    1. Lee las manos (handsRef) y las pasa al GestureEngine.
 *    2. Simula posición/escala/rotación/energía del núcleo.
 *    3. Escribe MotionValues de Framer Motion → la red se anima SIN re-render.
 *    4. Publica `telemetry` (estado de React, baja frecuencia) para el HUD.
 *
 *  Gestos soportados:
 *    · Agarrar  → pinch de una mano cerca del núcleo
 *    · Mover    → arrastrar mientras lo agarras
 *    · Escalar  → dos manos (separación) o una mano abierta
 *    · Rotar    → mover la mano de lado mientras lo agarras
 *    · Energizar→ pinch fuerte (sube energía y actividad neuronal)
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMotionValue, type MotionValue } from 'framer-motion'
import { GestureEngine, clamp, lerp, type HandSample } from '../lib/gestureEngine'
import type { TrackingMode } from './useHandTracking'

export type CoreAction = 'idle' | 'grab' | 'move' | 'scale' | 'rotate' | 'energize'

export interface Telemetry {
  detected: boolean
  handCount: number
  pinch: number
  confidence: number
  scale: number
  action: CoreAction
  grabbed: boolean
  energy: number
  moving: boolean
  scaling: boolean
  rotating: boolean
  energized: boolean
}

export interface GestureMotion {
  x: MotionValue<number>
  y: MotionValue<number>
  scaleX: MotionValue<number>
  scaleY: MotionValue<number>
  rotate: MotionValue<number>
  glow: MotionValue<number>
  eye: MotionValue<number>
}

export interface Reticle {
  x: number
  y: number
  visible: boolean
  pinch: number
}

const BOX = 320 // tamaño base del núcleo en px (caja contenedora)

const initX = typeof window !== 'undefined' ? window.innerWidth / 2 - BOX / 2 : 0
const initY = typeof window !== 'undefined' ? window.innerHeight / 2 - BOX / 2 : 0

export function useGestureControls(
  handsRef: React.MutableRefObject<HandSample[]>,
  mode: TrackingMode,
  active: boolean,
) {
  const mv: GestureMotion = {
    x: useMotionValue(initX),
    y: useMotionValue(initY),
    scaleX: useMotionValue(1),
    scaleY: useMotionValue(1),
    rotate: useMotionValue(0),
    glow: useMotionValue(0.18),
    eye: useMotionValue(0.5),
  }

  const reticleRef = useRef<Reticle>({ x: 0, y: 0, visible: false, pinch: 0 })
  const [telemetry, setTelemetry] = useState<Telemetry>(initTelemetry())

  const engine = useMemo(() => new GestureEngine(), [])
  const modeRef = useRef(mode)
  const activeRef = useRef(active)
  modeRef.current = mode
  activeRef.current = active

  const sim = useRef({
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    grabbed: false,
    energy: 0.18,
    initialized: false,
    lastTelemetry: 0,
  })

  const reduced = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    let raf = 0
    let prev = performance.now()

    const tick = () => {
      const now = performance.now()
      let dt = (now - prev) / 1000
      dt = clamp(dt, 0.001, 0.05)
      prev = now

      const W = window.innerWidth
      const H = window.innerHeight
      const anchorX = W / 2
      const anchorY = H / 2
      const s = sim.current

      if (!s.initialized) {
        s.x = anchorX
        s.y = anchorY
        s.initialized = true
      }

      const g = engine.update(handsRef.current, now)
      const mirror = modeRef.current === 'mediapipe'

      const hx = (mirror ? 1 - g.handCenter.x : g.handCenter.x) * W
      const hy = g.handCenter.y * H
      const vxScreen = (mirror ? -g.handVelocity.x : g.handVelocity.x) * W
      reticleRef.current = { x: hx, y: hy, visible: g.detected, pinch: g.pinchStrength }

      let moving = false
      let scaling = false
      let rotating = false

      // ── ESCALAR: dos manos (separación) o una mano abierta sin agarrar ──────
      const canScale = g.detected && (g.handCount >= 2 || (!s.grabbed && g.openness > 0.42))
      if (canScale) {
        s.scale = lerp(s.scale, clamp(g.scaleFactor, 0.35, 3.0), 0.13)
        scaling = true
      }

      // ── AGARRAR: pinch de UNA mano cerca del núcleo ─────────────────────────
      const grabRadius = BOX * 0.5 * s.scale + 90
      if (g.detected && g.handCount === 1 && g.isPinching) {
        if (!s.grabbed) {
          const d = Math.hypot(hx - s.x, hy - s.y)
          if (d < grabRadius) s.grabbed = true
        }
      } else if (!g.isPinching || g.handCount >= 2) {
        s.grabbed = false
      }

      if (s.grabbed) {
        // MOVER: sigue a la mano
        s.x = lerp(s.x, hx, 0.3)
        s.y = lerp(s.y, hy, 0.3)
        if (Math.abs(vxScreen) > 0.25) moving = true
        // ROTAR: inclina/gira según el movimiento lateral
        const tilt = clamp(vxScreen * 0.02, -28, 28)
        s.rotation = lerp(s.rotation, tilt, 0.16)
        if (Math.abs(s.rotation) > 5) rotating = true
        // ENERGIZAR
        s.energy = lerp(s.energy, 1, 0.12)
      } else {
        // En reposo: deriva suave al centro + se estabiliza
        s.x = lerp(s.x, anchorX, 0.02)
        s.y = lerp(s.y, anchorY, 0.02)
        s.rotation = lerp(s.rotation, 0, 0.06)
        s.energy = lerp(s.energy, g.detected ? 0.22 + g.pinchStrength * 0.3 : 0.18, 0.06)
      }

      // Límites de pantalla y escala
      s.x = clamp(s.x, BOX * 0.3, W - BOX * 0.3)
      s.y = clamp(s.y, BOX * 0.28, H - BOX * 0.28)
      s.scale = clamp(s.scale, 0.35, 3.0)

      const energized = s.energy > 0.7

      let action: CoreAction = 'idle'
      if (scaling) action = 'scale'
      else if (s.grabbed && moving) action = 'move'
      else if (rotating) action = 'rotate'
      else if (s.grabbed) action = 'grab'
      else if (energized) action = 'energize'

      // Flotación / respiración (idle)
      const idleBob = !reduced.current && !s.grabbed ? Math.sin(now / 800) * 6 : 0
      const breathe = !s.grabbed ? 1 + Math.sin(now / 1500) * 0.02 : 1

      mv.x.set(s.x - BOX / 2)
      mv.y.set(s.y - BOX / 2 + idleBob)
      const sc = s.scale * breathe
      mv.scaleX.set(sc)
      mv.scaleY.set(sc)
      mv.rotate.set(s.rotation)
      mv.glow.set(s.energy)
      mv.eye.set(0.5)

      if (now - s.lastTelemetry > 80) {
        s.lastTelemetry = now
        setTelemetry({
          detected: g.detected,
          handCount: g.handCount,
          pinch: g.pinchStrength,
          confidence: g.confidence,
          scale: s.scale,
          action,
          grabbed: s.grabbed,
          energy: s.energy,
          moving,
          scaling,
          rotating,
          energized,
        })
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine])

  useEffect(() => {
    if (active) {
      engine.reset()
      sim.current.initialized = false
    }
  }, [active, engine])

  return { mv, telemetry, reticleRef, BOX }
}

function initTelemetry(): Telemetry {
  return {
    detected: false,
    handCount: 0,
    pinch: 0,
    confidence: 0,
    scale: 1,
    action: 'idle',
    grabbed: false,
    energy: 0.18,
    moving: false,
    scaling: false,
    rotating: false,
    energized: false,
  }
}
