import { normalizeMsbDetails } from './msbValutazione';

export function normalizeValutazioniSoccorso(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((v, i) => {
    const tipo = v.tipo === 'MSA' ? 'MSA' : 'MSB';
    return {
      id: v.id ?? `legacy-${i}`,
      tipo,
      testo: v.testo ?? '',
      msbDetails: tipo === 'MSB' ? normalizeMsbDetails(v.msbDetails) : null,
      creatoIl: v.creatoIl ?? null,
    };
  });
}
