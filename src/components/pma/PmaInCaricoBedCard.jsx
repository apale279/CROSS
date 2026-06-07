import { PmaDeskPatientSummary, startPmaPatientDrag } from './PmaDeskPatientSummary';
import { btnSecondary } from '../ui/FormField';
import { pmaCodiceColoreCardClass } from '../../lib/pmaCodiceColoreUi';

/** Card compatta trascinabile per griglia posti letto PMA. */
export function PmaInCaricoBedCard({ paziente, evento, onOpen, onDragStart }) {
  const drag = onDragStart ?? startPmaPatientDrag;
  const coloreClass = pmaCodiceColoreCardClass(paziente);

  return (
    <article
      className={`flex flex-col gap-1.5 rounded-md border-2 bg-white p-1.5 text-left shadow-sm ${coloreClass}`}
    >
      <PmaDeskPatientSummary
        paziente={paziente}
        evento={evento}
        draggable
        onDragStart={drag}
      />
      <button
        type="button"
        className={`${btnSecondary} w-full py-1 text-[10px] font-bold leading-tight`}
        onClick={(e) => {
          e.stopPropagation();
          onOpen?.();
        }}
      >
        Cartella clinica
      </button>
    </article>
  );
}
