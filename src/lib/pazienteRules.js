import { Timestamp } from 'firebase/firestore';
import { ESITO_TRASPORTA } from '../constants';
import { normalizeMezzoKey } from './mezzoMissione';
import { emptySoreuFirestoreClear } from './soreuTrasporto';

/**
 * Modello trasporto (centrale / evento):
 * - Una **missione aperta** è legata a **un mezzo**.
 * - **Più pazienti** possono avere esito «Trasporta» sullo **stesso mezzo**: condividono
 *   `mezzo`, `idMissione`, `missioneIdUnivoco` e la **stessa destinazione** (ospedale/PMA).
 * - Qui si risolve «quale missione» usare quando l’operatore sceglie la sigla mezzo:
 *   la prima missione **aperta** dell’evento che usa quel mezzo (in dati puliti ce n’è una sola).
 */
export function missionePerMezzo(missioni, mezzo) {
  if (!mezzo) return null;
  const nk = normalizeMezzoKey(mezzo);
  if (!nk) return null;
  return (
    (missioni ?? []).find(
      (m) => m.mezzo && m.aperta !== false && normalizeMezzoKey(m.mezzo) === nk,
    ) ?? null
  );
}

/** Elenco sigle mezzo con almeno una missione aperta sull’evento (stesso mezzo = carico multiplo ammesso). */
export function mezziMissioniEvento(missioni) {
  const seen = new Set();
  const sigle = [];
  for (const m of missioni ?? []) {
    if (m.aperta === false || !m.mezzo) continue;
    const nk = normalizeMezzoKey(m.mezzo);
    if (!nk || seen.has(nk)) continue;
    seen.add(nk);
    sigle.push(m.mezzo);
  }
  return sigle.sort((a, b) => String(a).localeCompare(String(b), 'it', { sensitivity: 'base' }));
}

export function fieldsPerEsito(esito, { mezzo, missione, clearTrasporto } = {}) {
  if (esito === ESITO_TRASPORTA) {
    const mis = missione ?? null;
    return {
      esito,
      mezzo: mezzo ?? '',
      idMissione: mis?.idMissione ?? '',
      missioneIdUnivoco: mis?.idUnivoco ?? '',
      stato: mezzo ? 'TRASPORTO' : 'ATTESA',
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
