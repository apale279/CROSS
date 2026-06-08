import { Timestamp } from 'firebase/firestore';
import { newLocalId } from './ids';
import { normalizeMsbDetails } from './msbValutazione';
import { normalizeMsaDetails } from './msaValutazione';
import { lesioniToFirestoreRows } from './valutazioneLesioni';

function msbDetailsForFirestore(raw) {
  const msb = normalizeMsbDetails(raw);
  return { ...msb, lesioni: lesioniToFirestoreRows(msb.lesioni) };
}

function msaDetailsForFirestore(raw) {
  const msa = normalizeMsaDetails(raw);
  return { ...msa, lesioni: lesioniToFirestoreRows(msa.lesioni) };
}

/** Documento completo per Firestore (valori predefiniti inclusi). */
export function payloadValutazioneRow(v) {
  const base = {
    tipo: v.tipo === 'MSA' ? 'MSA' : 'MSB',
    testo: v.testo ?? '',
    creatoIl: v.creatoIl ?? Timestamp.now(),
  };
  if (base.tipo === 'MSB') {
    return {
      ...base,
      msbDetails: msbDetailsForFirestore(v.msbDetails),
      msaDetails: null,
      mezzo: '',
    };
  }
  const msa = msaDetailsForFirestore(v.msaDetails);
  return {
    ...base,
    msbDetails: null,
    msaDetails: msa,
    mezzo: v.mezzo ?? msa.mezzoMsa ?? '',
  };
}

export function newValutazioneSoccorsoItem(tipo) {
  const id = newLocalId();
  if (tipo === 'MSA') {
    return {
      id,
      ...payloadValutazioneRow({
        id,
        tipo: 'MSA',
        testo: '',
        msaDetails: normalizeMsaDetails(null),
        creatoIl: Timestamp.now(),
      }),
    };
  }
  return {
    id,
    ...payloadValutazioneRow({
      id,
      tipo: 'MSB',
      testo: '',
      msbDetails: normalizeMsbDetails(null),
      creatoIl: Timestamp.now(),
    }),
  };
}
