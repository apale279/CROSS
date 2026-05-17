import { useMemo } from 'react';
import { GripVertical, Plus } from 'lucide-react';
import { ColoreIndicator } from '../ui/ColoreIndicator';
import { coloreBadgeClass } from '../../utils/formatters';
import { missioniPerEvento } from '../../lib/eventoLinks';
import { eventoOnTacticalBoard } from '../../lib/tacticalBoard';
import { isMissioneAttiva } from '../../lib/mezzoMissione';
import { NuovoEventoRapidoForm } from './NuovoEventoRapidoForm';
import { EventoStatoRapidoButtons } from './EventoStatoRapidoButtons';

export const EVENTO_DRAG_MIME = 'text/x-cross-evento';

function missioniAttivePerEvento(missioni, ev) {
  return missioniPerEvento(missioni, ev)
    .filter(isMissioneAttiva)
    .sort((a, b) =>
      String(a.idMissione ?? '').localeCompare(String(b.idMissione ?? ''), 'it'),
    );
}

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
  onMissioneStato,
  statoSaving,
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
          Trascina sulla piantina per posizionare. I numeri cambiano lo stato missione.
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
          const onBoard = eventoOnTacticalBoard(ev);
          const missioniAttive = missioniAttivePerEvento(missioni, ev);

          return (
            <li key={ev._docId} className="mb-1.5">
              <div
                className={`rounded-lg border px-2 py-2 transition ${
                  selected
                    ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-400'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-1">
                  {!onBoard && (
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(EVENTO_DRAG_MIME, ev._docId);
                        e.dataTransfer.setData('text/plain', ev._docId);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      className="mt-0.5 cursor-grab rounded p-0.5 text-slate-400 hover:bg-slate-100 active:cursor-grabbing"
                      title="Trascina sulla piantina"
                    >
                      <GripVertical className="h-4 w-4" aria-hidden />
                    </div>
                  )}
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left text-sm"
                    onClick={() => onSelectEvento?.(ev)}
                    onDoubleClick={() => onOpenEventoScheda?.(ev)}
                  >
                    <span className="flex items-center gap-2">
                      <ColoreIndicator colore={ev.colore} size="sm" />
                      <span className="font-mono font-bold text-slate-900">{ev.idEvento}</span>
                      {onBoard && (
                        <span className="rounded bg-violet-100 px-1 py-0.5 text-[8px] font-bold uppercase text-violet-800">
                          Mappa
                        </span>
                      )}
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
                </div>
                <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                  {missioniAttive.length === 0 ? (
                    <p className="text-[9px] italic text-slate-400">Nessuna missione attiva</p>
                  ) : (
                    missioniAttive.map((mis) => (
                      <div
                        key={mis._docId}
                        className="rounded border border-violet-100 bg-violet-50/40 px-1.5 py-1"
                      >
                        <p className="font-mono text-[10px] font-semibold text-violet-800">
                          {mis.idMissione} · {mis.mezzo}
                          <span className="ml-1 font-normal text-violet-600">({mis.stato})</span>
                        </p>
                        <EventoStatoRapidoButtons
                          missione={mis}
                          disabled={statoSaving}
                          onStato={(stato) => onMissioneStato?.(ev, mis, stato)}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
