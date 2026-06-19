/**
 * useHandTracking — enciende la cámara y corre MediaPipe HandLandmarker.
 *
 *  · Modo principal: detección REAL de manos en el navegador (Chrome ✓).
 *  · Fallback robusto: si la cámara o el modelo fallan, cambia a MODO MOUSE
 *    generando una mano sintética alrededor del cursor (la demo nunca muere).
 *
 *  Expone `handsRef` (mutable, sin re-render) que el controlador de gestos
 *  lee cada frame, más estado de React para la UI (status, fps, mode, error).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { makePointerHand, type HandSample } from '../lib/gestureEngine'

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

export type TrackingStatus =
  | 'idle'
  | 'requesting-camera'
  | 'loading-model'
  | 'tracking'
  | 'fallback'
  | 'error'

export type TrackingMode = 'mediapipe' | 'mouse'

export interface HandTracking {
  videoRef: React.RefObject<HTMLVideoElement>
  handsRef: React.MutableRefObject<HandSample[]>
  status: TrackingStatus
  mode: TrackingMode
  fps: number
  error: string | null
  start: () => Promise<void>
  startMouse: () => void
  stop: () => void
}

export function useHandTracking(): HandTracking {
  const videoRef = useRef<HTMLVideoElement>(null)
  const handsRef = useRef<HandSample[]>([])

  const [status, setStatus] = useState<TrackingStatus>('idle')
  const [mode, setMode] = useState<TrackingMode>('mediapipe')
  const [fps, setFps] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Refs internos (no provocan re-render)
  const landmarkerRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastVideoTimeRef = useRef(-1)
  const fpsRef = useRef({ frames: 0, last: performance.now() })

  // Estado del puntero para el fallback de mouse
  const pointerRef = useRef({ x: 0.5, y: 0.5, pinch: false, spread: 0.4 })
  const pointerBoundRef = useRef(false)

  // ── Bucle de detección con MediaPipe ──────────────────────────────────────
  const detectLoop = useCallback(() => {
    const video = videoRef.current
    const landmarker = landmarkerRef.current
    if (!video || !landmarker) return

    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime
      try {
        const res = landmarker.detectForVideo(video, performance.now())
        const out: HandSample[] = []
        const lists = res?.landmarks ?? []
        const handed = res?.handednesses ?? res?.handedness ?? []
        for (let i = 0; i < lists.length; i++) {
          const cat = handed[i]?.[0]
          out.push({
            landmarks: lists[i],
            score: cat?.score ?? 0.9,
            handedness: cat?.categoryName ?? 'Right',
          })
        }
        handsRef.current = out
      } catch {
        // un frame fallido no debe tumbar el loop
      }
    }

    // FPS (actualizamos el estado ~2 veces por segundo)
    const now = performance.now()
    fpsRef.current.frames++
    if (now - fpsRef.current.last >= 500) {
      setFps(Math.round((fpsRef.current.frames * 1000) / (now - fpsRef.current.last)))
      fpsRef.current.frames = 0
      fpsRef.current.last = now
    }

    rafRef.current = requestAnimationFrame(detectLoop)
  }, [])

  // ── Activar fallback de mouse ─────────────────────────────────────────────
  const enableMouseFallback = useCallback(() => {
    setMode('mouse')
    setStatus('fallback')

    if (!pointerBoundRef.current) {
      pointerBoundRef.current = true
      const onMove = (e: PointerEvent) => {
        pointerRef.current.x = e.clientX / window.innerWidth
        pointerRef.current.y = e.clientY / window.innerHeight
      }
      const onDown = () => (pointerRef.current.pinch = true)
      const onUp = () => (pointerRef.current.pinch = false)
      const onWheel = (e: WheelEvent) => {
        pointerRef.current.spread = Math.min(1, Math.max(0, pointerRef.current.spread - e.deltaY * 0.0012))
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerdown', onDown)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('wheel', onWheel, { passive: true })
      // guardamos los removers en el ref del stream-cleanup mediante closure
      ;(pointerBoundRef as any).cleanup = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerdown', onDown)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('wheel', onWheel)
      }
    }

    const loop = () => {
      const p = pointerRef.current
      handsRef.current = [makePointerHand(p.x, p.y, p.pinch, p.spread)]
      rafRef.current = requestAnimationFrame(loop)
    }
    loop()
  }, [])

  // ── Encender ──────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    setError(null)

    // 1) Cámara
    let stream: MediaStream
    try {
      setStatus('requesting-camera')
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()
    } catch (err) {
      console.warn('[VisionPro] Cámara no disponible, usando fallback de mouse:', err)
      setError('No se pudo acceder a la cámara. Activado modo mouse (mueve el cursor).')
      enableMouseFallback()
      return
    }

    // 2) Modelo de IA (MediaPipe Tasks Vision)
    try {
      setStatus('loading-model')
      const vision = await import('@mediapipe/tasks-vision')
      const { HandLandmarker, FilesetResolver } = vision
      const fileset = await FilesetResolver.forVisionTasks(WASM_CDN)

      const makeOptions = (delegate: 'GPU' | 'CPU') => ({
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'VIDEO' as const,
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })

      try {
        landmarkerRef.current = await HandLandmarker.createFromOptions(fileset, makeOptions('GPU'))
      } catch {
        landmarkerRef.current = await HandLandmarker.createFromOptions(fileset, makeOptions('CPU'))
      }

      setMode('mediapipe')
      setStatus('tracking')
      rafRef.current = requestAnimationFrame(detectLoop)
    } catch (err) {
      console.warn('[VisionPro] Modelo de manos no cargó, usando fallback de mouse:', err)
      setError('El modelo de IA no se pudo cargar (¿sin conexión?). Activado modo mouse.')
      // Apaga la cámara: en modo mouse no la usamos (y se apaga el indicador).
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      enableMouseFallback()
    }
  }, [detectLoop, enableMouseFallback])

  // ── Apagar ──────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    try {
      landmarkerRef.current?.close?.()
    } catch {
      /* noop */
    }
    landmarkerRef.current = null
    handsRef.current = []
    lastVideoTimeRef.current = -1
    setStatus('idle')
  }, [])

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      stop()
      ;(pointerBoundRef as any).cleanup?.()
    }
  }, [stop])

  return { videoRef, handsRef, status, mode, fps, error, start, startMouse: enableMouseFallback, stop }
}
