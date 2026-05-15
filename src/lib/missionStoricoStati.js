import { Timestamp } from 'firebase/firestore';

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

export function buildStatoChangeFields(missione, nuovoStato) {
  const storico = cloneStoricoStati(missione?.storicoStati);
  storico[nuovoStato] = Timestamp.now();
  const fields = { stato: nuovoStato, storicoStati: storico };
  if (nuovoStato === 'FINE MISSIONE' || nuovoStato === 'ANNULLATA') fields.aperta = false;
  return fields;
}

export function patchStoricoStatoAt(missione, statoKey, date) {
  const storico = cloneStoricoStati(missione?.storicoStati);
  if (date) storico[statoKey] = Timestamp.fromDate(date);
  else delete storico[statoKey];
  return { storicoStati: storico };
}
