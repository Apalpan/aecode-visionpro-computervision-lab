# AECODE VisionPro Lab · Aecodito Brain + Computer Vision

> **Aecodito Brain + Computer Vision + Gesture Control.**
> Laboratorio web ultra-interactivo: manipula a **Aecodito Brain** (un plexus 3D)
> con las manos en tiempo real, desde el navegador. Estética **morada premium**
> (violeta neón + azul eléctrico + negro premium) con HUD futurista estilo
> Apple Vision Pro.

---

## ✨ Qué hace

- 🧠 **Núcleo neuronal 3D manipulable** (plexus de nodos + conexiones + pulsos de señal).
- 🎛️ **Dos modos**:
  - **Modo Aecodito** — solo el núcleo, **sin cámara**; lo controlas con el **mouse**.
  - **Modo Interactivo** — **cámara + manos**: manipulas la red con gestos reales.
- 🖐️ **Detección de manos** en tiempo real (MediaPipe HandLandmarker, hasta 2 manos).
- 🙂 **Detección facial** opcional (MediaPipe FaceDetector) con HUD de "rostro fijado".
- 🟣 **HUD futurista**: escáner circular, esquineros, retícula de tracking, partículas, ondas de energía, glow neón.
- 🎨 La red **cambia de color según su posición**: morado oscuro al centro, RGB hacia los costados.
- 🎚️ **Nivel de poder** (135–145) en cámara + **detección facial elegante** con tarjeta tipo scouter.
- 👁️ **Vista limpia**: un botón oculta los paneles para máxima visibilidad del núcleo.
- 🛟 **Fallback de mouse**: si la cámara o el modelo fallan, la demo sigue viva.
- 🔒 **100% local**: el video nunca sale de tu equipo.

---

## 🤔 ¿Por qué MediaPipe y no Python/OpenCV?

Esta app es un **sitio estático** (se publica en GitHub Pages), así que **corre por
completo en el navegador** — no hay servidor donde ejecutar Python. La mejor opción
de Computer Vision *del lado del cliente* es **Google MediaPipe Tasks Vision**
(WASM + WebGL), que es justamente lo que usa aquí para manos y rostro. Ventaja
extra: **privacidad total** (el video no se sube a ningún lado).

> Si necesitas **Python + OpenCV** (p. ej. para procesar cámaras IP, RTSP o correr
> modelos pesados del lado del servidor), eso es una **app de escritorio/servidor
> aparte** — se puede construir como un segundo entregable; no aplica a este deploy.

---

## 🚀 Instalación y uso local

Requisitos: **Node 18+** y **Chrome** (recomendado).

```bash
npm install      # instala dependencias
npm run dev      # http://localhost:5173
```

En la pantalla de inicio elige **Modo Aecodito** o **Modo Interactivo**.
En modo cámara, permite el acceso cuando el navegador lo pida.

### Compilar / previsualizar

```bash
npm run build    # type-check + bundle optimizado en /dist
npm run preview  # sirve el build localmente
```

> ⚠️ La cámara requiere **contexto seguro**: funciona en `localhost` y en **HTTPS**
> (GitHub Pages lo es). En `http://` plano el navegador la bloquea.

---

## 🎮 Modos

| Modo | Cámara | Control | Ideal para |
|------|:------:|---------|-----------|
| **Aecodito** | ❌ | Mouse (click = agarrar, arrastrar = mover, rueda = escalar) | Mostrar el núcleo como un holograma en pantalla |
| **Interactivo** | ✅ | Manos (gestos) + detección facial opcional | Demo "wow" donde manipulas la red con las manos |

Puedes **cambiar de modo en caliente** con el selector **Aecodito / Cámara** del HUD.

---

## 🖐️ Gestos (Modo Interactivo)

| Gesto | Cómo se hace | Efecto |
|------|---------------|--------|
| **Agarrar** | *Pinch*: junta pulgar e índice cerca del núcleo | Lo sujeta (energía ↑) |
| **Mover** | Arrastra la mano mientras lo sostienes | Se desplaza siguiéndote |
| **Escalar / Zoom** | Abre la mano · o usa **dos manos** y sepáralas | Crece / encoge |
| **Rotar** | Mueve la mano de lado mientras lo agarras | Gira el plexus |
| **Energizar** | Pinch fuerte / sostenido | Más brillo y más señales viajando |

