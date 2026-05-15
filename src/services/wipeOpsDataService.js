import { collection, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { eventiPath, missioniPath, mezziPath } from '../lib/firestorePaths';
import { deleteEvento } from './eventiService';
import { deleteMezzo } from './mezziService';

/**
 * Elimina tutti gli eventi (con missioni e pazienti collegati come in deleteEvento),
 * poi eventuali missioni orfane, infine tutti i mezzi.
 */
export async function wipeAllEventiMissioniMezzi(manifestationId) {
  const eventiSnap = await getDocs(collection(db, ...eventiPath(manifestationId)));
  for (const d of eventiSnap.docs) {
    await deleteEvento(manifestationId, d.id);
  }
  const missioniSnap = await getDocs(collection(db, ...missioniPath(manifestationId)));
  await Promise.all(missioniSnap.docs.map((d) => deleteDoc(d.ref)));
  const mezziSnap = await getDocs(collection(db, ...mezziPath(manifestationId)));
  for (const d of mezziSnap.docs) {
    await deleteMezzo(manifestationId, d.id);
  }
}
