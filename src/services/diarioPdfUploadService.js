const DIARIO_PDF_MAX_BYTES = 15 * 1024 * 1024;

export function isCloudinaryDiarioPdfConfigured() {
  return Boolean(
    import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() &&
      import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim(),
  );
}

function validateDiarioPdfFile(file) {
  if (!file) throw new Error('Nessun file selezionato');
  if (file.size > DIARIO_PDF_MAX_BYTES) {
    throw new Error('File troppo grande (max 15 MB)');
  }
  const type = file.type || '';
  const name = (file.name ?? '').toLowerCase();
  if (type !== 'application/pdf' && !name.endsWith('.pdf')) {
    throw new Error('Formato non supportato. Usa un file PDF.');
  }
}

/** Upload PDF allegato nota diario (Cloudinary raw). */
export async function uploadDiarioPdf(manifestationId, file) {
  validateDiarioPdfFile(file);
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
  const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();
  if (!cloudName || !preset) {
    throw new Error(
      'Cloudinary non configurato. Imposta VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET.',
    );
  }

  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', preset);
  body.append('folder', `cross/diario/${manifestationId ?? 'default'}`);
  body.append('tags', 'cross,diario,pdf');

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
    method: 'POST',
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Cloudinary: upload fallito (${res.status})`);
  }
  if (!data.secure_url) throw new Error('Cloudinary: URL mancante nella risposta');
  return {
    pdfUrl: data.secure_url,
    pdfFilename: file.name ?? 'allegato.pdf',
  };
}
