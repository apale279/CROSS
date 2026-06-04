/** Chiavi entità eliminabili (zona pericolosa impostazioni). */
export const WIPE_ENTITY_KEYS = ['eventi', 'missioni', 'mezzi', 'pazienti', 'note'];

export const WIPE_ENTITY_LABELS = {
  eventi: 'Eventi',
  missioni: 'Missioni',
  mezzi: 'Mezzi',
  pazienti: 'Pazienti',
  note: 'Note (diario)',
};

import { skipIdSeedField } from './progressiveCounters';

/** Contatori ID progressivi in `settings/contatori`. */
export const COUNTER_RESET_KEYS = ['eventi', 'missioni', 'pazienti'];
export const COUNTER_RESET_LABELS = {
  eventi: 'Evento (E1, E2…)',
  missioni: 'Missione (M1, M2…)',
  pazienti: 'Paziente (P1, P2…)',
};

export function emptyEntitySelection() {
  return Object.fromEntries(WIPE_ENTITY_KEYS.map((k) => [k, false]));
}

export function emptyCounterSelection() {
  return Object.fromEntries(COUNTER_RESET_KEYS.map((k) => [k, false]));
}

export function selectedEntityKeys(selection) {
  return WIPE_ENTITY_KEYS.filter((k) => selection[k]);
}

export function selectedCounterKeys(selection) {
  return COUNTER_RESET_KEYS.filter((k) => selection[k]);
}

export function buildCounterResetPatch(selection) {
  const patch = {};
  for (const k of COUNTER_RESET_KEYS) {
    if (selection[k]) {
      patch[k] = 0;
      patch[skipIdSeedField(k)] = true;
    }
  }
  return patch;
}