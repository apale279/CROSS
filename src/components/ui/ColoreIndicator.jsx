import { coloreHex } from '../../utils/formatters';

export function ColoreIndicator({ colore, size = 'md' }) {
  const dim =
    size === 'lg'
      ? 'h-6 w-6'
      : size === 'sm'
        ? 'h-3.5 w-3.5 border'
        : size === 'xs'
          ? 'h-3 w-3 border'
          : 'h-5 w-5';
  const impostato = colore != null && String(colore).trim() !== '';
  if (!impostato) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-sm border-2 border-dashed border-slate-300 bg-slate-100 text-[9px] font-bold text-slate-400 ${dim}`}
        title="Non impostato"
        aria-label="Non impostato"
      >
        —
      </span>
    );
  }
  return (
    <span
      className={`inline-block shrink-0 rounded-sm border-2 border-slate-700 shadow ${dim}`}
      style={{ backgroundColor: coloreHex(colore) }}
      title={colore}
      aria-label={colore}
    />
  );
}
