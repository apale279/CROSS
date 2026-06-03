import { collection, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  buildCounterResetPatch,
  selectedCounterKeys,
  selectedEntityKeys,
} from '../lib/opsDangerZone';
import { eventiPath, missioniPath, mezziPath, pazientiPath, noteDiarioPath } from '../lib/firestorePaths';
import { deletePazienteCascade } from './pazientiService';

function contatoriRef(manifestationId) {
  return doc(db, 'manifestazioni', manifestationId, 'settings', 'contatori');
}

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
 * Elimina le entità operative selezionate.
 * @param {string} manifestationId
 * @param {{ eventi?: boolean, missioni?: boolean, mezzi?: boolean, pazienti?: boolean, note?: boolean }} selection
 */
export async function wipeSelectedOpsData(manifestationId, selection) {
  const keys = selectedEntityKeys(selection);
  if (keys.length === 0) {
    throw new Error('Seleziona almeno un\'entità da eliminare.');
  }

  if (selection.pazienti) {
    const pazSnap = await getDocs(collection(db, ...pazientiPath(manifestationId)));
    for (const d of pazSnap.docs) {
      await deletePazienteCascade(manifestationId, d.id);
    }
  }

  if (selection.missioni) {
    const missioniSnap = await getDocs(collection(db, ...missioniPath(manifestationId)));
    await flushBatchDeletes(missioniSnap.docs.map((d) => d.ref));
  }

  if (selection.eventi) {
    const eventiSnap = await getDocs(collection(db, ...eventiPath(manifestationId)));
    await flushBatchDeletes(eventiSnap.docs.map((d) => d.ref));
  }

  if (selection.mezzi) {
    const mezziSnap = await getDocs(collection(db, ...mezziPath(manifestationId)));
    await flushBatchDeletes(mezziSnap.docs.map((d) => d.ref));
  }

  if (selection.note) {
    const noteSnap = await getDocs(collection(db, ...noteDiarioPath(manifestationId)));
    await flushBatchDeletes(noteSnap.docs.map((d) => d.ref));
  }

  return keys;
}

/**
 * Azzera i contatori ID progressivi selezionati (prossimo ID riparte da 1).
 * @param {string} manifestationId
 * @param {{ eventi?: boolean, missioni?: boolean, pazienti?: boolean }} selection
 */
export async function resetSelectedOpsCounters(manifestationId, selection) {
  const patch = buildCounterResetPatch(selection);
  const keys = selectedCounterKeys(selection);
  if (keys.length === 0) {
    throw new Error('Seleziona almeno un contatore da azzerare.');
  }
  await setDoc(contatoriRef(manifestationId), patch, { merge: true });
  return keys;
}

/** Azzera tutti i dati operativi classici (senza note diario, come comportamento storico). */
export async function wipeAllOpsData(manifestationId) {
  return wipeSelectedOpsData(manifestationId, {
    eventi: true,
    missioni: true,
    mezzi: true,
    pazienti: true,
    note: false,
  });
}

/** @deprecated Usare wipeAllOpsData */
export const wipeAllEventiMissioniMezzi = wipeAllOpsData;
