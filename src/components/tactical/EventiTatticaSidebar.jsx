import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { ColoreIndicator } from '../ui/ColoreIndicator';
import { coloreBadgeClass } from '../../utils/formatters';
import { NuovoEventoRapidoForm } from './NuovoEventoRapidoForm';

export function EventiTatticaSidebar({
  eventi,
  missioni,
  mezzi,
  selectedEventoDocId,
  showRapidoForm,
  onToggleRapidoForm,
  onSelectEvento,
  onEventoRapidoCreated,
  onOpenEventoScheda,
}) {
  const eventiConLuogo = useMemo(
    () =>
      eventi
        .filter((e) => e.stato !== false && (e.luogo_fisico ?? '').trim())
        .sort((a, b) => String(a.idEvento ?? '').localeCompare(String(b.idEvento ?? ''), 'it')),
    [eventi],
  );

  return (
    <aside className="flex h-full min-h-0 w-72 shrink-0 flex-col border-r border-slate-200 bg-white shadow-lg">
      <header className="border-b border-slate-200 px-3 py-3">
        <h2 className="text-sm font-bold uppercase text-slate-800">Eventi in sede</h2>
        <p className="mt-1 text-xs text-slate-500">
          Eventi aperti con luogo evento. Clic per contesto; doppio clic per scheda completa.
        </p>
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-sky-600 bg-sky-600 px-2 py-2 text-xs font-bold uppercase text-white hover:bg-sky-700"
          onClick={onToggleRapidoForm}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Crea evento rapido
        </button>
      </header>

      {showRapidoForm && (
        <NuovoEventoRapidoForm
          eventi={eventi}
          missioni={missioni}
          mezzi={mezzi}
          onCancel={onToggleRapidoForm}
          onCreated={(result) => {
            onEventoRapidoCreated?.(result);
            onToggleRapidoForm();
          }}
        />
      )}

      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {eventiConLuogo.length === 0 && (
          <li className="px-2 py-6 text-center text-sm text-slate-500">
            Nessun evento con luogo evento. Usa «Crea evento rapido».
          </li>
        )}
        {eventiConLuogo.map((ev) => {
          const selected = selectedEventoDocId === ev._docId;
          return (
            <li key={ev._docId} className="mb-1.5">
              <button
                type="button"
                onClick={() => onSelectEvento?.(ev)}
                onDoubleClick={() => onOpenEventoScheda?.(ev)}
                className={`w-full rounded-lg border px-2 py-2 text-left text-sm transition ${
                  selected
                    ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-400'
                    : 'border-slate-200 bg-white hover:border-sky-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <ColoreIndicator colore={ev.colore} size="sm" />
                  <span className="font-mono font-bold text-slate-900">{ev.idEvento}</span>
                  <span
                    className={`ml-auto rounded px-1 py-0.5 text-[9px] font-bold uppercase ${coloreBadgeClass(ev.colore)}`}
                  >
                    {ev.colore}
                  </span>
                </span>
                <span className="mt-1 block truncate text-xs font-medium text-slate-800">
                  {(ev.luogo_fisico ?? '').trim()}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-600">
                  {ev.tipoEvento}
                  {ev.dettaglioEvento ? ` — ${ev.dettaglioEvento}` : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
