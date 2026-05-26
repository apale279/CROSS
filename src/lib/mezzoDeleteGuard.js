import { missioniAperteSuMezzo } from './mezzoMissione';

/** Messaggio se il mezzo non può essere eliminato; `null` se ok. */
export function getMezzoDeleteBlockReason(sigla, missioni) {
  const key = String(sigla ?? '').trim();
  if (!key) return 'Sigla mezzo non valida.';
  const open = missioniAperteSuMezzo(missioni ?? [], key);
  if (!open.length) return null;
  const labels = open
    .map((m) => m.idMissione || m._docId)
    .filter(Boolean)
    .slice(0, 5);
  const extra = open.length > labels.length ? ` (+${open.length - labels.length})` : '';
  const list = labels.length ? labels.join(', ') + extra : String(open.length);
  return `Missione/i ancora aperta/e su questo mezzo: ${list}. Chiudi o annulla prima di eliminare.`;
}
