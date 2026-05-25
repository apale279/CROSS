import type { UserProfile } from '@pma/types/userProfile'
import { svgMarkupToDataUrl } from './signatureSvg'

/** Sorgente immagine firma medico (preferenza SVG, poi PNG, poi URL legacy). */
export function resolveMedicoFirmaSrc(
  profile: Pick<UserProfile, 'firma_medico_svg' | 'firma_medico_base64' | 'firmaUrl'> | null | undefined,
): string | null {
  const svg = profile?.firma_medico_svg?.trim()
  if (svg) {
    if (svg.startsWith('data:')) return svg
    if (svg.startsWith('<svg')) {
      try {
        return svgMarkupToDataUrl(svg)
      } catch {
        return null
      }
    }
    return svg
  }
  const png = profile?.firma_medico_base64?.trim()
  if (png) return png
  const url = profile?.firmaUrl?.trim()
  return url || null
}

/** PNG per PDF (raster); se solo SVG, il chiamante deve rasterizzare. */
export function resolveMedicoFirmaPngSrc(
  profile: Pick<UserProfile, 'firma_medico_svg' | 'firma_medico_base64' | 'firmaUrl'> | null | undefined,
): string | null {
  const png = profile?.firma_medico_base64?.trim()
  if (png) return png
  return resolveMedicoFirmaSrc(profile)
}
