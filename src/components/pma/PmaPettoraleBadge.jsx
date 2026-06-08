/** Badge pettorale (stile compatto come «Centrale» / «Auto» sul desk PMA). */
export function PmaPettoraleBadge({ pettorale, className = '' }) {
  if (pettorale == null || String(pettorale).trim() === '') return null;
  return (
    <span
      className={`rounded bg-indigo-100 px-1.5 py-0.5 font-bold uppercase text-indigo-950 ${className || 'text-[10px]'}`}
    >
      PETT: {pettorale}
    </span>
  );
}
