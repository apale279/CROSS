import { GripVertical } from 'lucide-react';
import { MEZZO_STATO_DISPONIBILE } from '../../lib/mezzoStati';
import { mezzoOnTacticalBoard } from '../../lib/tacticalBoard';
import { mezzoRowClass } from '../../utils/formatters';

export const MEZZO_DRAG_MIME = 'text/x-cross-mezzo';

export function MezziPilaSidebar({ mezzi, selectedSigla, onSelect }) {
  const inPila = mezzi.filter((m) => !mezzoOnTacticalBoard(m));

  return (
    <aside className="flex h-full min-h-0 w-72 shrink-0 flex-col border-l border-slate-200 bg-white shadow-lg">
      <header className="border-b border-slate-200 px-3 py-3">
        <h2 className="text-sm font-bold uppercase text-slate-800">Pila mezzi</h2>
        <p className="mt-1 text-xs text-slate-500">
          Trascina sulla piantina per posizionare. Qui: mezzi non ancora sul tabellone.
        </p>
      </header>
      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {inPila.length === 0 && (
          <li className="px-2 py-6 text-center text-sm text-slate-500">
            Tutti i mezzi sono sulla piantina.
          </li>
        )}
        {inPila.map((m) => {
          const sigla = m.sigla ?? m._docId;
          const selected = selectedSigla === sigla;
          return (
            <li key={sigla} className="mb-1.5">
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(MEZZO_DRAG_MIME, sigla);
                  e.dataTransfer.setData('text/plain', sigla);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => onSelect?.(m)}
                className={`flex w-full cursor-grab items-center gap-2 rounded-lg border px-2 py-2 text-left text-sm active:cursor-grabbing ${mezzoRowClass(m)} ${
                  selected ? 'ring-2 ring-sky-500' : 'border-slate-200 hover:border-sky-300'
                }`}
              >
                <GripVertical className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="font-mono font-bold text-slate-900">{sigla}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-600">{m.tipo}</span>
                  <span
                    className={`mt-0.5 block text-xs font-semibold ${
                      (m.statoMezzo ?? MEZZO_STATO_DISPONIBILE) === MEZZO_STATO_DISPONIBILE
                        ? 'text-emerald-700'
                        : 'text-slate-600'
                    }`}
                  >
                    {m.statoMezzo ?? MEZZO_STATO_DISPONIBILE}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
