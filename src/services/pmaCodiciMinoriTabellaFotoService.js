import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebaseConfig';
import { compressImageFile } from '../lib/compressImageFile';
import { readImpostazioniFieldForDisplay } from '../lib/impostazioniFieldAccess';
import { saveImpostazioniMapEntry } from '../services/impostazioniService';

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']);

function tabellaFotoPath(tenantId, pmaId, fotoId) {
  return `manifestazioni/${tenantId}/codici_minori_tabella/${pmaId}/${fotoId}.jpg`;
}

function newFotoId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `f${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function codiciMinoriTabellaFotoList(impostazioni, pmaId) {
  const map = readImpostazioniFieldForDisplay(impostazioni, 'codiciMinoriTabellaFoto') ?? {};
  const raw = map?.[pmaId];
  if (!Array.isArray(raw)) return [];
  return raw.filter((f) => f && typeof f.url === 'string' && f.url.trim());
}

async function writeFotoList(manifestationId, pmaId, foto) {
  await saveImpostazioniMapEntry(manifestationId, 'codiciMinoriTabellaFoto', pmaId, foto);
}

export async function uploadCodiciMinoriTabellaFoto(manifestationId, pmaId, file) {
  if (!manifestationId || !pmaId) throw new Error('Dati mancanti');
  if (!file) throw new Error('File mancante');

  const contentType = file.type || 'image/jpeg';
  if (
    !ALLOWED.has(contentType) &&
    !file.name?.match(/\.(png|jpe?g|webp|heic|heif)$/i)
  ) {
    throw new Error('Formato non supportato (usa JPG, PNG o WebP)');
  }

  const prepared = await compressImageFile(file);
  const fotoId = newFotoId();
  const storagePath = tabellaFotoPath(manifestationId, pmaId, fotoId);
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, prepared, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(storageRef);

  return {
    id: fotoId,
    url,
    storagePath,
    uploadedAt: new Date().toISOString(),
  };
}

export async function appendCodiciMinoriTabellaFoto(
  manifestationId,
  pmaId,
  impostazioni,
  file,
) {
  const meta = await uploadCodiciMinoriTabellaFoto(manifestationId, pmaId, file);
  const foto = [...codiciMinoriTabellaFotoList(impostazioni, pmaId), meta];
  await writeFotoList(manifestationId, pmaId, foto);
  return meta;
}

export async function deleteCodiciMinoriTabellaFoto(
  manifestationId,
  pmaId,
  impostazioni,
  fotoMeta,
) {
  if (!fotoMeta?.id) return;
  const storagePath =
    fotoMeta.storagePath ?? tabellaFotoPath(manifestationId, pmaId, fotoMeta.id);
  const storageRef = ref(storage, storagePath);
  try {
    await deleteObject(storageRef);
  } catch (err) {
    if (err?.code !== 'storage/object-not-found') throw err;
  }

  const foto = codiciMinoriTabellaFotoList(impostazioni, pmaId).filter((f) => f.id !== fotoMeta.id);
  await writeFotoList(manifestationId, pmaId, foto);
}
