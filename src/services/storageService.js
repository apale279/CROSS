import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebaseConfig';

function infoLuogoPiantinaPath(tenantId) {
  return `piantine_eventi/${tenantId}/info_luogo.png`;
}

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

/** Piantina tabellone tattico (impostazioni manifestazione) — richiede Firebase Storage attivo. */
export async function uploadPiantinaInfoLuogo(tenantId, file) {
  if (!tenantId) throw new Error('Manifestazione mancante');
  if (!file) throw new Error('File mancante');
  const contentType = file.type || 'image/png';
  if (!ALLOWED.has(contentType) && !file.name?.match(/\.(png|jpe?g|webp|svg)$/i)) {
    throw new Error('Formato non supportato');
  }

  const storageRef = ref(storage, infoLuogoPiantinaPath(tenantId));
  await uploadBytes(storageRef, file, { contentType });
  return getDownloadURL(storageRef);
}

export async function deletePiantinaInfoLuogo(tenantId) {
  if (!tenantId) return;
  const storageRef = ref(storage, infoLuogoPiantinaPath(tenantId));
  try {
    await deleteObject(storageRef);
  } catch (err) {
    if (err?.code !== 'storage/object-not-found') throw err;
  }
}
