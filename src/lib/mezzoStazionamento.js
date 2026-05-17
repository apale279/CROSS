/** Unisce aggiornamenti parziali senza perdere campi di stazionamento già salvati. */
export function mergeStazionamento(existing, partial) {
  const base = existing && typeof existing === 'object' ? existing : {};
  const next = partial && typeof partial === 'object' ? partial : {};
  return {
    indirizzo: next.indirizzo !== undefined ? next.indirizzo : (base.indirizzo ?? ''),
    luogo_fisico:
      next.luogo_fisico !== undefined ? next.luogo_fisico : (base.luogo_fisico ?? ''),
    coordinate:
      next.coordinate !== undefined ? next.coordinate : (base.coordinate ?? null),
  };
}
