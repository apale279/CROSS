import { collection, deleteDoc, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { eventiPath, missioniPath, mezziPath, pazientiPath } from '../lib/firestorePaths';
import { deletePazienteCascade } from './pazientiService';

async function flushBatchDeletes(refs) {
  if (!refs.length) return;
  let batch = writeBatch(db);
  let ops = 0;
  const commit = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = writeBatch(db);
    ops = 0;
  };
  for (const ref of refs) {
    batch.delete(ref);
    ops += 1;
    if (ops >= 450) await commit();
  }
  await commit();
}

/**
 * Azzera dati operativi della manifestazione: pazienti (con valutazioni/PMA),
 * missioni, eventi, mezzi. Non tocca impostazioni, utenti Telegram, note diario.
 */
export async function wipeAllOpsData(manifestationId) {
  const pazSnap = await getDocs(collection(db, ...pazientiPath(manifestationId)));
  for (const d of pazSnap.docs) {
    await deletePazienteCascade(manifestationId, d.id);
  }

  const missioniSnap = await getDocs(collection(db, ...missioniPath(manifestationId)));
  await flushBatchDeletes(missioniSnap.docs.map((d) => d.ref));

  const eventiSnap = await getDocs(collection(db, ...eventiPath(manifestationId)));
  await flushBatchDeletes(eventiSnap.docs.map((d) => d.ref));

  const mezziSnap = await getDocs(collection(db, ...mezziPath(manifestationId)));
  await flushBatchDeletes(mezziSnap.docs.map((d) => d.ref));
}

/** @deprecated Usare wipeAllOpsData */
export const wipeAllEventiMissioniMezzi = wipeAllOpsData;
