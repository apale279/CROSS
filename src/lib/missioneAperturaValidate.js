import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { eventiPath } from './firestorePaths';
import { normalizeTratteMissione } from './missionTratte';

export function timestampToDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Vincoli per modificare `missione.apertura` (data/ora creazione operativa):
 * - non nel futuro
 * - ≥ apertura evento collegato (se presente)
 * - ≤ ogni timestamp in storicoStati, statoDa e tratteMissione
 */
export function validateMissioneAperturaChange({ nextDate, missione, evento, now = new Date() }) {
  if (!(nextDate instanceof Date) || Number.isNaN(nextDate.getTime())) {
    return { ok: false, message: 'Data/ora non valida.' };
  }
  if (nextDate.getTime() > now.getTime()) {
    return { ok: false, message: 'L\'orario di apertura non può essere nel futuro.' };
  }

  const evDate = timestampToDate(evento?.apertura);
  if (evDate && nextDate < evDate) {
    return {
      ok: false,
      message: 'L\'orario di apertura della missione non può precedere l\'apertura dell\'evento.',
    };
  }

  const storico = missione?.storicoStati ?? {};
  for (const [statoKey, ts] of Object.entries(storico)) {
    const stDate = timestampToDate(ts);
    if (stDate && nextDate > stDate) {
      return {
        ok: false,
        message: `L'orario di apertura non può essere successivo allo stato «${statoKey}» nella cronologia.`,
      };
    }
  }

  const statoDaDate = timestampToDate(missione?.statoDa);
  if (statoDaDate && nextDate > statoDaDate) {
    return {
      ok: false,
      message: 'L\'orario di apertura non può essere successivo allo stato operativo corrente.',
    };
  }

  const tratte = normalizeTratteMissione(missione?.tratteMissione);
  for (const t of tratte) {
    if (t.quando && nextDate > t.quando) {
      return {
        ok: false,
        message: 'L\'orario di apertura non può essere successivo a una tappa/tratta registrata.',
      };
    }
  }

  return { ok: true };
}

/** Evento collegato alla missione (per vincolo apertura ≥ evento). */
export async function fetchEventoForMissione(manifestationId, missione) {
  if (!manifestationId || !missione) return null;

  if (missione.eventoDocId) {
    const snap = await getDoc(doc(db, ...eventiPath(manifestationId), missione.eventoDocId));
    if (snap.exists()) return { _docId: snap.id, ...snap.data() };
  }

  const uid = String(missione.eventoIdUnivoco ?? '').trim();
  if (uid) {
    const snap = await getDocs(
      query(collection(db, ...eventiPath(manifestationId)), where('idUnivoco', '==', uid)),
    );
    if (!snap.empty) return { _docId: snap.docs[0].id, ...snap.docs[0].data() };
  }

  const display = String(missione.eventoCorrelato ?? '').trim();
  if (display) {
    const snap = await getDocs(
      query(collection(db, ...eventiPath(manifestationId)), where('idEvento', '==', display)),
    );
    if (!snap.empty) return { _docId: snap.docs[0].id, ...snap.docs[0].data() };
  }

  return null;
}
