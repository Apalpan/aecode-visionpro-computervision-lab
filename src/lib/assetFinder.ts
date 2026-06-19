/**
 * assetFinder.ts — Resolución centralizada de assets de marca.
 *
 * · Resuelve rutas respetando `import.meta.env.BASE_URL`, así funcionan tanto
 *   en local como en GitHub Pages (cualquier sub-ruta).
 * · Provee un PLACEHOLDER elegante (SVG inline) por si falta algún asset:
 *   úsalo en `onError` de un <img> para no romper la UI.
 *
 * ▶ Para reemplazar un asset: deja el archivo nuevo en `public/assets/...`
 *   con el mismo nombre, o cambia la ruta aquí abajo. Nada más.
 */

const BASE = import.meta.env.BASE_URL // './' en local, '/REPO/' en Pages

const join = (p: string) => `${BASE}${p.replace(/^\//, '')}`

export const assets = {
  /** Logo principal AECODE (wordmark vectorial, fondo transparente). */
  logo: join('assets/aecode/aecode-logo.svg'),
  /** Isotipo AECODE (símbolo morado). */
  isotipo: join('assets/aecode/aecode-isotipo.png'),
  /** Render 3D de Aecodito (PNG). Útil en la pantalla de inicio. */
  aecoditoPng: join('assets/aecodito/aecodito.png'),
  /** Aecodito vectorial (SVG) — referencia de marca. */
  aecoditoSvg: join('assets/aecodito/aecodito-clear.svg'),
} as const

export type AssetKey = keyof typeof assets

/** Placeholder elegante en SVG (data URI). Morado + núcleo verde. */
export const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <defs><radialGradient id="g" cx="50%" cy="42%" r="60%">
        <stop offset="0" stop-color="#7C3AED"/><stop offset="1" stop-color="#15051F"/>
      </radialGradient></defs>
      <rect width="240" height="240" rx="28" fill="url(#g)"/>
      <circle cx="120" cy="100" r="46" fill="#111827" stroke="#a855f7" stroke-width="3"/>
      <circle cx="120" cy="100" r="16" fill="#6CFFAE"/>
      <text x="120" y="190" text-anchor="middle" fill="#cbb6e6" font-family="monospace" font-size="16">ASSET</text>
    </svg>`,
  )

/** Handler para <img onError>: cae al placeholder sin romper el layout. */
export function onImgError(e: React.SyntheticEvent<HTMLImageElement>): void {
  const img = e.currentTarget
  if (img.src !== PLACEHOLDER) img.src = PLACEHOLDER
}
