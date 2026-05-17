import { FormField, inputClass } from '../ui/FormField';

/** Testo libero per strutture chiuse (settore, tribuna, …). */
export function LuogoFisicoField({ value, onChange, className = '' }) {
  return (
    <FormField label="Luogo fisico" className={className}>
      <p className="mb-1.5 text-xs text-slate-500">
        Per strutture chiuse: settore, tribuna, padiglione… (opzionale se usi l&apos;indirizzo stradale)
      </p>
      <input
        type="text"
        className={inputClass}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder='es. "SETTORE C", "TRIBUNA OVEST"'
      />
    </FormField>
  );
}
