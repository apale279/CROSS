import { btnSecondary } from '../ui/FormField';

export function PmaRendiCodiceMinoreButton({ disabled, busy, onClick, className = '' }) {
  return (
    <button
      type="button"
      className={`${btnSecondary} w-full text-xs ${className}`}
      disabled={disabled || busy}
      onClick={onClick}
    >
      {busy ? '…' : 'Rendi codice minore'}
    </button>
  );
}
