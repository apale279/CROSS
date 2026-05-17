export const GUIDA_PDF_ACCEPT = 'application/pdf,.pdf';

export const GUIDA_PDF_MAX_BYTES = 15 * 1024 * 1024;

export function isCloudinaryGuidaConfigured() {
  const cloud = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? '').trim();
  const preset = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? '').trim();
  return Boolean(cloud && preset);
}
