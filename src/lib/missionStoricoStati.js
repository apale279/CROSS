import { deleteField, Timestamp } from 'firebase/firestore';

export function cloneStoricoStati(storico) {
  if (!storico || typeof storico !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(storico)) {
    if (value?.toDate) out[key] = value;
    else if (value instanceof Date) out[key] = Timestamp.fromDate(value);
    else if (value) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) out[key] = Timestamp.fromDate(d);
    }
  }
  return out;
}

/** Path puntato: evita RMW dell'intera mappa `storicoStati`. */
export function storicoStatoDotPath(statoKey) {
  return `storicoStati.${statoKey}`;
}

export function buildStatoChangeFields(missione, nuovoStato) {
  const fields = {
    stato: nuovoStato,
    [storicoStatoDotPath(nuovoStato)]: Timestamp.now(),
  };
  if (nuovoStato === 'FINE MISSIONE' || nuovoStato === 'ANNULLATA') fields.aperta = false;
  return fields;
}

export function patchStoricoStatoAt(missione, statoKey, date) {
  if (date) {
    return { [storicoStatoDotPath(statoKey)]: Timestamp.fromDate(date) };
  }
  return { [storicoStatoDotPath(statoKey)]: deleteField() };
}
