/** In CROSS non c’è il documento `pma/{id}` PMApp: tracciamento farmaci opzionale, no-op. */
export async function registerPmaFarmacoUsato(
  _db: unknown,
  _pmaId: string | undefined,
  _nomeFarmaco: string,
): Promise<void> {
  /* intentionally empty */
}
