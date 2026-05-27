import { mergeStazionamento } from './mezzoStazionamento';
import { findStazionamentoByNome } from './parseFlottaMezziExcel';

export function findStazionamentoById(id, stazionamenti) {
  const key = String(id ?? '').trim();
  if (!key) return null;
  return (stazionamenti ?? []).find((s) => s.id === key) ?? null;
}

/** Valore menu a tendina: id preset o match legacy su indirizzo. */
export function resolveMezzoStazionamentoId(mezzo, stazionamenti) {
  const fromId = findStazionamentoById(mezzo?.stazionamentoId, stazionamenti);
  if (fromId) return fromId.id;

  const indirizzo = String(mezzo?.stazionamento?.indirizzo ?? '').trim();
  if (indirizzo) {
    const hit = (stazionamenti ?? []).find(
      (s) => String(s.indirizzo ?? '').trim() === indirizzo,
    );
    if (hit) return hit.id;
  }
  return '';
}

/**
 * Assegna un solo stazionamento al mezzo: copia indirizzo/coordinate e marca come base
 * (a fine missione il mezzo è considerato in quella sede).
 */
export function mezzoPatchFromStazionamentoPreset(preset) {
  if (!preset) {
    return {
      stazionamentoId: '',
      stazionamento: mergeStazionamento({}, {}),
      stazionamentoPredefinito: false,
    };
  }
  return {
    stazionamentoId: preset.id,
    stazionamento: mergeStazionamento({}, {
      indirizzo: preset.indirizzo ?? '',
      luogo_fisico: preset.luogo_fisico ?? '',
      note: preset.note ?? '',
      coordinate: preset.coordinate ?? null,
    }),
    stazionamentoPredefinito: true,
  };
}

/** Alla creazione: applica il preset scelto dal menu (se `stazionamentoId` impostato). */
export function applyStazionamentoOnMezzoCreate(form, stazionamentiPreset) {
  const id = String(form?.stazionamentoId ?? '').trim();
  if (!id) return form;
  const preset = findStazionamentoById(id, stazionamentiPreset);
  if (!preset) return form;
  return { ...form, ...mezzoPatchFromStazionamentoPreset(preset) };
}

/** Import Excel FLOTTA: colonna C = nome stazionamento nell’elenco Impostazioni. */
export function mezzoPatchFromStazionamentoNome(nome, stazionamenti) {
  const preset = findStazionamentoByNome(nome, stazionamenti);
  return mezzoPatchFromStazionamentoPreset(preset);
}
