import {
  listaOspedaliDestinazione as listaOspedali,
  listaPmaImpostazioni,
  findPmaById,
  findPmaByNome,
  resolveDestinazionePaziente,
  pazienteHaDestinazionePma,
} from './pmaModule';

export {
  listaOspedali as listaOspedaliDestinazione,
  listaPmaImpostazioni,
  findPmaById,
  findPmaByNome,
  resolveDestinazionePaziente,
  pazienteHaDestinazionePma,
};

/** @deprecated Usare listaOspedaliDestinazione + listaPmaImpostazioni */
export function listaDestinazioniOspedale(impostazioni) {
  const names = [
    ...listaOspedali(impostazioni),
    ...listaPmaImpostazioni(impostazioni).map((p) => p.nome),
  ];
  const seen = new Set();
  const out = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
}
