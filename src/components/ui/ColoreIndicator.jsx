import { coloreHex } from '../../utils/formatters';

export function ColoreIndicator({ colore, size = 'md' }) {
  const dim = size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  return (
    <span
      className={`inline-block shrink-0 rounded-sm border-2 border-slate-700 shadow ${dim}`}
      style={{ backgroundColor: coloreHex(colore) }}
      title={colore ?? 'Bianco'}
      aria-label={colore ?? 'Bianco'}
    />
  );
}
