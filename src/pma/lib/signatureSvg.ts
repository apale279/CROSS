/** Converte PNG (data URL) in SVG con immagine incorporata (formato vettoriale valido). */
export function pngDataUrlToSvgDataUrl(pngDataUrl: string, width = 600, height = 200): string {
  const src = pngDataUrl.trim()
  if (!src.startsWith('data:image')) {
    throw new Error('Formato immagine firma non valido.')
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#ffffff"/><image href="${src.replace(/"/g, '&quot;')}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/></svg>`
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22')
  return `data:image/svg+xml;charset=utf-8,${encoded}`
}

export function svgMarkupToDataUrl(svg: string): string {
  const raw = svg.trim()
  if (raw.startsWith('data:image/svg+xml')) return raw
  if (!raw.startsWith('<svg')) throw new Error('SVG firma non valido.')
  const encoded = encodeURIComponent(raw)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22')
  return `data:image/svg+xml;charset=utf-8,${encoded}`
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Lettura file non riuscita.'))
    }
    reader.onerror = () => reject(new Error('Lettura file non riuscita.'))
    reader.readAsDataURL(file)
  })
}

/** Rasterizza SVG o PNG data URL → PNG per PDF / anteprime legacy. */
export function rasterizeFirmaDataUrlToPng(dataUrl: string, maxW = 600, maxH = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const iw = img.naturalWidth || maxW
      const ih = img.naturalHeight || maxH
      let w = maxW
      let h = (ih / iw) * w
      if (h > maxH) {
        h = maxH
        w = (iw / ih) * h
      }
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(w))
      canvas.height = Math.max(1, Math.round(h))
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas non disponibile.'))
        return
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png', 0.92))
    }
    img.onerror = () => reject(new Error('Decodifica firma non riuscita.'))
    img.src = dataUrl
  })
}

export async function buildMedicoFirmaPayloadFromPng(pngDataUrl: string) {
  const png = pngDataUrl.trim()
  const svg = pngDataUrlToSvgDataUrl(png)
  return { pngDataUrl: png, svgDataUrl: svg }
}

export async function buildMedicoFirmaPayloadFromFile(file: File) {
  const raw = await readFileAsDataUrl(file)
  if (!raw.startsWith('data:image/')) {
    throw new Error('Carica un file immagine (PNG, JPG, …).')
  }
  const png = await rasterizeFirmaDataUrlToPng(raw)
  return buildMedicoFirmaPayloadFromPng(png)
}
