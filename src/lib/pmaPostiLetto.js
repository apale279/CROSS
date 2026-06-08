/** @typedef {{ id: string, col: number, row: number, label: string }} PostoLetto */

export const PMA_POSTO_LETTO_SENZA = null;

/** Id stabile per cella griglia (col, row). */
export function postoLettoId(col, row) {
  return `bed-c${col}-r${row}`;
}

/** Numero progressivo: riga per riga da sinistra a destra (1,2 poi 3,4 …). */
export function defaultPostoLettoNumero(col, row, colonne) {
  return row * colonne + col + 1;
}

/** Etichetta default: LETTO N°1, LETTO N°2, … */
export function defaultPostoLettoLabel(col, row, colonne) {
  return `LETTO N°${defaultPostoLettoNumero(col, row, colonne)}`;
}

export function normalizeGrigliaPostiLetto(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const righe = Math.max(0, Math.min(20, Math.trunc(Number(raw.righe) || 0)));
  const colonne = Math.max(0, Math.min(12, Math.trunc(Number(raw.colonne) || 0)));
  if (righe < 1 || colonne < 1) return null;
  return { righe, colonne };
}

export function pmaHaGrigliaPostiLetto(pmaEntry) {
  return normalizeGrigliaPostiLetto(pmaEntry?.grigliaPostiLetto) != null;
}

/**
 * Elenco posti letto per PMA (ordine griglia: riga per riga, sinistra → destra).
 * @param {object} pmaEntry
 * @returns {PostoLetto[]}
 */
export function buildPostiLetto(pmaEntry) {
  const griglia = normalizeGrigliaPostiLetto(pmaEntry?.grigliaPostiLetto);
  if (!griglia) return [];
  const labels = pmaEntry?.postiLettoLabels && typeof pmaEntry.postiLettoLabels === 'object'
    ? pmaEntry.postiLettoLabels
    : {};
  const out = [];
  for (let row = 0; row < griglia.righe; row += 1) {
    for (let col = 0; col < griglia.colonne; col += 1) {
      const id = postoLettoId(col, row);
      const custom = String(labels[id] ?? '').trim();
      out.push({
        id,
        col,
        row,
        label: custom || defaultPostoLettoLabel(col, row, griglia.colonne),
      });
    }
  }
  return out;
}

export function readPazientePostoLettoId(paziente) {
  const id = String(paziente?.pmaPostoLettoId ?? '').trim();
  return id || PMA_POSTO_LETTO_SENZA;
}

/** Raggruppa pazienti in carico per posto letto. */
export function partitionInCaricoPerPostiLetto(pazienti, postiLetto) {
  const byBed = new Map(postiLetto.map((b) => [b.id, null]));
  const senzaLetto = [];
  for (const p of pazienti ?? []) {
    const bedId = readPazientePostoLettoId(p);
    if (bedId && byBed.has(bedId)) {
      const prev = byBed.get(bedId);
      if (prev) senzaLetto.push(prev);
      byBed.set(bedId, p);
    } else {
      senzaLetto.push(p);
    }
  }
  return { byBed, senzaLetto };
}

export const PMA_PAZIENTE_DRAG_MIME = 'text/x-cross-pma-paziente';

let pmaPatientDragDocId = null;

export function setPmaPatientDragDocId(docId) {
  pmaPatientDragDocId = docId ? String(docId) : null;
}

export function getPmaPatientDragDocId() {
  return pmaPatientDragDocId;
}
