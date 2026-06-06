import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { pazientiPath } from '../lib/firestorePaths';
import { normalizeStatoPzPma, STATO_PZ_PMA } from '../lib/pmaModule';
import { patchPaziente } from './pazientiService';
import { initPmaSchedaIfMissing, patchPazientePmaGranular } from '../pma/lib/pazientePmaPatch';

/** Da «in attesa» a «in carico» (presa in carico al PMA). */
export async function prendiInCaricoPma(manifestationId, docId) {
  const docRef = doc(db, ...pazientiPath(manifestationId), docId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) throw new Error('Paziente non trovato.');
    const cur = normalizeStatoPzPma(snap.data().statoPzPma);
    if (cur === STATO_PZ_PMA.DIMESSO) {
      throw new Error('Paziente già dimesso: non è possibile prenderlo in carico.');
    }
    if (cur === STATO_PZ_PMA.IN_CARICO) return;
    if (cur !== STATO_PZ_PMA.IN_ARRIVO && cur !== STATO_PZ_PMA.IN_ATTESA && cur != null) {
      throw new Error(`Stato PMA non valido per presa in carico: ${snap.data().statoPzPma ?? '—'}`);
    }
    transaction.update(docRef, {
      statoPzPma: STATO_PZ_PMA.IN_CARICO,
      'pmaScheda.ingresso_carico_at': Timestamp.now(),
    });
  });
  await initPmaSchedaIfMissing(manifestationId, docId, null);
}

/** Da «in arrivo» (centrale) a «in attesa» al PMA senza presa in carico. */
export async function mettiInAttesaPma(manifestationId, docId) {
  const docRef = doc(db, ...pazientiPath(manifestationId), docId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) throw new Error('Paziente non trovato.');
    const cur = normalizeStatoPzPma(snap.data().statoPzPma);
    if (cur === STATO_PZ_PMA.DIMESSO) {
      throw new Error('Paziente già dimesso: non è possibile metterlo in attesa.');
    }
    if (cur === STATO_PZ_PMA.IN_ATTESA) return;
    if (cur === STATO_PZ_PMA.IN_CARICO) {
      throw new Error('Paziente già in carico: usa la scheda PMA per gestirlo.');
    }
    if (cur !== STATO_PZ_PMA.IN_ARRIVO && cur != null) {
      throw new Error(`Stato PMA non valido per attesa: ${snap.data().statoPzPma ?? '—'}`);
    }
    transaction.update(docRef, { statoPzPma: STATO_PZ_PMA.IN_ATTESA });
  });
}

/** Autopresentato: in attesa (fuori tenda) o in carico (in tenda). */
export async function setStatoPmaAutopresentato(manifestationId, docId, stato) {
  const next = String(stato ?? '').trim();
  if (next === STATO_PZ_PMA.IN_CARICO) {
    await prendiInCaricoPma(manifestationId, docId);
    return;
  }
  if (next === STATO_PZ_PMA.IN_ATTESA) {
    await patchPaziente(manifestationId, docId, { statoPzPma: STATO_PZ_PMA.IN_ATTESA });
  }
}
