/**
 * Ordine elenco manifestazione, poi eventuali voci in `prestazioni_sel` non presenti in lista.
 */
export function orderedPrestazioniLabels(
  manifestPrestazioniLista: string[],
  prestazioniSel: string[],
): string[] {
  const selSet = new Set(prestazioniSel)
  const fromLista = manifestPrestazioniLista.filter((l) => selSet.has(l))
  const listaSet = new Set(manifestPrestazioniLista)
  const extra = prestazioniSel.filter((l) => !listaSet.has(l))
  return [...fromLista, ...extra]
}

/** Righe da 4 celle (riempimento orizzontale, poi a capo). */
export function prestazioniRowsOfFour(labels: string[]): string[][] {
  const rows: string[][] = []
  for (let i = 0; i < labels.length; i += 4) {
    const row = labels.slice(i, i + 4)
    while (row.length < 4) row.push('')
    rows.push(row)
  }
  return rows
}
