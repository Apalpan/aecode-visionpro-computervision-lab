# AECODE VisionPro Lab · Computer Vision

> **Computer Vision + Gesture Interaction + AI Interface.**
> Laboratorio web ultra-interactivo para manipular a **Aecodito** con las manos,
> en tiempo real, desde el navegador. Estética **Jarvis morado** (violeta neón +
> azul eléctrico + negro premium) con HUD futurista estilo Apple Vision Pro.

<p align="center"><em>“Enciende la cámara, muestra tu mano y juega con la mascota de AECODE.”</em></p>

---

## ✨ Qué hace

- 🎥 **Enciende la cámara** desde el navegador (100% local).
- 🖐️ **Detecta tus manos** en tiempo real con Computer Vision (MediaPipe Hands).
- 🤖 **Aecodito manipulable**: lo agarras, mueves, escalas, aplastas, haces saltar y caminar.
- 🟣 **HUD estilo Jarvis**: escáner circular, esquineros técnicos, retícula de tracking, partículas moradas, ondas de energía y glow neón.
- 🧠 **Modo “AI Vision Active”** con telemetría en vivo (confianza, FPS, escala, pinch).
- 🛟 **Fallback de mouse**: si la cámara o el modelo de IA no están disponibles, la demo sigue funcionando con el cursor.

---

## 🚀 Instalación y uso local

Requisitos: **Node 18+** y un navegador moderno (**Chrome recomendado**).

```bash
npm install      # instala dependencias
npm run dev      # arranca en http://localhost:5173
```

Abre la URL, pulsa **“Activar cámara”** y permite el acceso cuando el navegador lo pida.

> 🔒 **Privacidad**: el video **nunca sale de tu equipo**. Todo el procesamiento
> (cámara + modelo de manos) ocurre en el navegador. No se graba ni se sube nada.

### Compilar para producción

```bash
npm run build    # type-check + bundle optimizado en /dist
npm run preview  # sirve el build localmente para verificar
```

---

## 🎮 Cómo activar la cámara

1. Pulsa **“Activar cámara”** en la pantalla de inicio.
2. El navegador pedirá permiso de cámara → **Permitir**.
3. Verás tu video (espejado) con el HUD morado encima.
4. Muestra tu mano: aparecerán los indicadores de tracking y podrás manipular a Aecodito.

> ¿Sin cámara o sin internet para el modelo? Usa **“Probar sin cámara (modo mouse)”**:
> mueve el cursor (mano), mantén **click** (pinch/agarrar), rueda del mouse (escala).

> ⚠️ La cámara requiere un **contexto seguro**: funciona en `localhost` y en
> **HTTPS** (GitHub Pages lo es). En `http://` plano el navegador la bloquea.

---

## 🖐️ Gestos disponibles

| Gesto | Cómo se hace | Efecto en Aecodito |
|------|---------------|--------------------|
| **Agarrar** | *Pinch*: junta pulgar e índice cerca de él | Lo sujeta (anillo de energía) |
| **Mover** | Arrastra la mano mientras lo sostienes | Se desplaza siguiéndote |
| **Escalar** | Abre mucho la mano · o usa **dos manos** y sepáralas | Crece / encoge |
| **Aplastar** | Empuja la mano hacia **abajo** sobre él | Se achata (*squash*) |
| **Saltar** | Sube la mano **rápido** | Salta con gravedad |
| **Caminar** | Mueve la mano de **lado a lado** repetidamente | Camina con contoneo |

El panel izquierdo se **enciende** mostrando el gesto activo en cada momento.

---

## 🏗️ Arquitectura del proyecto

```
aecode-visionpro-computervision-lab/
├─ public/assets/
│  ├─ aecode/        # logo + isotipo de marca
│  └─ aecodito/      # render PNG + SVG de la mascota (reemplazables)
├─ src/
│  ├─ components/
│  │  ├─ CameraVision.tsx    # fondo de video + capas de ambiente
│  │  ├─ HandTracker.tsx     # overlay de landmarks / indicadores de tracking
│  │  ├─ AecoditoAvatar.tsx  # Aecodito SVG animable (squash, ojo IA, glow)
│  │  ├─ JarvisHUD.tsx       # HUD: escáner, retícula, telemetría, controles
│  │  ├─ GesturePanel.tsx    # leyenda de gestos con estado activo
│  │  └─ ParticleField.tsx   # partículas moradas + ondas de energía (Canvas 2D)
│  ├─ hooks/
│  │  ├─ useHandTracking.ts  # cámara + MediaPipe HandLandmarker (+ fallback mouse)
│  │  └─ useGestureControls.ts # física de Aecodito + MotionValues (60fps)
│  ├─ lib/
│  │  ├─ gestureEngine.ts    # landmarks → señales de gesto (pinch, escala, salto…)
│  │  └─ assetFinder.ts      # rutas de assets + placeholder
│  ├─ styles/globals.css     # tokens OKLCH (paleta morada) + utilidades HUD
│  ├─ App.tsx                # orquestador (intro ↔ experiencia activa)
│  └─ main.tsx
├─ vite.config.ts            # base relativa para GitHub Pages
├─ tailwind.config.ts        # marca (colores/tipografías/animaciones)
└─ .github/workflows/deploy.yml  # despliegue automático a Pages
```

