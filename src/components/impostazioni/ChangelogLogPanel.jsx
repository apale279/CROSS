import { useMemo } from 'react';
import { changeLogByDate, CROSS_CHANGE_LOG } from '../../data/crossChangeLog';

function formatDateIt(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export function ChangelogLogPanel() {
  const grouped = useMemo(() => changeLogByDate(), []);
  const total = CROSS_CHANGE_LOG.length;
  const last = CROSS_CHANGE_LOG[CROSS_CHANGE_LOG.length - 1];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p>
          Registro in <strong>sola lettura</strong> delle modifiche applicate a CROSS dalla creazione
          dell’app ({formatDateIt(grouped[0]?.[0] ?? '—')}) a oggi. Sono elencate solo
          funzionalità introdotte o migliorate; le voci rimosse non compaiono.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {total} voci · ultimo aggiornamento log: {last ? formatDateIt(last.date) : '—'}
          {last?.version ? ` (${last.version})` : ''}
        </p>
      </div>

      <div
        className="max-h-[min(70vh,720px)] overflow-y-auto rounded-lg border border-slate-200 bg-white"
        role="log"
        aria-label="Registro modifiche CROSS"
      >
        <ol className="divide-y divide-slate-100">
          {grouped.map(([date, entries]) => (
            <li key={date} className="px-4 py-3">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                {formatDateIt(date)}
              </h3>
              <ul className="space-y-2">
                {entries.map((entry, idx) => (
                  <li
                    key={`${date}-${idx}`}
                    className="flex gap-2 text-sm leading-snug text-slate-800"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden />
                    <span>
                      {entry.version ? (
                        <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                          {entry.version}
                        </span>
                      ) : null}
                      {entry.description}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
