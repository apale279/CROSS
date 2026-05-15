import { DEFAULT_IMPOSTAZIONI } from '../constants';

/** Unifica dati Firestore con default e migra dettagliEvento → dettagliPerTipoEvento. */
export function normalizeImpostazioni(data) {
  const merged = { ...DEFAULT_IMPOSTAZIONI, ...(data ?? {}) };
  let dettagliPerTipo = merged.dettagliPerTipoEvento;

  if (
    (!dettagliPerTipo || typeof dettagliPerTipo !== 'object' || Object.keys(dettagliPerTipo).length === 0) &&
    Array.isArray(merged.dettagliEvento) &&
    merged.dettagliEvento.length > 0
  ) {
    dettagliPerTipo = Object.fromEntries(
      (merged.tipiEvento ?? []).map((tipo) => [tipo, [...merged.dettagliEvento]]),
    );
  }

  if (!dettagliPerTipo || typeof dettagliPerTipo !== 'object') {
    dettagliPerTipo = {};
  }

  return { ...merged, dettagliPerTipoEvento: dettagliPerTipo };
}

export function dettagliPerTipoEvento(impostazioni, tipoEvento) {
  const map = impostazioni?.dettagliPerTipoEvento ?? {};
  if (!tipoEvento) return [];
  return map[tipoEvento] ?? [];
}
