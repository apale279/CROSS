import { mergeStazionamento } from './mezzoStazionamento';

function stazionamentoVuoto(stazionamento) {
  const s = stazionamento ?? {};
  const indirizzo = String(s.indirizzo ?? '').trim();
  const luogo = String(s.luogo_fisico ?? '').trim();
  const coord = s.coordinate;
  return !indirizzo && !luogo && !coord;
}

/**
 * Se «stazionamento predefinito» è attivo e non c’è ancora un luogo, copia il primo preset da impostazioni.
 * Non modifica stazionamento già compilato dall’operatore.
 */
export function applyStazionamentoPresetIfNeeded(form, stazionamentiPreset) {
  if (!form?.stazionamentoPredefinito) return form;
  const presets = stazionamentiPreset ?? [];
  if (!presets.length || !stazionamentoVuoto(form.stazionamento)) return form;
  const st = presets[0];
  return {
    ...form,
    stazionamento: mergeStazionamento(form.stazionamento, {
      indirizzo: st.indirizzo ?? '',
      luogo_fisico: st.luogo_fisico ?? '',
      coordinate: st.coordinate ?? null,
    }),
  };
}
