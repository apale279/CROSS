import { auth } from '../firebaseConfig';
import { GUIDA_PDF_MAX_BYTES, isCloudinaryGuidaConfigured } from '../lib/guidaPdfConfig';

function validateGuidaPdfFile(file) {
  if (!file) throw new Error('Nessun file selezionato');
  if (file.size > GUIDA_PDF_MAX_BYTES) {
    throw new Error('File troppo grande (max 15 MB)');
  }
  const type = file.type || '';
  const name = (file.name ?? '').toLowerCase();
  if (type !== 'application/pdf' && !name.endsWith('.pdf')) {
    throw new Error('Formato non supportato. Usa un file PDF.');
  }
}

async function uploadGuidaCloudinary(tenantId, file) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
  const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();
  if (!cloudName || !preset) {
    throw new Error('Cloudinary non configurato');
  }

  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', preset);
  body.append('folder', `cross/guida/${tenantId}`);
  body.append('tags', 'cross,guida,pdf');
  body.append('resource_type', 'raw');

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
    method: 'POST',
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Cloudinary: upload fallito (${res.status})`);
  }
  if (!data.secure_url) throw new Error('Cloudinary: URL mancante nella risposta');
  return data.secure_url;
}

async function uploadGuidaViaApi(file) {
  const user = auth.currentUser;
  if (!user) throw new Error('Devi essere autenticato');
  const token = await user.getIdToken();

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const fileBase64 = btoa(binary);

  const res = await fetch('/api/guida-pdf-upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileBase64, mimeType: file.type || 'application/pdf' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Upload fallito (${res.status})`);
  if (!data.url) throw new Error('Risposta upload senza URL');
  return data.url;
}

/** Carica la guida PDF su Cloudinary (client unsigned o API server). */
export async function uploadGuidaPdf(tenantId, file) {
  validateGuidaPdfFile(file);

  if (isCloudinaryGuidaConfigured()) {
    try {
      return await uploadGuidaCloudinary(tenantId, file);
    } catch (err) {
      console.warn('[guida-pdf] Cloudinary client:', err);
    }
  }

  try {
    return await uploadGuidaViaApi(file);
  } catch (err) {
    if (isCloudinaryGuidaConfigured()) throw err;
    throw new Error(
      'Upload non disponibile. Configura VITE_CLOUDINARY_* nel client oppure CLOUDINARY_* su Vercel, oppure incolla un URL PDF.',
    );
  }
}

export function isValidGuidaPdfUrl(url) {
  const u = (url ?? '').trim();
  if (!u) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
