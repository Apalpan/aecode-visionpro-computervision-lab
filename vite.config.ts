import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ──────────────────────────────────────────────────────────────────────────
//  base: './'  →  rutas RELATIVAS. Funciona tanto en local (`npm run dev`)
//  como en GitHub Pages bajo cualquier sub-ruta (https://user.github.io/REPO/).
//  Si prefieres una base absoluta, cámbiala por '/NOMBRE-DE-TU-REPO/'.
// ──────────────────────────────────────────────────────────────────────────
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: true, // expone la app en la red local para probar la cámara en el móvil (requiere HTTPS)
    port: 5173,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1400, // MediaPipe Tasks Vision es pesado; evitamos ruido en consola
  },
})
