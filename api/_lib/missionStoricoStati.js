import { FieldValue, Timestamp } from 'firebase-admin/firestore';

function cloneStoricoStati(storico) {
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
  const fields = { stato: nuovoStato, storicoStati: storico, statoDa: FieldValue.serverTimestamp() };
  if (nuovoStato === 'FINE MISSIONE' || nuovoStato === 'ANNULLATA') fields.aperta = false;
  return fields;
}
