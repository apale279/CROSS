import { auth } from '../firebaseConfig';
import { PIANTINA_MAX_BYTES } from '../lib/piantinaConfig';
import { isCloudinaryPiantinaConfigured } from '../lib/piantinaConfig';
import { uploadPiantinaInfoLuogo, deletePiantinaInfoLuogo } from './storageService';

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

function validatePiantinaFile(file) {
  if (!file) throw new Error('Nessun file selezionato');
  if (file.size > PIANTINA_MAX_BYTES) {
    throw new Error('File troppo grande (max 8 MB)');
  }
  const type = file.type || '';
  const name = (file.name ?? '').toLowerCase();
  const okType =
    ALLOWED_TYPES.has(type) ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp') ||
    name.endsWith('.svg');
  if (!okType) {
    throw new Error('Formato non supportato. Usa PNG, JPG, WebP o SVG.');
  }
}

/** Upload non firmato Cloudinary (preset dedicato, solo upload). */
async function uploadPiantinaCloudinary(tenantId, file) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
  const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();
  if (!cloudName || !preset) {
    throw new Error('Cloudinary non configurato');
  }

  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', preset);
  body.append('folder', `cross/piantine/${tenantId}`);
  body.append('tags', 'cross,piantina,info_luogo');

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
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

/** Upload tramite API Vercel (Cloudinary con secret lato server). */
async function uploadPiantinaViaApi(file) {
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

  const res = await fetch('/api/piantina-upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileBase64, mimeType: file.type || 'image/png' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Upload fallito (${res.status})`);
  if (!data.url) throw new Error('Risposta upload senza URL');
  return data.url;
}

async function uploadPiantinaFirebase(tenantId, file) {
  return uploadPiantinaInfoLuogo(tenantId, file);
}

/**
 * Carica piantina: Cloudinary (client o API) → Firebase Storage → errore con suggerimento URL.
 */
export async function uploadPiantina(tenantId, file) {
  validatePiantinaFile(file);

  if (isCloudinaryPiantinaConfigured()) {
    try {
      return await uploadPiantinaCloudinary(tenantId, file);
    } catch (err) {
      console.warn('[piantina] Cloudinary client:', err);
    }
  }

  if (!isCloudinaryPiantinaConfigured()) {
    try {
      return await uploadPiantinaViaApi(file);
    } catch (err) {
      console.warn('[piantina] API upload:', err);
    }
  }

  try {
    return await uploadPiantinaFirebase(tenantId, file);
  } catch (err) {
    const code = err?.code ?? '';
    if (code === 'storage/unauthorized' || code === 'storage/unknown') {
      throw new Error(
        'Storage Firebase non disponibile. Configura Cloudinary (consigliato) o incolla un URL immagine sotto.',
      );
    }
    throw err;
  }
}

export async function removePiantinaFromStorage(tenantId, currentUrl) {
  if (!tenantId || !currentUrl) return;
  const isFirebase =
    currentUrl.includes('firebasestorage.googleapis.com') ||
    currentUrl.includes('storage.googleapis.com');
  if (isFirebase) {
    try {
      await deletePiantinaInfoLuogo(tenantId);
    } catch (err) {
      console.warn('[piantina] delete firebase:', err);
    }
  }
}

export function isValidPiantinaUrl(url) {
  const u = (url ?? '').trim();
  if (!u) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
