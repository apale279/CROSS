import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { noteDiarioPath } from '../lib/firestorePaths';
import { diarioPmaAlertSeq } from '../lib/pmaDiarioAlert';

/** Centrale: invia (o reinvia) alert PMA su nota importante. */
export async function inviaPmaAlertDiario(manifestationId, docId) {
  if (!manifestationId || !docId) return;
  const ref = doc(db, ...noteDiarioPath(manifestationId), docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Nota non trovata');
  const data = snap.data();
  if (!data.importante) throw new Error('Segna prima la nota come importante');

  const nextSeq = diarioPmaAlertSeq(data) + 1;
  await updateDoc(ref, {
    pmaAlertSeq: nextSeq,
    pmaAlertInviatoIl: serverTimestamp(),
    aggiornatoIl: serverTimestamp(),
  });
  return { seq: nextSeq };
}

/** PMA: chiusura condivisa — il primo operatore chiude per tutti. */
export async function chiudiPmaAlertDiario(manifestationId, docId, operator = {}) {
  if (!manifestationId || !docId) return;
  const ref = doc(db, ...noteDiarioPath(manifestationId), docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const seq = diarioPmaAlertSeq(snap.data());
  if (seq <= 0) return;

  await updateDoc(ref, {
    pmaAlertChiusoSeq: seq,
    pmaAlertChiusoIl: serverTimestamp(),
    pmaAlertChiusoDa: {
      uid: String(operator.uid ?? '').trim(),
      nome: String(operator.nome ?? operator.nomeUtente ?? '').trim(),
    },
    aggiornatoIl: serverTimestamp(),
  });
}
