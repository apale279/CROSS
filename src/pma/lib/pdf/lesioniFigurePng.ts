import type { LesioneMarker } from '@pma/types/lesioni'

const VB_W = 200
const VB_H = 480
const GAP = 20
const TOTAL_W = VB_W * 2 + GAP

/** Silhouette paths (allineati a LesioniBodyMap.tsx). */
const SILHOUETTE = `
  <g fill="#e2e8f0" stroke="#64748b" stroke-width="1.2">
    <ellipse cx="100" cy="42" rx="22" ry="26" />
    <rect x="92" y="64" width="16" height="18" rx="4" />
    <path d="M 52 88 Q 100 78 148 88 L 155 175 Q 100 185 45 175 Z" fill="#f1f5f9" />
    <path d="M 58 175 L 142 175 L 138 230 L 62 230 Z" fill="#f1f5f9" />
    <path d="M 62 228 L 78 228 L 82 400 L 68 405 Z" />
    <path d="M 122 228 L 138 228 L 132 405 L 118 400 Z" />
    <path d="M 52 95 L 28 165 L 38 172 L 58 115 Z" />
    <path d="M 148 95 L 172 165 L 162 172 L 142 115 Z" />
  </g>
`

function markersGroup(lesioni: LesioneMarker[], vista: LesioneMarker['vista'], xOffset: number): string {
  return lesioni
    .filter((m) => m.vista === vista)
    .map(
      (m) => `
    <g transform="translate(${xOffset + m.x} ${m.y})">
      <circle r="14" fill="#dc2626" opacity="0.92" />
      <text x="0" y="5" text-anchor="middle" fill="#ffffff" font-size="13" font-weight="bold" font-family="system-ui,sans-serif">${m.n}</text>
    </g>`,
    )
    .join('')
}

/**
 * PNG (data URL) fronte+retro con marker, per inclusione nel PDF.
 */
export async function buildLesioniPngDataUrl(lesioni: LesioneMarker[]): Promise<string | null> {
  if (!lesioni.length) return null

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${TOTAL_W}" height="${VB_H}" viewBox="0 0 ${TOTAL_W} ${VB_H}">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <text x="100" y="22" text-anchor="middle" font-size="12" font-weight="600" fill="#64748b" font-family="system-ui,sans-serif">Fronte</text>
  <g transform="translate(0 28)">${SILHOUETTE}${markersGroup(lesioni, 'front', 0)}</g>
  <text x="${VB_W + GAP / 2 + VB_W}" y="22" text-anchor="middle" font-size="12" font-weight="600" fill="#64748b" font-family="system-ui,sans-serif">Retro</text>
  <g transform="translate(${VB_W + GAP} 28)">${SILHOUETTE}${markersGroup(lesioni, 'back', 0)}</g>
</svg>`

  const img = new Image()
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('SVG lesioni non caricabile.'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    const scale = 1.5
    canvas.width = Math.round(TOTAL_W * scale)
    canvas.height = Math.round(VB_H * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}
