import { PmaDeskPatientSummary, startPmaPatientDrag } from './PmaDeskPatientSummary';

import { PmaPatientCardEmojiAction } from './PmaPatientCardEmojiAction';

import { PMA_PATIENT_CARD_ACTION } from '../../lib/pmaPatientCardActions';

import { pmaCodiceColoreCardClass } from '../../lib/pmaCodiceColoreUi';



/** Card compatta trascinabile per griglia posti letto PMA. */

export function PmaInCaricoBedCard({ paziente, evento, onOpen, onDragStart, compact = false }) {

  const drag = onDragStart ?? startPmaPatientDrag;

  const coloreClass = pmaCodiceColoreCardClass(paziente);



  return (

    <article

      className={`pma-patient-card ${

        compact ? 'pma-patient-card--compact' : 'pma-patient-card--bed'

      } rounded-md border-2 bg-white p-1 text-left shadow-sm ${coloreClass}`}

    >

      <div className="min-w-0">
        <PmaDeskPatientSummary
          paziente={paziente}
          evento={evento}
          draggable
          onDragStart={drag}
          pettoraleHero={!compact}
          cardTrailing={
            <PmaPatientCardEmojiAction
              {...PMA_PATIENT_CARD_ACTION.CARTELLA_CLINICA}
              onClick={(e) => {
                e.stopPropagation();
                onOpen?.();
              }}
            />
          }
        />
      </div>

    </article>

  );

}


