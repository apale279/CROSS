/** Opzione “nessuna” negli elenchi EO rapido (manifestazione / cartella). */
export function isNessunaEoOptionLabel(label: string): boolean {
  const t = label.trim()
  if (!t) return false
  return t.toUpperCase() === 'NESSUNA' || t.toUpperCase() === 'NESSUNO'
}

/**
 * Liste EO da manifestazione / Firestore: trim, niente duplicati, **nessuna** voce «NESSUNO»/«NESSUNA»
 * (non sono più chip; il default è sempre il **primo** valore reale dell’array).
 */
export function normalizeEoQuickLabels(labels: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of labels) {
    const x = raw.trim()
    if (!x || isNessunaEoOptionLabel(x) || seen.has(x)) continue
    seen.add(x)
    out.push(x)
  }
  return out
}

/**
 * Toggle chip in selezione multipla EO: “NESSUNA” è mutuamente esclusiva con le altre voci.
 */
export function toggleEoQuickSelection(prev: string[], label: string): string[] {
  const set = new Set(prev)
  const had = set.has(label)
  if (had) {
    set.delete(label)
    return [...set]
  }
  if (isNessunaEoOptionLabel(label)) {
    return [label]
  }
  for (const x of [...set]) {
    if (isNessunaEoOptionLabel(x)) set.delete(x)
  }
  set.add(label)
  return [...set]
}

export function nessunaEoOptionDisabled(
  disabled: boolean | undefined,
  _colSelected: string[],
  _label: string,
): boolean {
  if (disabled) return true
  return false
}

/** Opzione default EO per colonna: «NELLA NORMA». */
export function isNellaNormaEoOptionLabel(label: string): boolean {
  return label.trim().toUpperCase() === 'NELLA NORMA';
}

export function defaultEoLabelForColumn(labels: readonly string[]): string {
  const normalized = normalizeEoQuickLabels([...labels]);
  const nellaNorma = normalized.find(isNellaNormaEoOptionLabel);
  if (nellaNorma) return nellaNorma;
  return normalized[0] ?? '';
}

/** @deprecated Usare {@link defaultEoLabelForColumn}. */
export function firstEoDefaultLabelFromLabels(labels: readonly string[]): string {
  return defaultEoLabelForColumn(labels);
}

/**
 * Il **primo valore** della lista è il default (normale), sempre compatibile con le altre voci:
 * - click sul primo → solo `[primo]` (deseleziona tutto il resto);
 * - click su un altro valore → il primo viene tolto; si fa toggle su quella voce tra le rimanenti;
 * - se non resta nessuna voce selezionata → torna al solo default `[primo]`.
 */
export function toggleEoQuickFirstDefaultExclusive(
  prev: string[],
  label: string,
  firstLabel: string,
): string[] {
  const fKey = firstLabel.trim()
  const lKey = label.trim()
  if (!fKey) return toggleEoQuickSelection(prev, label)

  if (lKey === fKey) {
    return [firstLabel]
  }

  const withoutFirst = prev.filter((x) => x.trim() !== fKey)
  const pool = [...withoutFirst, label]
  const keySet = new Set(withoutFirst.map((x) => x.trim()))
  if (keySet.has(lKey)) {
    keySet.delete(lKey)
  } else {
    keySet.add(lKey)
  }

  const out: string[] = []
  for (const k of keySet) {
    const found = pool.find((p) => p.trim() === k)
    if (found && !out.some((o) => o.trim() === k)) out.push(found)
  }
  if (out.length === 0) return [firstLabel]
  return out
}

/** Toggle multiselect EO: «NELLA NORMA» esclusiva rispetto alle voci alterate. */
export function toggleEoQuickColumnSelection(
  prev: string[],
  label: string,
  columnLabels: readonly string[],
): string[] {
  const norma = defaultEoLabelForColumn(columnLabels)
  if (isNellaNormaEoOptionLabel(label)) {
    return norma ? [norma] : toggleEoQuickSelection(prev, label)
  }
  return toggleEoQuickFirstDefaultExclusive(prev, label, norma)
}

function eoLabelKey(label: string): string {
  return label.trim().toUpperCase()
}

function uniqueEoLabels(labels: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of labels) {
    const x = raw.trim()
    if (!x) continue
    const k = eoLabelKey(x)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(x)
  }
  return out
}

function orderEoLabels(values: readonly string[], columnLabels: readonly string[]): string[] {
  const pool = uniqueEoLabels(values)
  const poolKeys = new Set(pool.map(eoLabelKey))
  const ordered: string[] = []
  for (const col of columnLabels) {
    const k = eoLabelKey(col)
    if (!poolKeys.has(k)) continue
    const hit = pool.find((p) => eoLabelKey(p) === k)
    if (hit) ordered.push(hit)
  }
  for (const v of pool) {
    if (!ordered.some((o) => eoLabelKey(o) === eoLabelKey(v))) ordered.push(v)
  }
  return ordered
}

export function isEoColumnNormaOnlySelection(
  draft: readonly string[],
  columnLabels: readonly string[],
): boolean {
  const norma = defaultEoLabelForColumn(columnLabels)
  if (!norma) return false
  const clean = uniqueEoLabels(draft)
  return clean.length === 1 && eoLabelKey(clean[0]) === eoLabelKey(norma)
}

/**
 * Merge multi-operatore per colonna EO: applica le modifiche dell'operatore (base → draft)
 * sullo snapshot server corrente, preservando voci aggiunte da altri nel frattempo.
 * Se draft è solo «NELLA NORMA», reset esplicito della colonna.
 */
export function mergeEoQuickColumnSelection(
  server: readonly string[],
  baseAtOpen: readonly string[],
  draft: readonly string[],
  columnLabels: readonly string[],
): string[] {
  const norma = defaultEoLabelForColumn(columnLabels)
  const serverClean = uniqueEoLabels(server)
  const baseClean = uniqueEoLabels(baseAtOpen)
  const draftClean = uniqueEoLabels(draft)

  if (isEoColumnNormaOnlySelection(draftClean, columnLabels) && norma) {
    return [norma]
  }

  const baseKeys = new Set(baseClean.map(eoLabelKey))
  const draftKeys = new Set(draftClean.map(eoLabelKey))

  const removedByUser = baseClean.filter((x) => !draftKeys.has(eoLabelKey(x)))
  const addedByUser = draftClean.filter((x) => !baseKeys.has(eoLabelKey(x)))

  const resultKeys = new Set(serverClean.map(eoLabelKey))
  for (const x of removedByUser) resultKeys.delete(eoLabelKey(x))
  for (const x of addedByUser) resultKeys.add(eoLabelKey(x))

  if (resultKeys.size === 0) {
    return norma ? [norma] : []
  }

  const mergedPool = [
    ...serverClean,
    ...addedByUser,
  ].filter((x) => resultKeys.has(eoLabelKey(x)))

  return orderEoLabels(mergedPool, columnLabels)
}

/** Payload patch Firestore per merge transazionale colonna EO. */
export function eoColumnMergePatchPayload(
  baseAtOpen: readonly string[],
  draft: readonly string[],
  columnLabels: readonly string[],
) {
  return {
    __eoMerge: true as const,
    baseAtOpen: [...baseAtOpen],
    draft: [...draft],
    columnLabels: [...columnLabels],
  }
}

export function isEoColumnMergePatchPayload(
  value: unknown,
): value is ReturnType<typeof eoColumnMergePatchPayload> {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as { __eoMerge?: boolean }).__eoMerge === true &&
    Array.isArray((value as { draft?: unknown }).draft)
  )
}
