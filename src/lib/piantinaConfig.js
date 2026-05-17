/** Tipi immagine accettati per il tabellone tattico. */
export const PIANTINA_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg';

export const PIANTINA_MAX_BYTES = 8 * 1024 * 1024;

export function isCloudinaryPiantinaConfigured() {
  const cloud = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? '').trim();
  const preset = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? '').trim();
  return Boolean(cloud && preset);
}

export function isFirebaseStorageConfigured() {
  return Boolean((import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '').trim());
}

export function piantinaUploadMode() {
  if (isCloudinaryPiantinaConfigured()) return 'cloudinary';
  if (isFirebaseStorageConfigured()) return 'firebase';
  return 'url';
}
