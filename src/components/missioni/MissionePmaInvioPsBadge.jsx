import { isMissionePmaInvioPs } from '../../lib/pmaInvioPsMission';

/** Badge missione trasporto dimissione PMA → PS (paziente scollegato, solo riferimento). */
export function MissionePmaInvioPsBadge({ missione, className = '' }) {
  if (!isMissionePmaInvioPs(missione)) return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border border-violet-300 bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-violet-900 ${className}`}
      title="Trasporto PMA → Pronto Soccorso (paziente dimesso, solo riferimento sulla missione)"
    >
      PMA→PS
    </span>
  );
}
