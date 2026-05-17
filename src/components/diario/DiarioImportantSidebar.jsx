import { useMemo } from 'react';
import { Star } from 'lucide-react';

function noteTime(nota) {
  return nota.aggiornatoIl?.toMillis?.() ?? nota.creatoIl?.toMillis?.() ?? 0;
}

export function DiarioImportantSidebar({ note, loading, onOpenNota }) {
  const importanti = useMemo(
    () =>
      note
        .filter((n) => n.importante === true)
        .sort((a, b) => {
          const aOpen = a.aperta !== false ? 1 : 0;
          const bOpen = b.aperta !== false ? 1 : 0;
          if (bOpen !== aOpen) return bOpen - aOpen;
          return noteTime(b) - noteTime(a);
        }),
    [note],
  );

  return (
    <aside className="flex w-[10.4rem] shrink-0 flex-col border-r border-slate-300 bg-amber-50/90">
      <div className="border-b border-amber-200/80 px-2 py-1.5">
        <h3 className="flex items-center gap-1 text-[10px] font-bold uppercase leading-tight tracking-wide text-amber-950">
          <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" aria-hidden />
          Note importanti
        </h3>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {loading && <p className="px-1 text-xs text-slate-500">Caricamento…</p>}
        {!loading && importanti.length === 0 && (
          <p className="px-1 text-xs text-slate-500">Nessuna nota importante.</p>
        )}
        <ul className="space-y-1">
          {importanti.map((nota) => {
            const aperta = nota.aperta !== false;
            return (
              <li key={nota._docId}>
                <button
                  type="button"
                  onClick={() => onOpenNota?.(nota)}
                  className={`w-full rounded border px-1.5 py-1 text-left text-[11px] font-semibold leading-snug transition-colors ${
                    aperta
                      ? 'border-amber-300 bg-white text-amber-950 hover:bg-amber-100'
                      : 'border-slate-200 bg-slate-50/80 text-slate-600 hover:bg-white'
                  }`}
                  title={nota.testo ? String(nota.testo).slice(0, 120) : undefined}
                >
                  {nota.titolo || 'Senza titolo'}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
