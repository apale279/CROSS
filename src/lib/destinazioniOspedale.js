/** Opzioni menu «Ospedale destinazione»: lista ospedali + nomi PMA (senza duplicati). */
export function listaDestinazioniOspedale(impostazioni) {
  const fromList = (impostazioni?.listaOspedali ?? [])
    .map((s) => String(s).trim())
    .filter(Boolean);
  const fromPma = (impostazioni?.pma ?? [])
    .map((p) => String(p?.nome ?? '').trim())
    .filter(Boolean);

  const seen = new Set();
  const out = [];
  for (const name of [...fromList, ...fromPma]) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
}
