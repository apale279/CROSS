/**
 * Upload non firmato verso Cloudinary (preset “unsigned” nel dashboard Cloudinary).
 * Variabili: `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET`.
 */
export async function cloudinaryUnsignedUpload(file: File): Promise<{ secure_url: string }> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim()
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim()
  if (!cloudName || !uploadPreset) {
    throw new Error(
      'Configura VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET (preset unsigned su Cloudinary).',
    )
  }

  const body = new FormData()
  body.append('file', file)
  body.append('upload_preset', uploadPreset)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: 'POST',
    body,
  })

  const raw = await res.text()
  if (!res.ok) {
    throw new Error(raw || `Upload Cloudinary non riuscito (${res.status}).`)
  }

  let parsed: { secure_url?: string }
  try {
    parsed = JSON.parse(raw) as { secure_url?: string }
  } catch {
    throw new Error('Risposta Cloudinary non valida.')
  }
  if (!parsed.secure_url) {
    throw new Error('Risposta Cloudinary senza secure_url.')
  }
  return { secure_url: parsed.secure_url }
}
