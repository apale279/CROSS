import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebaseConfig';

function infoLuogoPiantinaPath(tenantId) {
  return `piantine_eventi/${tenantId}/info_luogo.png`;
}

/** Piantina tabellone tattico (impostazioni manifestazione). */
export async function uploadPiantinaInfoLuogo(tenantId, file) {
  if (!tenantId) throw new Error('Manifestazione mancante');
  if (!file || file.type !== 'image/png') {
    throw new Error('Sono ammessi solo file .png');
  }

  const storageRef = ref(storage, infoLuogoPiantinaPath(tenantId));
  await uploadBytes(storageRef, file, { contentType: 'image/png' });
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
