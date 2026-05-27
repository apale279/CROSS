const MAX_DIM = 1920;
const JPEG_QUALITY = 0.85;

/**
 * Riduce foto da fotocamera prima dell'upload (max lato MAX_DIM, JPEG se possibile).
 * @returns {Promise<File>}
 */
export async function compressImageFile(file) {
  if (!file?.type?.startsWith('image/') || file.type === 'image/svg+xml') {
    return file;
  }
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIM / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Compressione immagine fallita'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });

  const base = (file.name || 'foto').replace(/\.[^.]+$/, '') || 'foto';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
}
