import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { doc, getDoc } from 'firebase/firestore';
import { db, storage } from '../firebaseConfig';
import { compressImageFile } from '../lib/compressImageFile';
import { pazientiPath } from '../lib/firestorePaths';
import { patchPaziente } from './pazientiService';

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']);

function codiceMinoreFotoPath(tenantId, pazienteDocId, fotoId) {
  return `manifestazioni/${tenantId}/codici_minori/${pazienteDocId}/${fotoId}.jpg`;
}

function newFotoId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `f${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function codiceMinoreFotoList(paziente) {
  const raw = paziente?.codiceMinore?.foto;
  if (!Array.isArray(raw)) return [];
  return raw.filter((f) => f && typeof f.url === 'string' && f.url.trim());
}

async function readCodiceMinore(manifestationId, pazienteDocId) {
  const snap = await getDoc(doc(db, ...pazientiPath(manifestationId), pazienteDocId));
  if (!snap.exists()) throw new Error('Codice minore non trovato');
  return snap.data()?.codiceMinore ?? {};
}

async function writeFotoList(manifestationId, pazienteDocId, codiceMinore, foto) {
  await patchPaziente(manifestationId, pazienteDocId, {
    codiceMinore: {
      ...codiceMinore,
      foto,
    },
  });
}

/** Carica una foto e aggiorna `codiceMinore.foto` sul paziente. */
export async function uploadCodiceMinoreFoto(manifestationId, pazienteDocId, file) {
  if (!manifestationId || !pazienteDocId) throw new Error('Dati mancanti');
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
  const storagePath = codiceMinoreFotoPath(manifestationId, pazienteDocId, fotoId);
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, prepared, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(storageRef);

  const codiceMinore = await readCodiceMinore(manifestationId, pazienteDocId);
  const foto = [
    ...(Array.isArray(codiceMinore.foto) ? codiceMinore.foto : []),
    {
      id: fotoId,
      url,
      storagePath,
      uploadedAt: new Date().toISOString(),
    },
  ];
  await writeFotoList(manifestationId, pazienteDocId, codiceMinore, foto);
  return foto[foto.length - 1];
}

/** Rimuove una foto da Storage e da Firestore. */
export async function deleteCodiceMinoreFoto(manifestationId, pazienteDocId, fotoMeta) {
  if (!fotoMeta?.id) return;
  const storagePath =
    fotoMeta.storagePath ??
    codiceMinoreFotoPath(manifestationId, pazienteDocId, fotoMeta.id);
  const storageRef = ref(storage, storagePath);
  try {
    await deleteObject(storageRef);
  } catch (err) {
    if (err?.code !== 'storage/object-not-found') throw err;
  }

  const codiceMinore = await readCodiceMinore(manifestationId, pazienteDocId);
  const foto = (Array.isArray(codiceMinore.foto) ? codiceMinore.foto : []).filter(
    (f) => f.id !== fotoMeta.id,
  );
  await writeFotoList(manifestationId, pazienteDocId, codiceMinore, foto);
}

/** Elimina tutte le foto di un codice minore (es. cancellazione paziente). */
export async function deleteAllCodiceMinoreFoto(manifestationId, pazienteDocId, paziente) {
  const list = codiceMinoreFotoList(paziente);
  await Promise.all(
    list.map((f) =>
      deleteCodiceMinoreFoto(manifestationId, pazienteDocId, f).catch(() => {}),
    ),
  );
}
