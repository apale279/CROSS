import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ESITO_TRASPORTA } from '../constants';
import { eventiPath, pazientiPath } from '../lib/firestorePaths';

/** Pazienti in trasporto sul mezzo (query Firestore filtrata). */
export async function fetchPazientiTrasportoOnMezzo(manifestationId, mezzo) {
  if (!mezzo) return [];
  const colRef = collection(db, ...pazientiPath(manifestationId));
  const q = query(
    colRef,
    where('mezzo', '==', mezzo),
    where('esito', '==', ESITO_TRASPORTA),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ _docId: d.id, ...d.data() }));
}

/** Evento collegato alla missione (una lettura mirata). */
export async function fetchEventoForMissione(manifestationId, missione) {
  const colRef = collection(db, ...eventiPath(manifestationId));
  if (missione?.eventoIdUnivoco) {
    const snap = await getDocs(
      query(colRef, where('idUnivoco', '==', missione.eventoIdUnivoco), limit(1)),
    );
    if (!snap.empty) return { _docId: snap.docs[0].id, ...snap.docs[0].data() };
  }
  if (missione?.eventoCorrelato) {
    const snap = await getDocs(
      query(colRef, where('idEvento', '==', missione.eventoCorrelato), limit(1)),
    );
    if (!snap.empty) return { _docId: snap.docs[0].id, ...snap.docs[0].data() };
  }
  return null;
}

export function pazienteSameEventoAsMissione(paziente, missione) {
  return (
    (missione.eventoIdUnivoco && paziente.eventoIdUnivoco === missione.eventoIdUnivoco) ||
    paziente.eventoCorrelato === missione.eventoCorrelato
  );
}

export function pazientiTrasportoPerMissione(pazienti, mis) {
  if (!mis) return [];
  return (pazienti ?? []).filter(
    (p) => pazienteSameEventoAsMissione(p, mis) && p.mezzo === mis.mezzo && p.esito === ESITO_TRASPORTA,
  );
}
