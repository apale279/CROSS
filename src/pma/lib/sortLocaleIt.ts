/** Ordinamento alfabetico per elenchi UI e persistenza (it-IT, case-insensitive). */
export function sortStringsIt(list: readonly string[]): string[] {
  return [...list].sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }))
}

export function sortRecordKeysAndValuesIt(map: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const k of sortStringsIt(Object.keys(map))) {
    out[k] = sortStringsIt(map[k] ?? [])
  }
  return out
}