En **Modo Aecodito** los mismos efectos se logran con **mouse** (click, arrastrar, rueda).
El panel izquierdo se **enciende** mostrando el gesto activo.

---

## 🙂 Detección facial

Actívala con el toggle **Rostro ON/OFF** (solo en Modo Interactivo). Dibuja una caja
de "objetivo" con esquineros animados, línea de escaneo y los puntos clave del rostro
(ojos, nariz, boca) — estilo Aecodito. El modelo se carga **bajo demanda** (solo cuando
lo activas) para no penalizar el arranque.

---

## 🏗️ Arquitectura

```
src/
├─ components/
│  ├─ CameraVision.tsx    # fondo de video + capas de ambiente
│  ├─ HandTracker.tsx     # overlay de landmarks / indicadores de tracking
│  ├─ FaceTracker.tsx     # overlay de detección facial (HUD de objetivo)
│  ├─ NeuralNetwork.tsx   # núcleo neuronal 3D (plexus) manipulable
│  ├─ AecoditoHUD.tsx       # HUD: escáner, retícula, telemetría, selector de modo
│  ├─ GesturePanel.tsx    # leyenda de gestos con estado activo
│  └─ ParticleField.tsx   # partículas + ondas de energía (Canvas 2D)
├─ hooks/
│  ├─ useHandTracking.ts  # cámara + HandLandmarker + FaceDetector (+ fallback mouse)
│  └─ useGestureControls.ts # física del núcleo flotante + MotionValues (60fps)
├─ lib/
│  ├─ gestureEngine.ts    # landmarks → señales de gesto (pinch, escala, velocidad…)
│  └─ assetFinder.ts      # rutas de assets + placeholder
├─ styles/globals.css     # tokens OKLCH (paleta morada) + utilidades HUD
├─ App.tsx                # orquestador (inicio ↔ activo, selector de modo)
└─ main.tsx
```

### Stack

- **Vite + React + TypeScript + Tailwind** (tokens OKLCH derivados de `--brand-hue`)
- **Framer Motion** (MotionValues → animación sin re-render)
- **@mediapipe/tasks-vision** — `HandLandmarker` + `FaceDetector`
- **Canvas 2D** para Aecodito Brain y los overlays (más ligero que WebGL aquí)

---

## 🌐 Desplegar en GitHub Pages

`vite.config.ts` usa `base: './'` (rutas relativas) → funciona en cualquier sub-ruta
de Pages sin cambios.

### Automático (recomendado)
1. Sube el repo a GitHub.
2. **Settings → Pages → Source → GitHub Actions**.
3. `push` a `main`: el workflow [`deploy.yml`](.github/workflows/deploy.yml) compila y publica.
   URL: `https://<usuario>.github.io/<repo>/`.

### Manual
```bash
npm run deploy   # build + publica /dist en la rama gh-pages
```

> 💡 Para base absoluta, cambia `base: './'` por `base: '/NOMBRE-DE-TU-REPO/'`.

---

## 🔧 Ajustes rápidos

- Sensibilidad de gestos → `CFG` en [`src/lib/gestureEngine.ts`](src/lib/gestureEngine.ts).
- Física del núcleo (seguimiento, escala, retorno al centro) → constantes en
  [`src/hooks/useGestureControls.ts`](src/hooks/useGestureControls.ts).
- Densidad / colores de la red → [`src/components/NeuralNetwork.tsx`](src/components/NeuralNetwork.tsx).
- Assets de marca → reemplaza en `public/assets/...` o edita [`src/lib/assetFinder.ts`](src/lib/assetFinder.ts).

---

## 🛣️ Próximos upgrades

- 🤲 Gestos extra: dos manos para "estirar" la red, mano abierta = onda expansiva.
- 🧬 La red **reacciona al rostro** (mira hacia ti / se ilumina al detectarte).
- 🌊 Migrar el render a **WebGL/Three.js** para partículas masivas y shaders.
- 🎙️ Comandos de **voz** (Web Speech API): "agranda", "rota", "reinicia".
- 🐍 Variante **Python + OpenCV** de escritorio para cámaras IP/RTSP (entregable aparte).

---

<p align="center"><strong>AECODE</strong> · Ingeniería &amp; Construcción Moderna · VisionPro Lab</p>
