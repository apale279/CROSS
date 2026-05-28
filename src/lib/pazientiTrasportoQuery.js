import { collection, getDocs, limit, query, startAfter, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ESITO_TRASPORTA } from '../constants';
import { eventiPath, pazientiPath } from '../lib/firestorePaths';
import { pazienteSameEventoAsMissione } from './eventoMissioneMatch';
import { normalizeMezzoKey } from './mezzoMissione';

const TRASPORTO_FALLBACK_PAGE = 200;

/** Pazienti in trasporto sul mezzo (query Firestore filtrata, sigla esatta). */
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

/**
 * Pazienti «Trasporta» sulla missione: query per sigla + fallback per evento
 * con match normalizzato del mezzo (dati legacy con sigle diverse).
 */
export async function fetchPazientiTrasportoForMissione(manifestationId, missione) {
  const sigla = missione?.mezzo;
  if (!sigla || !manifestationId) return [];

  const nk = normalizeMezzoKey(sigla);
  if (!nk) return [];

  const direct = await fetchPazientiTrasportoOnMezzo(manifestationId, sigla);
  const fromDirect = direct.filter(
    (p) => pazienteSameEventoAsMissione(p, missione) && normalizeMezzoKey(p.mezzo) === nk,
  );
  if (fromDirect.length > 0) return fromDirect;

  const colRef = collection(db, ...pazientiPath(manifestationId));
  const constraints = [where('esito', '==', ESITO_TRASPORTA)];
  if (missione.eventoIdUnivoco) {
    constraints.push(where('eventoIdUnivoco', '==', missione.eventoIdUnivoco));
  } else if (missione.eventoCorrelato) {
    constraints.push(where('eventoCorrelato', '==', missione.eventoCorrelato));
  } else {
    return [];
  }
  const all = [];
  let lastDoc = null;
  for (;;) {
    const q = lastDoc
      ? query(colRef, ...constraints, startAfter(lastDoc), limit(TRASPORTO_FALLBACK_PAGE))
      : query(colRef, ...constraints, limit(TRASPORTO_FALLBACK_PAGE));
    const snap = await getDocs(q);
    if (snap.empty) break;
    all.push(...snap.docs.map((d) => ({ _docId: d.id, ...d.data() })));
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < TRASPORTO_FALLBACK_PAGE) break;
  }
  return all.filter((p) => normalizeMezzoKey(p.mezzo) === nk);
}

export { pazienteSameEventoAsMissione };

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

export function pazientiTrasportoPerMissione(pazienti, mis) {
  if (!mis?.mezzo) return [];
  const nk = normalizeMezzoKey(mis.mezzo);
  return (pazienti ?? []).filter(
    (p) =>
      p.esito === ESITO_TRASPORTA &&
      pazienteSameEventoAsMissione(p, mis) &&
      p.mezzo &&
      normalizeMezzoKey(p.mezzo) === nk,
  );
}
