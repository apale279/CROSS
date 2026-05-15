import { Timestamp } from 'firebase/firestore';
import { ESITO_TRASPORTA } from '../constants';

/**
 * Modello trasporto (centrale / evento):
 * - Una **missione aperta** è legata a **un mezzo**.
 * - **Più pazienti** possono avere esito «Trasporta» sullo **stesso mezzo**: condividono
 *   `mezzo`, `idMissione` e `missioneIdUnivoco` (stessa missione in corso).
 * - Qui si risolve «quale missione» usare quando l’operatore sceglie la sigla mezzo:
 *   la prima missione **aperta** dell’evento che usa quel mezzo (in dati puliti ce n’è una sola).
 */
export function missionePerMezzo(missioni, mezzo) {
  if (!mezzo) return null;
  return missioni.find((m) => m.mezzo === mezzo && m.aperta !== false) ?? null;
}

/** Elenco sigle mezzo con almeno una missione aperta sull’evento (stesso mezzo = carico multiplo ammesso). */
export function mezziMissioniEvento(missioni) {
  const sigle = new Set();
  missioni
    .filter((m) => m.aperta !== false && m.mezzo)
    .forEach((m) => sigle.add(m.mezzo));
  return [...sigle].sort((a, b) => String(a).localeCompare(String(b), 'it', { sensitivity: 'base' }));
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
      stato: 'ATTESA',
      arrivatoHAt: null,
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
  };
}
