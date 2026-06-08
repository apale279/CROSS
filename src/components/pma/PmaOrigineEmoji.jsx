import { isPazienteAutopresentatoPma } from '../../lib/pmaDeskPatientInfo';

const ORIGINE_PAZIENTE_PMA = {
  autopresentato: {
    emoji: '⛺',
    title: 'Autopresentato al PMA',
  },
  centrale: {
    emoji: '🚑',
    title: 'Inviato dalla centrale',
  },
};

/** Emoji origine paziente (dashboard PMA): autopresentato o da centrale, con tooltip al passaggio mouse. */
export function PmaOrigineEmoji({ paziente, className = '' }) {
  const origine = isPazienteAutopresentatoPma(paziente)
    ? ORIGINE_PAZIENTE_PMA.autopresentato
    : ORIGINE_PAZIENTE_PMA.centrale;

  return (
    <span
      className={`pma-patient-card__origin inline-flex shrink-0 ${className}`.trim()}
      title={origine.title}
      aria-label={origine.title}
      role="img"
    >
      {origine.emoji}
    </span>
  );
}
