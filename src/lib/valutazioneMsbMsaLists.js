/** Array di nomi (stringhe) per impostazioni e selezioni MSB/MSA. */

export function normalizeStringNameArray(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const t = String(item ?? '').trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Filtra selezione ai valori ancora presenti in catalogo (ordine catalogo). */
export function intersectSelectionWithCatalog(catalog, selected) {
  const sel = new Set(normalizeStringNameArray(selected).map((s) => s.toLowerCase()));
  return normalizeStringNameArray(catalog).filter((label) => sel.has(label.toLowerCase()));
}

export function listaMsbMsaPresidi(impostazioni) {
  return normalizeStringNameArray(impostazioni?.msbMsaPresidi);
}

export function listaPrestazioniMsb(impostazioni) {
  return normalizeStringNameArray(impostazioni?.prestazioniMsb);
}

export function listaPrestazioniMsa(impostazioni) {
  return normalizeStringNameArray(impostazioni?.prestazioniMsa);
}

export function normalizeValutazioniMsbMsaImpostazioni(raw) {
  return {
    lesioniLocalizzazioni: normalizeStringNameArray(raw?.lesioniLocalizzazioni),
    lesioniTipologie: normalizeStringNameArray(raw?.lesioniTipologie),
    msbMsaPresidi: normalizeStringNameArray(raw?.msbMsaPresidi),
    prestazioniMsb: normalizeStringNameArray(raw?.prestazioniMsb),
    prestazioniMsa: normalizeStringNameArray(raw?.prestazioniMsa),
    lesioniVasMax: (() => {
      const n = Number(raw?.lesioniVasMax);
      return Number.isFinite(n) && n >= 1 ? Math.min(10, Math.floor(n)) : 10;
    })(),
  };
}
