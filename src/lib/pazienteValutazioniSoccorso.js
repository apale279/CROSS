import { Timestamp } from 'firebase/firestore';
import { normalizeMsbDetails } from './msbValutazione';
import { normalizeMsaDetails } from './msaValutazione';

export function normalizeValutazioniSoccorso(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((v, i) => {
    const tipo = v.tipo === 'MSA' ? 'MSA' : 'MSB';
    if (tipo === 'MSA') {
      const msa = normalizeMsaDetails(v.msaDetails);
      return {
        id: v.id ?? `legacy-${i}`,
        tipo,
        testo: v.testo ?? '',
        msbDetails: null,
        msaDetails: msa,
        mezzo: v.mezzo ?? msa.mezzoMsa ?? '',
        creatoIl: v.creatoIl ?? Timestamp.now(),
      };
    }
    return {
      id: v.id ?? `legacy-${i}`,
      tipo,
      testo: v.testo ?? '',
      msbDetails: normalizeMsbDetails(v.msbDetails),
      msaDetails: null,
      mezzo: '',
      creatoIl: v.creatoIl ?? null,
    };
  });
}
