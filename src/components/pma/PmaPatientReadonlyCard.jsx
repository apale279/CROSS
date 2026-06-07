import { isPazienteOriginePma, statoPzPmaLabel } from '../../lib/pmaModule';
import { formatMissioneMezzoLabel } from '../../lib/missioneDisplay';
import { pmaCodiceColoreCardClass } from '../../lib/pmaCodiceColoreUi';
import { PmaDeskPatientSummary, startPmaPatientDrag } from './PmaDeskPatientSummary';

/** Card compatta sidebar PMA (in arrivo / in attesa). */
export function PmaPatientReadonlyCard({
  paziente,
  evento = null,
  showDirettoHArrow = false,
  highlight,
  footer,
  draggable = false,
  onDragStart,
  dragHint = false,
  dropTarget = false,
}) {
  const isAutopresentato = isPazienteOriginePma(paziente);
  const statoPma = statoPzPmaLabel(paziente.statoPzPma) ?? '—';
  const drag = onDragStart ?? startPmaPatientDrag;
  const coloreClass = pmaCodiceColoreCardClass(paziente);

  return (
    <article
      className={`rounded-lg border-2 bg-white p-2 text-sm shadow-sm ${
        highlight ? 'border-sky-400 ring-2 ring-sky-200' : coloreClass
      } ${dropTarget ? 'border-dashed' : ''}`}
    >
      <div className="mb-1 flex flex-wrap items-center gap-1">
        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-900">
          {statoPma}
        </span>
        {dragHint ? (
          <span className="text-[9px] font-medium text-violet-700">Trascina su un letto → in carico</span>
        ) : null}
      </div>
      <PmaDeskPatientSummary
        paziente={paziente}
        evento={evento}
        showDirettoHArrow={showDirettoHArrow}
        draggable={draggable}
        onDragStart={drag}
      />
      {!isAutopresentato && (paziente.idMissione || paziente.mezzo) ? (
        <p className="mt-1 truncate text-[10px] text-slate-500">
          {formatMissioneMezzoLabel(paziente.idMissione, paziente.mezzo)}
        </p>
      ) : null}
      {footer}
    </article>
  );
}
