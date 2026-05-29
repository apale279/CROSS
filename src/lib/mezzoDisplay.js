import { findStazionamentoById, resolveMezzoStazionamentoId } from './mezzoStazionamentoAssign';

/**
 * Colonna Stazionamento in dashboard: nome del preset Impostazioni,
 * altrimenti testo libero da scheda mezzo (`dettaglio_stazionamento`, es. «Piazza Roma»).
 */
export function mezzoStazionamentoDashboardLabel(mezzo, stazionamenti = []) {
  const sedeId = resolveMezzoStazionamentoId(mezzo, stazionamenti);
  const sede = findStazionamentoById(sedeId, stazionamenti);
  const nome = (sede?.nome ?? '').trim();
  if (nome) return nome;

  return (mezzo?.dettaglio_stazionamento ?? '').trim();
}

/** Testo stazionamento per liste (indirizzo, altrimenti luogo fisico). */
export function mezzoStazionamentoLabel(mezzo) {
  const s = mezzo?.stazionamento;
  const indirizzo = (s?.indirizzo ?? '').trim();
  if (indirizzo) return indirizzo;
  const luogo = (s?.luogo_fisico ?? '').trim();
  if (luogo) return luogo;
  return (mezzo?.dettaglio_stazionamento ?? '').trim();
}
