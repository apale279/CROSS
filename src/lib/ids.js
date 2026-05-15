/** Identificatore stabile (non riutilizzato). Non mostrato in UI. */
export function newIdUnivoco() {
  return crypto.randomUUID();
}
