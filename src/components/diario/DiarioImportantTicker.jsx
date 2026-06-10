import { useMemo } from 'react';
import { Star } from 'lucide-react';

function noteTime(nota) {
  return nota.aggiornatoIl?.toMillis?.() ?? nota.creatoIl?.toMillis?.() ?? 0;
}

function tickerLabel(nota) {
  const titolo = String(nota.titolo ?? '').trim();
  if (titolo) return titolo.length > 96 ? `${titolo.slice(0, 96)}…` : titolo;
  const testo = String(nota.testo ?? '').trim().replace(/\s+/g, ' ');
  if (!testo) return 'Senza titolo';
  return testo.length > 96 ? `${testo.slice(0, 96)}…` : testo;
}

export function DiarioImportantTicker({ note, loading, onOpenNota, hideWhenEmpty = false }) {
  /** Solo note importanti ancora aperte: una nota chiusa sparisce dal ticker. */
  const importanti = useMemo(
    () =>
      note
        .filter((n) => n.importante === true && n.aperta !== false)
        .sort((a, b) => noteTime(b) - noteTime(a)),
    [note],
  );

  if (hideWhenEmpty && !loading && importanti.length === 0) {
    return null;
  }

  const renderTrack = (keySuffix = '') =>
    importanti.map((nota) => (
      <button
        key={`${nota._docId}${keySuffix}`}
        type="button"
        onClick={() => onOpenNota?.(nota)}
        className="mx-6 inline-flex shrink-0 items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-amber-950 hover:text-amber-700"
        title={nota.testo ? String(nota.testo).slice(0, 200) : nota.titolo}
      >
        <Star className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-500" aria-hidden />
        {tickerLabel(nota)}
      </button>
    ));

  return (
    <div className="w-full border-t border-amber-200/90 bg-amber-50">
      {loading && (
        <p className="px-3 py-1.5 text-center text-xs font-medium text-amber-900/70">
          Caricamento note importanti…
        </p>
      )}
      {!loading && importanti.length === 0 && (
        <p className="px-3 py-1.5 text-center text-xs font-medium text-amber-900/50">
          Nessuna nota importante
        </p>
      )}
      {!loading && importanti.length > 0 && (
        <div className="diario-ticker-mask relative w-full overflow-hidden py-2">
          <div className="diario-ticker-track flex w-max items-center">
            {renderTrack('-a')}
            {renderTrack('-b')}
          </div>
        </div>
      )}
    </div>
  );
}

