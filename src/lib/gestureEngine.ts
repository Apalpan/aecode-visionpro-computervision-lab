/**
 * ════════════════════════════════════════════════════════════════════════
 *  gestureEngine.ts — Motor de gestos de AECODE VisionPro
 * ════════════════════════════════════════════════════════════════════════
 *
 *  Traduce los 21 landmarks de mano de MediaPipe en SEÑALES DE ALTO NIVEL
 *  que la app usa para manipular a Aecodito:
 *
 *    · handCenter     centro de la palma (normalizado 0..1, espacio de imagen)
 *    · handVelocity   velocidad suavizada de la mano (unidades norm. / s)
 *    · pinchStrength  fuerza del "pellizco" pulgar↔índice (0..1)
 *    · isPinching     true cuando el pinch supera el umbral → AGARRAR
 *    · scaleFactor    factor de escala objetivo (~0.4..2.8) → ESCALAR
 *    · squashFactor   empuje hacia abajo (0..1) → APLASTAR
 *    · jumpTrigger    pulso momentáneo de salto → SALTAR
 *    · walking        oscilación lateral repetida → CAMINAR
 *    · walkDirection  -1 | 0 | 1
 *    · confidence     confianza del tracking (0..1)
 *    · openness       apertura de la mano (0..1)
 *
 *  El motor mantiene ESTADO TEMPORAL (velocidad, historial para detectar
 *  caminar/saltar). Llama a `update(hands, nowMs)` una vez por frame.
 *
 *  Está intencionalmente AISLADO de React/MediaPipe para poder mejorarlo,
 *  testearlo y alimentarlo con datos sintéticos (modo fallback de mouse).
 * ════════════════════════════════════════════════════════════════════════
 */

// ── Tipos públicos ─────────────────────────────────────────────────────────
export interface Landmark {
  x: number
  y: number
  z: number
}

export interface HandSample {
  landmarks: Landmark[] // 21 puntos
  score: number // confianza 0..1
  handedness: 'Left' | 'Right' | string
}

export interface Vec2 {
  x: number
  y: number
}

export interface GestureState {
  detected: boolean
  handCount: number
  handCenter: Vec2 // normalizado 0..1 (espacio de imagen, sin espejar)
  handVelocity: Vec2 // unidades normalizadas / segundo
  pinchStrength: number // 0..1
  isPinching: boolean
  scaleFactor: number // objetivo multiplicativo (~0.4..2.8)
  squashFactor: number // 0..1
  jumpTrigger: boolean // pulso momentáneo (true un solo frame)
  walking: boolean
  walkDirection: number // -1 | 0 | 1
  confidence: number // 0..1
  openness: number // 0..1
}

/** Índices de landmarks de MediaPipe Hands que nos interesan. */
const LM = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  PINKY_MCP: 17,
  PINKY_TIP: 20,
} as const

// ── Parámetros de ajuste (tunables) ─────────────────────────────────────────
const CFG = {
  pinchThreshold: 0.55, // pinchStrength por encima de esto = agarrar
  velocitySmoothing: 0.35, // EMA de la velocidad (0=lento, 1=instantáneo)
  centerSmoothing: 0.45, // EMA del centro de la palma
  jumpVelocity: -1.25, // vy (norm/s) bajo este valor = salto (y crece hacia abajo)
  jumpCooldownMs: 520,
  squashVelocity: 1.15, // vy sobre este valor = empuje hacia abajo
  squashMax: 2.4,
  walkVxThreshold: 0.55, // amplitud mínima de vx para contar como zancada
  walkHistory: 16, // frames considerados para detectar oscilación
  walkMinCrossings: 2, // cambios de signo mínimos en la ventana
  scaleMin: 0.4,
  scaleMax: 2.8,
} as const

