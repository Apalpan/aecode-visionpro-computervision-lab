/**
 * useGestureControls — convierte señales de gesto en FÍSICA de Aecodito.
 *
 *  Corre su propio bucle a ~60fps:
 *    1. Lee las manos (handsRef) y las pasa al GestureEngine.
 *    2. Simula posición/velocidad/escala/squash de Aecodito (gravedad, salto,
 *       caminar, rebote al aterrizar, agarre con seguimiento de la mano).
 *    3. Escribe MotionValues de Framer Motion → el avatar se anima SIN provocar
 *       re-renders de React (clave para mantener 60fps).
 *    4. Publica `telemetry` (estado de React, baja frecuencia) para el HUD.
 *
 *  El espejado horizontal se aplica aquí (sólo en modo cámara) para que mover
 *  la mano a la derecha mueva a Aecodito a la derecha (vista selfie).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMotionValue, type MotionValue } from 'framer-motion'
import { GestureEngine, clamp, lerp, type HandSample } from '../lib/gestureEngine'
import type { TrackingMode } from './useHandTracking'

export type AecoditoAction = 'idle' | 'grab' | 'move' | 'scale' | 'squash' | 'jump' | 'walk'

export interface Telemetry {
  detected: boolean
  handCount: number
  pinch: number
  confidence: number
  scale: number
  action: AecoditoAction
  grabbed: boolean
  energy: number
  vx: number
  vy: number
  walking: boolean
  openness: number
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

const BOX = 260 // tamaño base del avatar en px (caja contenedora)

// Constantes de física (px, segundos)
const GRAVITY = 2600
const JUMP_IMPULSE = 1180
const WALK_SPEED = 250
const LAND_SQUASH_VELOCITY = 700

export function useGestureControls(
  handsRef: React.MutableRefObject<HandSample[]>,
  mode: TrackingMode,
  active: boolean,
) {
  const mv: GestureMotion = {
    x: useMotionValue(0),
    y: useMotionValue(0),
    scaleX: useMotionValue(1),
    scaleY: useMotionValue(1),
    rotate: useMotionValue(0),
    glow: useMotionValue(0),
    eye: useMotionValue(0.5),
  }

  const reticleRef = useRef<Reticle>({ x: 0, y: 0, visible: false, pinch: 0 })
  const [telemetry, setTelemetry] = useState<Telemetry>(initTelemetry())

  const engine = useMemo(() => new GestureEngine(), [])
  const modeRef = useRef(mode)
  const activeRef = useRef(active)
  modeRef.current = mode
  activeRef.current = active

  // Estado de física persistente (sin re-render)
  const sim = useRef({
    x: 0,
    y: 0,
    vy: 0,
    scale: 1,
    squash: 0,
    rotation: 0,
    grabbed: false,
    energy: 0,
    walkPhase: 0,
    grounded: true,
    initialized: false,
    action: 'idle' as AecoditoAction,
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
      const ground = H * 0.6
      const s = sim.current

      if (!s.initialized) {
        s.x = W * 0.5
        s.y = ground
        s.initialized = true
      }

      const g = engine.update(handsRef.current, now)
      const mirror = modeRef.current === 'mediapipe'

      // Mano en coordenadas de pantalla
      const hx = (mirror ? 1 - g.handCenter.x : g.handCenter.x) * W
      const hy = g.handCenter.y * H
      const vxScreen = (mirror ? -g.handVelocity.x : g.handVelocity.x) * W
      reticleRef.current = { x: hx, y: hy, visible: g.detected, pinch: g.pinchStrength }

      let action: AecoditoAction = 'idle'

      // Escala objetivo (siempre que haya mano)
      if (g.detected) {
        s.scale = lerp(s.scale, g.scaleFactor, 0.12)
      }

      // ── AGARRE ───────────────────────────────────────────────────────────
      const grabRadius = 150 * s.scale + 60
      if (g.isPinching && g.detected) {
        if (!s.grabbed) {
          const d = Math.hypot(hx - s.x, hy - s.y)
          if (d < grabRadius) s.grabbed = true
        }
      } else {
        s.grabbed = false
      }

      if (s.grabbed) {
        // Sigue a la mano
        s.x = lerp(s.x, hx, 0.28)
        s.y = lerp(s.y, hy, 0.28)
        s.vy = 0
        s.grounded = false
        s.rotation = lerp(s.rotation, clamp(vxScreen * 0.02, -22, 22), 0.18)
        s.energy = lerp(s.energy, 1, 0.12)
        // Aplastar mientras se sostiene (empuje hacia abajo)
        const sq = clamp(g.squashFactor, 0, 1)
        s.squash = lerp(s.squash, sq * 0.8, 0.2)
        const moving = Math.abs(vxScreen) > 0.25 || Math.abs(g.handVelocity.y) > 0.25
        action = sq > 0.35 ? 'squash' : moving ? 'move' : 'grab'
      } else {
        // ── Sin agarre: gravedad + suelo ────────────────────────────────────
        s.vy += GRAVITY * dt
        s.y += s.vy * dt

        if (s.y >= ground) {
          if (s.vy > LAND_SQUASH_VELOCITY && !reduced.current) {
            s.squash = Math.min(1, s.vy / 1600) // rebote de aterrizaje
          }
          s.y = ground
          s.vy = 0
          s.grounded = true
        } else {
          s.grounded = false
        }

        // SALTAR
        if (g.jumpTrigger && s.grounded) {
          s.vy = -JUMP_IMPULSE
          s.grounded = false
          action = 'jump'
        }

        // CAMINAR (oscilación lateral en el suelo)
        if (g.walking && s.grounded) {
          s.x += WALK_SPEED * g.walkDirection * (mirror ? -1 : 1) * dt
          s.walkPhase += dt * 11
          s.rotation = lerp(s.rotation, Math.sin(s.walkPhase) * 9, 0.3)
          action = 'walk'
        } else {
          s.rotation = lerp(s.rotation, 0, 0.1)
        }

        // APLASTAR (empuje hacia abajo con la mano abierta sobre él)
        if (g.detected && g.squashFactor > 0.15 && s.grounded) {
          s.squash = lerp(s.squash, clamp(g.squashFactor, 0, 1), 0.25)
          action = 'squash'
        } else {
          s.squash = lerp(s.squash, 0, 0.12)
        }

        // ESCALAR (mano muy abierta o dos manos separándose)
        if (action === 'idle' && g.detected && (g.openness > 0.55 || g.handCount >= 2)) {
          action = 'scale'
        }

        if (!s.grounded && action === 'idle') action = 'jump'
        s.energy = lerp(s.energy, g.detected ? 0.25 + g.pinchStrength * 0.4 : 0, 0.08)
      }

      // Limita a la pantalla
      s.x = clamp(s.x, BOX * 0.25, W - BOX * 0.25)
      s.y = clamp(s.y, BOX * 0.2, H - BOX * 0.1)
      s.scale = clamp(s.scale, 0.4, 2.8)
      s.squash = clamp(s.squash, 0, 1)
      s.action = action

      // Flotación idle (sutil, sin tocar la posición física)
      const idleBob =
        !reduced.current && s.grounded && !s.grabbed && action === 'idle'
          ? Math.sin(now / 700) * 7
          : 0
      const breathe = action === 'idle' ? 1 + Math.sin(now / 1100) * 0.012 : 1

      // ── Escribe MotionValues ────────────────────────────────────────────
      mv.x.set(s.x - BOX / 2)
      mv.y.set(s.y - BOX / 2 + idleBob)
      mv.scaleX.set(s.scale * (1 + 0.3 * s.squash) * breathe)
      mv.scaleY.set(s.scale * (1 - 0.45 * s.squash) * breathe)
      mv.rotate.set(s.rotation)
      mv.glow.set(s.energy)
      mv.eye.set(0.45 + Math.sin(now / 320) * 0.25 + s.energy * 0.3)

      // ── Telemetría para el HUD (~12fps) ─────────────────────────────────
      if (now - s.lastTelemetry > 80) {
        s.lastTelemetry = now
        setTelemetry({
          detected: g.detected,
          handCount: g.handCount,
          pinch: g.pinchStrength,
          confidence: g.confidence,
          scale: s.scale,
          action: s.action,
          grabbed: s.grabbed,
          energy: s.energy,
          vx: g.handVelocity.x,
          vy: g.handVelocity.y,
          walking: g.walking,
          openness: g.openness,
        })
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine])

  // Reinicia la física al activar/desactivar
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
    energy: 0,
    vx: 0,
    vy: 0,
    walking: false,
    openness: 0,
  }
}
