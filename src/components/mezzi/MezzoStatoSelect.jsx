import { useMemo } from 'react';
import {
  MEZZO_STATO_DISPONIBILE,
  mezzoStatoSelectOptions,
} from '../../lib/mezzoStati';
import { selectClass } from '../ui/FormField';

export function MezzoStatoSelect({ value, onChange, disabled, saving, className = '' }) {
  const options = useMemo(() => mezzoStatoSelectOptions(value), [value]);

  return (
    <select
      className={`${selectClass} ${className}`.trim()}
      value={value ?? MEZZO_STATO_DISPONIBILE}
      onChange={onChange}
      disabled={disabled || saving}
      aria-busy={saving || undefined}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
