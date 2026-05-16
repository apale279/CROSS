import { User } from 'lucide-react';
import { useElapsedSince } from '../../hooks/useElapsedSince';
import { PanelAlertIcon } from '../ui/PanelAlertIcon';
import { ColoreIndicator } from '../ui/ColoreIndicator';
import { coloreRowBgSoft, statoMissioneBadgeClass } from '../../utils/formatters';

/** Stessi font/padding del pannello «Stato mezzi» in DashboardPage. */
const thClass =
  'sticky top-0 z-10 bg-slate-100/95 px-3 py-2 text-left text-xs font-bold uppercase text-slate-600 backdrop-blur';
const tdClass = 'border-t border-slate-200/80 px-3 py-2 text-sm text-slate-900';

function MissioneStatoCell({ mis, onAdvance }) {
  const elapsed = useElapsedSince(mis.statoDa ?? mis.apertura);
  return (
    <td className={`${tdClass} text-right`}>
      <div className="flex items-center justify-end gap-1 whitespace-nowrap">
        <span className="font-mono text-[10px] tabular-nums text-slate-500">{elapsed}</span>
        <button
          type="button"
          onClick={(e) => onAdvance(e, mis)}
          className={`cursor-pointer rounded border px-2 py-0.5 text-xs font-bold uppercase hover:opacity-80 ${statoMissioneBadgeClass(mis.stato)}`}
          title="Clic per stato successivo"
        >
          {mis.stato}
        </button>
      </div>
    </td>
  );
}

function EventoCells({ ev, rowSpan, orfano, pazientiCount, multiMission, onOpenEvento }) {
  const open = (e) => {
    e.stopPropagation();
    if (ev) onOpenEvento(ev);
  };
  const evBorder = multiMission ? 'border-r border-r-violet-200/60' : 'border-r-2 border-slate-200';
  const evTd = `cursor-pointer hover:brightness-95 ${tdClass} ${evBorder} align-top`;

  return (
    <>
      <td rowSpan={rowSpan} className={`${evTd} font-mono font-bold`} onClick={open}>
        {ev ? (
          <span className="inline-flex max-w-full items-center gap-0.5">
            {orfano && (
              <PanelAlertIcon
                variant="amber"
                title="Evento senza copertura (nessuna missione attiva)"
                className="[&_svg]:h-4 [&_svg]:w-4"
              />
            )}
            <span>{ev.idEvento}</span>
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td rowSpan={rowSpan} className={evTd} onClick={open}>
        <span className="line-clamp-2 max-w-[100px]">{ev?.tipoEvento ?? '—'}</span>
      </td>
      <td
        rowSpan={rowSpan}
        className={`${evTd} max-w-[120px]`}
        title={ev?.indirizzo}
        onClick={open}
      >
        <span className="line-clamp-2">{ev?.indirizzo || '—'}</span>
      </td>
      <td rowSpan={rowSpan} className={`${evTd} text-center`} onClick={open}>
        {ev ? (
          <span
            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-800"
            title={`${pazientiCount} pazienti`}
          >
            <User className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden />
            <span className="font-mono text-xs font-bold tabular-nums">{pazientiCount}</span>
          </span>
        ) : (
          '—'
        )}
      </td>
      <td
        rowSpan={rowSpan}
        className={`${evTd} border-r-2 border-slate-300 text-center ${multiMission ? 'border-r-violet-200/70' : ''}`}
        onClick={open}
      >
        {ev ? <ColoreIndicator colore={ev.colore} size="lg" /> : '—'}
      </td>
    </>
  );
}

export function EventiMissioniTable({
  loading,
  blocks,
  pazientiCountByEvento,
  onOpenEvento,
  onOpenMissione,
  onAdvanceStato,
}) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className={thClass}>ID</th>
          <th className={thClass}>Tipo</th>
          <th className={`${thClass} max-w-[120px]`}>Indirizzo</th>
          <th className={`${thClass} w-10 text-center`}>Pz</th>
          <th className={`${thClass} w-8 border-r-2 border-slate-300 text-center`}>Col</th>
          <th className={`${thClass} border-l-2 border-slate-300 bg-slate-50/90`}>Missione</th>
          <th className={`${thClass} bg-slate-50/90`}>Mezzo</th>
          <th className={`${thClass} bg-slate-50/90 text-right`}>Stato</th>
        </tr>
      </thead>
      <tbody>
        {loading && (
          <tr>
            <td colSpan={8} className={tdClass} />
          </tr>
        )}
        {!loading &&
          blocks.flatMap((block) => {
            const { ev, missions, orfano } = block;
            const multiMission = missions.length > 1;
            const blockBorder = multiMission
              ? 'border-l-2 border-l-violet-500/70'
              : '';
            const pz = ev ? (pazientiCountByEvento.get(ev._docId) ?? 0) : 0;

            if (!missions.length && ev) {
              return (
                <tr
                  key={block.key}
                  className={`cursor-pointer hover:brightness-95 ${
                    orfano ? 'bg-amber-50 ring-1 ring-inset ring-amber-300' : ''
                  }`}
                >
                  <EventoCells
                    ev={ev}
                    rowSpan={1}
                    orfano={orfano}
                    pazientiCount={pz}
                    multiMission={false}
                    onOpenEvento={onOpenEvento}
                  />
                  <td
                    colSpan={3}
                    className={`${tdClass} border-l-2 border-slate-300 bg-slate-50/50 text-center text-sm italic text-slate-500`}
                  >
                    Nessuna missione aperta
                  </td>
                </tr>
              );
            }

            return missions.map((mis, idx) => {
              const colore = mis.codiceColore ?? ev?.colore ?? 'Bianco';
              const daAllertare = mis.stato === 'ALLERTARE';
              return (
                <tr
                  key={mis._docId}
                  onClick={() => onOpenMissione(mis)}
                  className={`cursor-pointer hover:brightness-95 ${coloreRowBgSoft(colore)} ${
                    daAllertare ? 'ring-1 ring-inset ring-red-400' : ''
                  } ${orfano && idx === 0 ? 'bg-amber-50/40' : ''} ${blockBorder}`}
                >
                  {idx === 0 && (
                    <EventoCells
                      ev={ev}
                      rowSpan={missions.length}
                      orfano={orfano}
                      pazientiCount={pz}
                      multiMission={multiMission}
                      onOpenEvento={onOpenEvento}
                    />
                  )}
                  <td className={`${tdClass} border-l-2 border-slate-300 font-mono font-bold`}>
                    <span className="inline-flex items-center gap-1.5">
                      {daAllertare && (
                        <PanelAlertIcon
                          variant="red"
                          title="Missione da allertare"
                          className="[&_svg]:h-4 [&_svg]:w-4"
                        />
                      )}
                      {mis.idMissione}
                    </span>
                  </td>
                  <td className={`${tdClass} font-mono`}>{mis.mezzo}</td>
                  <MissioneStatoCell mis={mis} onAdvance={onAdvanceStato} />
                </tr>
              );
            });
          })}
      </tbody>
    </table>
  );
}
