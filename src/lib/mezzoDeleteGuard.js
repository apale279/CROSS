import { missioniBloccantiEliminazioneMezzo } from './mezzoMissione';

/** Messaggio se il mezzo non può essere eliminato; `null` se ok. */
export function getMezzoDeleteBlockReason(sigla, missioni) {
  const key = String(sigla ?? '').trim();
  if (!key) return 'Sigla mezzo non valida.';
  const blocking = missioniBloccantiEliminazioneMezzo(missioni ?? [], key);
  if (!blocking.length) return null;
  const labels = blocking
    .map((m) => {
      const id = m.idMissione || m._docId || '—';
      const stato = String(m.stato ?? '').trim();
      return stato ? `${id} (${stato})` : id;
    })
    .filter(Boolean)
    .slice(0, 5);
  const extra = blocking.length > labels.length ? ` (+${blocking.length - labels.length})` : '';
  const list = labels.length ? labels.join(', ') + extra : String(blocking.length);
  return (
    `Missione/i ancora attive su questo mezzo: ${list}. ` +
    'Portale in FINE MISSIONE o ANNULLATA dalla scheda missione, oppure chiudi da Telegram.'
  );
}
