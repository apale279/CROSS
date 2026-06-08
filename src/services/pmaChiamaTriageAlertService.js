import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { normalizeStatoPzPma, pmaIdPerPaziente, STATO_PZ_PMA } from '../lib/pmaModule';
import { pmaChiamaTriageSeq } from '../lib/pmaChiamaTriageAlert';
import { pazientiPath } from '../lib/firestorePaths';

/** Desk PMA: richiede ingresso di un paziente in attesa (alert agli operatori triage). */
export async function inviaPmaChiamaTriage(manifestationId, docId, pmaId, operator = {}) {
  if (!manifestationId || !docId || !pmaId) {
    throw new Error('Parametri mancanti');
  }

  const ref = doc(db, ...pazientiPath(manifestationId), docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Paziente non trovato');

  const data = snap.data();
  if (normalizeStatoPzPma(data.statoPzPma) !== STATO_PZ_PMA.IN_ATTESA) {
    throw new Error('Il paziente non è in attesa');
  }
  if (pmaIdPerPaziente(data) !== String(pmaId).trim()) {
    throw new Error('Paziente non assegnato a questo PMA');
  }

  const nextSeq = pmaChiamaTriageSeq(data) + 1;
  await updateDoc(ref, {
    pmaChiamaTriageSeq: nextSeq,
    pmaChiamaTriageInviatoIl: serverTimestamp(),
    pmaChiamaTriageInviatoDa: {
      uid: String(operator.uid ?? '').trim(),
      nome: String(operator.nome ?? operator.nomeUtente ?? '').trim(),
    },
  });
  return { seq: nextSeq };
}

/** Triage PMA: chiusura condivisa — il primo operatore chiude per tutti. */
export async function chiudiPmaChiamaTriage(manifestationId, docId, operator = {}) {
  if (!manifestationId || !docId) return;

  const ref = doc(db, ...pazientiPath(manifestationId), docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const seq = pmaChiamaTriageSeq(snap.data());
  if (seq <= 0) return;

  await updateDoc(ref, {
    pmaChiamaTriageChiusoSeq: seq,
    pmaChiamaTriageChiusoIl: serverTimestamp(),
    pmaChiamaTriageChiusoDa: {
      uid: String(operator.uid ?? '').trim(),
      nome: String(operator.nome ?? operator.nomeUtente ?? '').trim(),
    },
  });
}
