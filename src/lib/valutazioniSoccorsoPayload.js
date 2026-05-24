import { Timestamp } from 'firebase/firestore';
import { normalizeMsbDetails } from './msbValutazione';
import { normalizeMsaDetails } from './msaValutazione';

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
      msbDetails: normalizeMsbDetails(v.msbDetails),
      msaDetails: null,
      mezzo: '',
    };
  }
  const msa = normalizeMsaDetails(v.msaDetails);
  return {
    ...base,
    msbDetails: null,
    msaDetails: msa,
    mezzo: v.mezzo ?? msa.mezzoMsa ?? '',
  };
}

export function newValutazioneSoccorsoItem(tipo) {
  const id = crypto.randomUUID();
  if (tipo === 'MSA') {
    return payloadValutazioneRow({
      id,
      tipo: 'MSA',
      testo: '',
      msaDetails: normalizeMsaDetails(null),
      creatoIl: Timestamp.now(),
    });
  }
  return payloadValutazioneRow({
    id,
    tipo: 'MSB',
    testo: '',
    msbDetails: normalizeMsbDetails(null),
    creatoIl: Timestamp.now(),
  });
}
