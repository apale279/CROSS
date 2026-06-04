import { Timestamp } from 'firebase/firestore';
import { ESITO_TRASPORTA } from '../constants';
import { eventoRefForMissioneMatch, pazienteSameEventoAsMissione } from './eventoMissioneMatch';
import { formatMissioneMezzoLabel } from './missioneDisplay';
import { normalizeMezzoKey } from './mezzoMissione';
import { emptySoreuFirestoreClear } from './soreuTrasporto';
import { TIPO_PZ } from './pmaModule';

/**
 * Modello trasporto (centrale / evento):
 * - Una **missione aperta** è legata a **un mezzo**.
 * - **Più pazienti** sulla **stessa missione** condividono mezzo, id missione e destinazione.
 * - Missioni diverse sullo stesso evento (anche stessa sigla mezzo) restano isolate.
 */
function missionAperturaMs(missione) {
  const raw = missione?.apertura;
  if (raw?.toMillis) return raw.toMillis();
  if (raw?.seconds != null) return raw.seconds * 1000;
  return 0;
}

export function missionePerMezzo(missioni, mezzo, evento = null, { missioneIdUnivoco } = {}) {
  if (!mezzo) return null;
  const nk = normalizeMezzoKey(mezzo);
  if (!nk) return null;
  const uid = String(missioneIdUnivoco ?? '').trim();
  if (uid) {
    const exact = (missioni ?? []).find(
      (m) =>
        m.aperta !== false &&
        m.mezzo &&
        String(m.idUnivoco ?? '').trim() === uid &&
        normalizeMezzoKey(m.mezzo) === nk,
    );
    if (exact) return exact;
  }
  const open = (missioni ?? []).filter(
    (m) => m.mezzo && m.aperta !== false && normalizeMezzoKey(m.mezzo) === nk,
  );
  if (open.length === 0) return null;
  const evRef = eventoRefForMissioneMatch(evento);
  const scoped = evRef
    ? open.filter((m) => pazienteSameEventoAsMissione(evRef, m))
    : open;
  if (scoped.length === 0) return null;
  scoped.sort((a, b) => missionAperturaMs(b) - missionAperturaMs(a));
  return scoped[0] ?? null;
}

/** Server + bozza locale: la tendina missione aggiorna il draft prima dello snapshot Firestore. */
export function mergePazienteDraftForResolve(serverPatient, draft) {
  if (!serverPatient) return draft ?? {};
  return { ...serverPatient, ...draft };
}

export function resolveMissionePaziente(missioni, pazienteOrDraft, evento = null) {
  const uid = String(pazienteOrDraft?.missioneIdUnivoco ?? '').trim();
  if (uid) {
    const exact = (missioni ?? []).find((m) => String(m.idUnivoco ?? '').trim() === uid);
    if (exact) return exact;
  }
  const idMis = String(pazienteOrDraft?.idMissione ?? '').trim();
  if (idMis) {
    const byId = (missioni ?? []).find(
      (m) =>
        String(m.idMissione ?? '').trim() === idMis &&
        pazienteSameEventoAsMissione(pazienteOrDraft, m),
    );
    if (byId) return byId;
  }
  const mezzo = String(pazienteOrDraft?.mezzo ?? '').trim();
  if (mezzo) {
    return missionePerMezzo(missioni, mezzo, evento, { missioneIdUnivoco: uid });
  }
  return null;
}

/** Opzioni missione per paziente «Trasporta»: una riga per missione aperta. */
export function mezziMissioniEventoOptions(missioni, evento = null) {
  const evRef = eventoRefForMissioneMatch(evento);
  const open = (missioni ?? []).filter((m) => m.aperta !== false && m.mezzo);
  const filtered = evRef
    ? open.filter((m) => pazienteSameEventoAsMissione(evRef, m))
    : open;
  return filtered
    .slice()
    .sort((a, b) => {
      const mezzoCmp = String(a.mezzo).localeCompare(String(b.mezzo), 'it', {
        sensitivity: 'base',
      });
      if (mezzoCmp !== 0) return mezzoCmp;
      return missionAperturaMs(b) - missionAperturaMs(a);
    })
    .map((m) => ({
      mezzo: m.mezzo,
      idMissione: m.idMissione ?? '',
      missioneIdUnivoco: m.idUnivoco ?? '',
      missione: m,
      label: formatMissioneMezzoLabel(m.idMissione, m.mezzo),
    }));
}

/** @deprecated Usare {@link mezziMissioniEventoOptions}. */
export function mezziMissioniEvento(missioni, evento = null) {
  return mezziMissioniEventoOptions(missioni, evento).map((o) => o.mezzo);
}

export function fieldsPerEsito(esito, { mezzo, missione, clearTrasporto } = {}) {
  if (esito === ESITO_TRASPORTA) {
    const mis = missione ?? null;
    return {
      esito,
      mezzo: mezzo ?? mis?.mezzo ?? '',
      idMissione: mis?.idMissione ?? '',
      missioneIdUnivoco: mis?.idUnivoco ?? '',
      stato: mis?.idUnivoco || mezzo || mis?.mezzo ? 'TRASPORTO' : 'ATTESA',
    };
  }
  if (clearTrasporto) {
    return {
      esito,
      mezzo: '',
      idMissione: '',
      missioneIdUnivoco: '',
      ospedaleDestinazione: '',
      destinazionePmaId: '',
      pmaId: '',
      statoPzPma: null,
      percorsoCodiceMinore: false,
      tipoPz: TIPO_PZ.CENTRALE,
      stato: 'ATTESA',
      arrivatoHAt: null,
      ...emptySoreuFirestoreClear(),
    };
  }
  return { esito, stato: 'ATTESA' };
}

export function applyMissioneArrivatoH(paziente) {
  if (paziente.esito !== ESITO_TRASPORTA) return null;
  if (paziente.stato === 'ARRIVATO H') return null;
  return {
    stato: 'ARRIVATO H',
    arrivatoHAt: Timestamp.now(),
    aperta: false,
  };
}
