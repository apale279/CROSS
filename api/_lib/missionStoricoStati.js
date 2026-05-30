import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export function storicoStatoDotPath(statoKey) {
  return `storicoStati.${statoKey}`;
}

export function buildStatoChangeFields(missione, nuovoStato) {
  const fields = {
    stato: nuovoStato,
    [storicoStatoDotPath(nuovoStato)]: Timestamp.now(),
    statoDa: FieldValue.serverTimestamp(),
  };
  if (nuovoStato === 'FINE MISSIONE' || nuovoStato === 'ANNULLATA') fields.aperta = false;
  return fields;
}