// ── Utilidades ──────────────────────────────────────────────────────────────
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function dist(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

/** Centro de palma = promedio de muñeca + nudillos (más estable que un punto). */
function palmCenter(lm: Landmark[]): Vec2 {
  const idx = [LM.WRIST, LM.INDEX_MCP, LM.MIDDLE_MCP, LM.RING_MCP, LM.PINKY_MCP]
  let x = 0
  let y = 0
  for (const i of idx) {
    x += lm[i].x
    y += lm[i].y
  }
  return { x: x / idx.length, y: y / idx.length }
}

// ════════════════════════════════════════════════════════════════════════════
//  GestureEngine
// ════════════════════════════════════════════════════════════════════════════
export class GestureEngine {
  private prevCenter: Vec2 | null = null
  private prevTime = 0
  private vel: Vec2 = { x: 0, y: 0 } // velocidad suavizada
  private smoothCenter: Vec2 | null = null
  private vxHistory: number[] = [] // para detectar caminar
  private lastJumpMs = 0
  private twoHandBaseline: number | null = null // distancia base entre 2 manos

  /** Reinicia el estado temporal (al apagar/encender cámara). */
  reset(): void {
    this.prevCenter = null
    this.prevTime = 0
    this.vel = { x: 0, y: 0 }
    this.smoothCenter = null
    this.vxHistory = []
    this.lastJumpMs = 0
    this.twoHandBaseline = null
  }

  /**
   * Procesa un frame. `hands` puede tener 0, 1 o 2 manos.
   * `nowMs` = performance.now().
   */
  update(hands: HandSample[], nowMs: number): GestureState {
    // ── Sin manos: estado neutro y limpiamos historial de velocidad ──────────
    if (!hands.length) {
      this.prevCenter = null
      this.smoothCenter = null
      this.vel = { x: lerp(this.vel.x, 0, 0.2), y: lerp(this.vel.y, 0, 0.2) }
      this.vxHistory = []
      this.twoHandBaseline = null
      return idleState()
    }

    const primary = hands[0]
    const lm = primary.landmarks
    const center = palmCenter(lm)

    // Suavizado del centro para que Aecodito no "tiemble".
    if (!this.smoothCenter) this.smoothCenter = center
    this.smoothCenter = {
      x: lerp(this.smoothCenter.x, center.x, CFG.centerSmoothing),
      y: lerp(this.smoothCenter.y, center.y, CFG.centerSmoothing),
    }

    // ── Velocidad (norm/s) con dt acotado para evitar picos ──────────────────
    let dt = this.prevTime ? (nowMs - this.prevTime) / 1000 : 0.016
    dt = clamp(dt, 0.008, 0.05)
    if (this.prevCenter) {
      const instVx = (center.x - this.prevCenter.x) / dt
      const instVy = (center.y - this.prevCenter.y) / dt
      this.vel = {
        x: lerp(this.vel.x, instVx, CFG.velocitySmoothing),
        y: lerp(this.vel.y, instVy, CFG.velocitySmoothing),
      }
    }
    this.prevCenter = center
    this.prevTime = nowMs

    // ── Tamaño de la mano (para normalizar distancias) ───────────────────────
    const handSize = Math.max(0.0001, dist(lm[LM.WRIST], lm[LM.MIDDLE_MCP]))

    // ── PINCH: pulgar ↔ índice ───────────────────────────────────────────────
    const pinchDist = dist(lm[LM.THUMB_TIP], lm[LM.INDEX_TIP]) / handSize
    // pinchDist ~0.15 (cerrado) .. ~1.2 (abierto). Lo mapeamos a 0..1 invertido.
    const pinchStrength = clamp(1 - (pinchDist - 0.18) / 0.85, 0, 1)
    const isPinching = pinchStrength >= CFG.pinchThreshold

    // ── OPENNESS / SPREAD: pulgar ↔ meñique ──────────────────────────────────
    const spread = dist(lm[LM.THUMB_TIP], lm[LM.PINKY_TIP]) / handSize
    const openness = clamp((spread - 0.6) / 1.6, 0, 1)

    // ── SCALE FACTOR ─────────────────────────────────────────────────────────
    // Con DOS manos: distancia entre palmas vs. línea base (pinza a dos manos).
    // Con UNA mano: derivado de la apertura (mano abierta = más grande).
    let scaleFactor: number
    if (hands.length >= 2) {
      const c0 = palmCenter(hands[0].landmarks)
      const c1 = palmCenter(hands[1].landmarks)
      const sep = dist(c0 as Landmark, c1 as Landmark)
      if (this.twoHandBaseline == null) this.twoHandBaseline = sep
      scaleFactor = clamp((sep / this.twoHandBaseline) * 1.0, CFG.scaleMin, CFG.scaleMax)
    } else {
      this.twoHandBaseline = null
      scaleFactor = clamp(0.55 + openness * 1.8, CFG.scaleMin, CFG.scaleMax)
    }

    // ── SQUASH: empuje hacia abajo (vy positivo = hacia abajo en imagen) ──────
    const squashFactor = clamp((this.vel.y - CFG.squashVelocity) / 1.6, 0, 1)

    // ── JUMP: movimiento ascendente rápido + cooldown ────────────────────────
    let jumpTrigger = false
    if (this.vel.y < CFG.jumpVelocity && nowMs - this.lastJumpMs > CFG.jumpCooldownMs) {
      jumpTrigger = true
      this.lastJumpMs = nowMs
    }

    // ── WALK: oscilación lateral repetida ────────────────────────────────────
    this.vxHistory.push(this.vel.x)
    if (this.vxHistory.length > CFG.walkHistory) this.vxHistory.shift()
    const walking = detectWalk(this.vxHistory)
    const walkDirection = walking ? Math.sign(this.vel.x) : 0

    return {
      detected: true,
      handCount: hands.length,
      handCenter: { ...this.smoothCenter },
      handVelocity: { ...this.vel },
      pinchStrength,
      isPinching,
      scaleFactor,
      squashFactor,
      jumpTrigger,
      walking,
      walkDirection,
      confidence: clamp(primary.score || 0.9, 0, 1),
      openness,
    }
  }
}

/** Detecta caminar: suficientes cruces de cero con amplitud en la ventana. */
function detectWalk(history: number[]): boolean {
  if (history.length < CFG.walkHistory) return false
  let crossings = 0
  let amplitudeHits = 0
  for (let i = 1; i < history.length; i++) {
    if (Math.abs(history[i]) > CFG.walkVxThreshold) amplitudeHits++
    const a = history[i - 1]
    const b = history[i]
    if (Math.abs(a) > CFG.walkVxThreshold * 0.6 && Math.sign(a) !== Math.sign(b)) {
      crossings++
    }
  }
  return crossings >= CFG.walkMinCrossings && amplitudeHits >= 3
}

/** Estado en reposo (sin manos). */
function idleState(): GestureState {
  return {
    detected: false,
    handCount: 0,
    handCenter: { x: 0.5, y: 0.5 },
    handVelocity: { x: 0, y: 0 },
    pinchStrength: 0,
    isPinching: false,
    scaleFactor: 1,
    squashFactor: 0,
    jumpTrigger: false,
    walking: false,
    walkDirection: 0,
    confidence: 0,
    openness: 0,
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  makePointerHand — generador de mano SINTÉTICA para el modo FALLBACK (mouse)
//  Construye 21 landmarks plausibles alrededor del cursor para que el MISMO
//  motor funcione sin cámara ni modelo de IA. Garantiza una demo siempre viva.
// ════════════════════════════════════════════════════════════════════════════
export function makePointerHand(
  nx: number, // posición x del cursor, normalizada 0..1
  ny: number, // posición y del cursor, normalizada 0..1
  pinch: boolean, // botón del mouse presionado = pinch
  spread01: number, // 0..1 apertura simulada (rueda del mouse → escala)
): HandSample {
  const z = 0
  const hs = 0.12 // tamaño de mano simulado
  // Puntos clave (los demás se rellenan por interpolación coherente).
  const wrist: Landmark = { x: nx, y: ny + hs * 1.05, z }
  const middleMcp: Landmark = { x: nx, y: ny + hs * 0.1, z }
  const indexMcp: Landmark = { x: nx - hs * 0.35, y: ny + hs * 0.2, z }
  const ringMcp: Landmark = { x: nx + hs * 0.32, y: ny + hs * 0.2, z }
  const pinkyMcp: Landmark = { x: nx + hs * 0.6, y: ny + hs * 0.35, z }

  // Pinch: pulgar e índice juntos. Sin pinch: separados (mano abierta).
  const pinchGap = pinch ? hs * 0.12 : hs * 0.7
  const thumbTip: Landmark = { x: nx + pinchGap * 0.5, y: ny - hs * 0.1, z }
  const indexTip: Landmark = { x: nx - pinchGap * 0.5, y: ny - hs * 0.55, z }

  // Meñique: la separación define openness/escala.
  const pinkyTip: Landmark = {
    x: nx + hs * (0.4 + spread01 * 1.0),
    y: ny - hs * (0.3 + spread01 * 0.3),
    z,
  }
  const middleTip: Landmark = { x: nx + hs * 0.05, y: ny - hs * 0.75, z }

  // Construimos los 21 con relleno coherente (sólo importan los índices clave).
  const lm: Landmark[] = new Array(21).fill(null).map((_, i) => {
    switch (i) {
      case LM.WRIST:
        return wrist
      case LM.THUMB_TIP:
        return thumbTip
      case LM.INDEX_MCP:
        return indexMcp
      case LM.INDEX_TIP:
        return indexTip
      case LM.MIDDLE_MCP:
        return middleMcp
      case LM.MIDDLE_TIP:
        return middleTip
      case LM.RING_MCP:
        return ringMcp
      case LM.PINKY_MCP:
        return pinkyMcp
      case LM.PINKY_TIP:
        return pinkyTip
      default:
        // Relleno: entre muñeca y centro de la palma.
        return { x: lerp(wrist.x, middleMcp.x, i / 21), y: lerp(wrist.y, middleMcp.y, i / 21), z }
    }
  })

  return { landmarks: lm, score: 0.99, handedness: 'Right' }
}

/** Conexiones del esqueleto de la mano (para dibujar en el overlay de debug). */
export const HAND_CONNECTIONS: ReadonlyArray<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], // pulgar
  [0, 5], [5, 6], [6, 7], [7, 8], // índice
  [5, 9], [9, 10], [10, 11], [11, 12], // medio
  [9, 13], [13, 14], [14, 15], [15, 16], // anular
  [13, 17], [17, 18], [18, 19], [19, 20], // meñique
  [0, 17], // base palma
]

export { clamp, lerp }
