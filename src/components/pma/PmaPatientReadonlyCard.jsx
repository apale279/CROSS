import { isPazienteOriginePma, statoPzPmaLabel } from '../../lib/pmaModule';
import { formatMissioneMezzoLabel } from '../../lib/missioneDisplay';
import { pmaCodiceColoreCardClass } from '../../lib/pmaCodiceColoreUi';
import { PmaDeskPatientSummary, startPmaPatientDrag } from './PmaDeskPatientSummary';

/** Card compatta sidebar PMA (in arrivo / in attesa). */
export function PmaPatientReadonlyCard({
  paziente,
  evento = null,
  missione = null,
  showDirettoHArrow = false,
  highlight,
  footer,
  draggable = false,
  onDragStart,
  dropTarget = false,
  showStatoBadge = true,
  showAvanzamento = true,
}) {
  const isAutopresentato = isPazienteOriginePma(paziente);
  const statoPma = statoPzPmaLabel(paziente.statoPzPma) ?? '—';
  const drag = onDragStart ?? startPmaPatientDrag;
  const coloreClass = pmaCodiceColoreCardClass(paziente);

  return (
    <article
      className={`pma-patient-card rounded-lg border-2 bg-white p-2 shadow-sm ${
        highlight ? 'border-sky-400 ring-2 ring-sky-200' : coloreClass
      } ${dropTarget ? 'border-dashed' : ''}`}
    >
      {showStatoBadge ? (
        <div className="mb-1">
          <span className="pma-patient-card__badge rounded bg-sky-100 px-1.5 py-0.5 font-bold uppercase text-sky-900">
            {statoPma}
          </span>
        </div>
      ) : null}
      <PmaDeskPatientSummary
        paziente={paziente}
        evento={evento}
        missione={missione}
        showDirettoHArrow={showDirettoHArrow}
        showAvanzamento={showAvanzamento}
        draggable={draggable}
        onDragStart={drag}
      />
      {!isAutopresentato && (paziente.idMissione || paziente.mezzo) ? (
        <p className="pma-patient-card__meta mt-1 truncate text-slate-500">
          {formatMissioneMezzoLabel(paziente.idMissione, paziente.mezzo)}
        </p>
      ) : null}
      {footer}
    </article>
  );
}
