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

async function queryTrasportoPerCampo(colRef, field, value, missione) {
  if (!value) return [];
  try {
    const q = query(
      colRef,
      where(field, '==', value),
      where('esito', '==', ESITO_TRASPORTA),
      limit(64),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ _docId: d.id, ...d.data() }))
      .filter((p) => pazienteSuMissione(p, missione));
  } catch {
    return [];
  }
}

async function scanTrasportoEvento(colRef, missione) {
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
  return all.filter((p) => pazienteSuMissione(p, missione));
}

/**
 * Pazienti «Trasporta» sulla missione: preferisce `missioneIdUnivoco`, poi `idMissione`,
 * infine scan evento filtrato con {@link pazienteSuMissione}.
 */
export async function fetchPazientiTrasportoForMissione(manifestationId, missione) {
  if (!missione || !manifestationId) return [];
  const colRef = collection(db, ...pazientiPath(manifestationId));

  const byUid = await queryTrasportoPerCampo(
    colRef,
    'missioneIdUnivoco',
    String(missione.idUnivoco ?? '').trim(),
    missione,
  );
  if (byUid.length > 0) return byUid;

  const byIdMissione = await queryTrasportoPerCampo(
    colRef,
    'idMissione',
    String(missione.idMissione ?? '').trim(),
    missione,
  );
  if (byIdMissione.length > 0) return byIdMissione;

  return scanTrasportoEvento(colRef, missione);
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

/** Legame canonico paziente ↔ missione (non solo sigla mezzo). */
export function pazienteSuMissione(paziente, missione) {
  if (!paziente || !missione || !pazienteSameEventoAsMissione(paziente, missione)) return false;
  const uidM = String(missione.idUnivoco ?? '').trim();
  const uidP = String(paziente.missioneIdUnivoco ?? '').trim();
  if (uidM && uidP && uidP === uidM) return true;
  const idM = String(missione.idMissione ?? '').trim();
  const idP = String(paziente.idMissione ?? '').trim();
  if (idM && idP && idP === idM) {
    if (!paziente.mezzo || !missione.mezzo) return true;
    return normalizeMezzoKey(paziente.mezzo) === normalizeMezzoKey(missione.mezzo);
  }
  return false;
}

export function pazientiTrasportoPerMissione(pazienti, mis) {
  if (!mis) return [];
  return (pazienti ?? []).filter(
    (p) => p.esito === ESITO_TRASPORTA && pazienteSuMissione(p, mis),
  );
}
