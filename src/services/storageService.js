import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebaseConfig';

function piantinaStoragePath(tenantId, eventoDocId) {
  return `piantine_eventi/${tenantId}/${eventoDocId}.png`;
}

/** Carica esclusivamente PNG; restituisce URL pubblico download. */
export async function uploadPiantinaEvento(tenantId, eventoDocId, file) {
  if (!tenantId || !eventoDocId) throw new Error('Tenant o evento mancante');
  if (!file || file.type !== 'image/png') {
    throw new Error('Sono ammessi solo file .png');
  }

  const storageRef = ref(storage, piantinaStoragePath(tenantId, eventoDocId));
  await uploadBytes(storageRef, file, { contentType: 'image/png' });
  return getDownloadURL(storageRef);
}

export async function deletePiantinaEvento(tenantId, eventoDocId) {
  if (!tenantId || !eventoDocId) return;
  const storageRef = ref(storage, piantinaStoragePath(tenantId, eventoDocId));
  try {
    await deleteObject(storageRef);
  } catch (err) {
    if (err?.code !== 'storage/object-not-found') throw err;
  }
}