### Flujo de datos

```
cámara → useHandTracking (MediaPipe) → handsRef (21 landmarks)
              │
              ▼
        gestureEngine  →  GestureState (pinch, velocidad, escala, salto, caminar…)
              │
              ▼
        useGestureControls  →  física + MotionValues  →  AecoditoAvatar (60fps)
                                                   └──→  telemetry → HUD / GesturePanel
```

### Stack

- **Vite + React + TypeScript**
- **Tailwind CSS** (tokens OKLCH derivados de un solo `--brand-hue`)
- **Framer Motion** (MotionValues → animación sin re-render)
- **@mediapipe/tasks-vision** — `HandLandmarker` (21 landmarks, hasta 2 manos)
- **Canvas 2D** para partículas/overlays (más ligero que WebGL aquí)

---

## 🌐 Desplegar en GitHub Pages

`vite.config.ts` usa `base: './'` (rutas relativas), así que funciona en cualquier
sub-ruta de Pages **sin cambios**. Hay dos formas:

### Opción A · Automática (GitHub Actions) — recomendada

1. Sube el repo a GitHub.
2. En **Settings → Pages → Build and deployment → Source**, elige **GitHub Actions**.
3. Haz `push` a `main`. El workflow [`deploy.yml`](.github/workflows/deploy.yml)
   compila y publica solo. URL final: `https://<usuario>.github.io/<repo>/`.

### Opción B · Manual (`gh-pages`)

```bash
npm run deploy   # ejecuta build y publica /dist en la rama gh-pages
```

Luego en **Settings → Pages → Source** elige la rama `gh-pages`.

> 💡 Si prefieres una **base absoluta** (en vez de relativa), abre `vite.config.ts`
> y cambia `base: './'` por `base: '/NOMBRE-DE-TU-REPO/'`.

---

## 🔧 Reemplazar los assets de marca

Deja tus archivos en `public/assets/...` con el **mismo nombre**, o edita las rutas
en [`src/lib/assetFinder.ts`](src/lib/assetFinder.ts). Si falta un asset, la app
usa un placeholder elegante automáticamente (no se rompe el layout).

- `public/assets/aecode/aecode-logo.svg` — logo principal
- `public/assets/aecode/aecode-isotipo.png` — isotipo
- `public/assets/aecodito/aecodito.png` — render de la mascota (pantalla inicio)

Aecodito **en escena** es un SVG inline en `AecoditoAvatar.tsx` (para poder animarlo
parte por parte). Si quieres usar el PNG/otro modelo, sustituye ese componente.

---

## 🧪 Ajustar la sensibilidad de los gestos

Todos los umbrales viven en `CFG` dentro de
[`src/lib/gestureEngine.ts`](src/lib/gestureEngine.ts) (pinch, velocidad de salto,
detección de caminar, escala…) y la física en las constantes de
[`src/hooks/useGestureControls.ts`](src/hooks/useGestureControls.ts) (gravedad,
impulso de salto, velocidad al caminar). Están comentados para iterar rápido.

---

## 🛣️ Próximos upgrades posibles

- 👋 **Más gestos**: pulgar arriba, “OK”, mano abierta = onda expansiva.
- 🧍 **Múltiples Aecoditos** y colisiones entre ellos.
- 🌊 Reemplazar Canvas 2D por **WebGL/Three.js** para partículas masivas y shaders.
- 🦴 **Pose/cuerpo completo** (MediaPipe Pose) para interacción con todo el cuerpo.
- 🎙️ Comandos de **voz** (Web Speech API) → “salta”, “crece”, “camina”.
- 📸 **Capturar/compartir** un GIF de la sesión (sin subir video).
- 🏗️ Conectar con los módulos reales de **VisionPro** (detección en obra) como demo educativa.

---

<p align="center">
  <strong>AECODE</strong> · Ingeniería &amp; Construcción Moderna · VisionPro Lab
</p>
