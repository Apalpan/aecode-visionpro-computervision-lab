/**
 * useHandTracking — enciende la cámara y corre MediaPipe en el navegador.
 *
 *  · Manos: HandLandmarker (21 landmarks, hasta 2 manos) → control de gestos.
 *  · Rostro: FaceDetector (caja + puntos clave), activable con un toggle.
 *  · Fallback robusto: si la cámara o el modelo fallan → MODO MOUSE (mano
 *    sintética alrededor del cursor). La demo nunca muere.
 *
 *  Todo el procesamiento es LOCAL en el navegador (privacidad: no se sube video).
 *  Expone refs mutables (sin re-render) que los overlays leen cada frame.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { makePointerHand, type HandSample } from '../lib/gestureEngine'

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
const HAND_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'

export type TrackingStatus =
  | 'idle'
  | 'requesting-camera'
  | 'loading-model'
  | 'tracking'
  | 'fallback'
  | 'error'

export type TrackingMode = 'mediapipe' | 'mouse'

/** Rostro detectado, en coordenadas NORMALIZADAS 0..1 (sin espejar). */
export interface FaceSample {
  x: number
  y: number
  w: number
  h: number
  score: number
  keypoints: Array<{ x: number; y: number }>
}

export interface HandTracking {
  videoRef: React.RefObject<HTMLVideoElement>
  handsRef: React.MutableRefObject<HandSample[]>
  facesRef: React.MutableRefObject<FaceSample[]>
  status: TrackingStatus
  mode: TrackingMode
  fps: number
  error: string | null
  faceEnabled: boolean
  setFaceEnabled: (v: boolean) => void
  start: () => Promise<void>
  startMouse: () => void
  stop: () => void
}

export function useHandTracking(): HandTracking {
  const videoRef = useRef<HTMLVideoElement>(null)
  const handsRef = useRef<HandSample[]>([])
  const facesRef = useRef<FaceSample[]>([])

  const [status, setStatus] = useState<TrackingStatus>('idle')
  const [mode, setMode] = useState<TrackingMode>('mediapipe')
  const [fps, setFps] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [faceEnabled, setFaceEnabled] = useState(false)

  // Refs internos (no provocan re-render)
  const landmarkerRef = useRef<any>(null)
  const faceDetectorRef = useRef<any>(null)
  const filesetRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastVideoTimeRef = useRef(-1)
  const fpsRef = useRef({ frames: 0, last: performance.now() })

  // Estado del puntero (fallback de mouse)
  const pointerRef = useRef({ x: 0.5, y: 0.5, pinch: false, spread: 0.4 })
  const pointerBoundRef = useRef(false)

  // Refs espejo de estado para usar dentro del loop sin recrearlo
  const faceEnabledRef = useRef(faceEnabled)
  faceEnabledRef.current = faceEnabled
  const statusRef = useRef(status)
  statusRef.current = status

  // ── Bucle de detección con MediaPipe ──────────────────────────────────────
  const detectLoop = useCallback(() => {
    const video = videoRef.current
    const landmarker = landmarkerRef.current
    if (!video || !landmarker) return

    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime
      const ts = performance.now()

      // Manos
      try {
        const res = landmarker.detectForVideo(video, ts)
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
        /* un frame fallido no debe tumbar el loop */
      }

      // Rostro (sólo si está activado y el detector está listo)
      if (faceEnabledRef.current && faceDetectorRef.current) {
        try {
          const fr = faceDetectorRef.current.detectForVideo(video, ts + 0.01)
          const vw = video.videoWidth || 1280
          const vh = video.videoHeight || 720
          facesRef.current = (fr?.detections ?? []).map((d: any) => ({
            x: (d.boundingBox?.originX ?? 0) / vw,
            y: (d.boundingBox?.originY ?? 0) / vh,
            w: (d.boundingBox?.width ?? 0) / vw,
            h: (d.boundingBox?.height ?? 0) / vh,
            score: d.categories?.[0]?.score ?? 1,
            keypoints: (d.keypoints ?? []).map((k: any) => ({ x: k.x, y: k.y })),
          }))
        } catch {
          /* idem */
        }
      } else if (facesRef.current.length) {
        facesRef.current = []
      }
    }

    // FPS (~2 veces por segundo)
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
    facesRef.current = []

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

  // ── Encender (cámara + modelo de manos) ───────────────────────────────────
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

    // 2) Modelo de manos (MediaPipe Tasks Vision)
    try {
      setStatus('loading-model')
      const vision = await import('@mediapipe/tasks-vision')
      const { HandLandmarker, FilesetResolver } = vision
      const fileset = await FilesetResolver.forVisionTasks(WASM_CDN)
      filesetRef.current = fileset

      const makeOptions = (delegate: 'GPU' | 'CPU') => ({
        baseOptions: { modelAssetPath: HAND_MODEL, delegate },
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
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      enableMouseFallback()
    }
  }, [detectLoop, enableMouseFallback])

  // ── Crear el detector facial bajo demanda ─────────────────────────────────
  useEffect(() => {
    let cancelled = false
    if (faceEnabled && mode === 'mediapipe' && status === 'tracking' && !faceDetectorRef.current) {
      ;(async () => {
        try {
          const vision = await import('@mediapipe/tasks-vision')
          const fileset = filesetRef.current ?? (await vision.FilesetResolver.forVisionTasks(WASM_CDN))
          filesetRef.current = fileset
          const opts = (delegate: 'GPU' | 'CPU') => ({
            baseOptions: { modelAssetPath: FACE_MODEL, delegate },
            runningMode: 'VIDEO' as const,
          })
          let fd: any
          try {
            fd = await vision.FaceDetector.createFromOptions(fileset, opts('GPU'))
          } catch {
            fd = await vision.FaceDetector.createFromOptions(fileset, opts('CPU'))
          }
          if (!cancelled) faceDetectorRef.current = fd
          else fd?.close?.()
        } catch (err) {
          console.warn('[VisionPro] No se pudo cargar el detector facial:', err)
        }
      })()
    }
    return () => {
      cancelled = true
    }
  }, [faceEnabled, mode, status])

  // ── Apagar ──────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    try {
      landmarkerRef.current?.close?.()
      faceDetectorRef.current?.close?.()
    } catch {
      /* noop */
    }
    landmarkerRef.current = null
    faceDetectorRef.current = null
    handsRef.current = []
    facesRef.current = []
    lastVideoTimeRef.current = -1
    setStatus('idle')
  }, [])

  useEffect(() => {
    return () => {
      stop()
      ;(pointerBoundRef as any).cleanup?.()
    }
  }, [stop])

  return {
    videoRef,
    handsRef,
    facesRef,
    status,
    mode,
    fps,
    error,
    faceEnabled,
    setFaceEnabled,
    start,
    startMouse: enableMouseFallback,
    stop,
  }
}
