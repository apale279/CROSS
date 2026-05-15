import { FormField, inputClass } from '../ui/FormField';

const ROLES = [
  { key: 'autista', label: 'Autista' },
  { key: 'medico', label: 'Medico / CE' },
  { key: 'soccorritore1', label: 'Soccorritore 1' },
  { key: 'soccorritore2', label: 'Soccorritore 2' },
];

export function EquipaggioForm({ equipaggio, onChange, readOnly = false }) {
  const update = (role, field, value) => {
    onChange?.({
      ...equipaggio,
      [role]: { ...equipaggio[role], [field]: value },
    });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {ROLES.map(({ key, label }) => (
        <fieldset
          key={key}
          className="rounded-lg border border-slate-200 bg-white p-3"
        >
          <legend className="px-1 text-sm font-semibold text-slate-800">{label}</legend>
          <div className="mt-2 space-y-2">
            <FormField label="Nome">
              <input
                className={inputClass}
                value={equipaggio?.[key]?.nome ?? ''}
                disabled={readOnly}
                onChange={(e) => update(key, 'nome', e.target.value)}
              />
            </FormField>
            <FormField label="Cognome">
              <input
                className={inputClass}
                value={equipaggio?.[key]?.cognome ?? ''}
                disabled={readOnly}
                onChange={(e) => update(key, 'cognome', e.target.value)}
              />
            </FormField>
            <FormField label="Telefono">
              <input
                className={inputClass}
                value={equipaggio?.[key]?.telefono ?? ''}
                disabled={readOnly}
                onChange={(e) => update(key, 'telefono', e.target.value)}
              />
            </FormField>
          </div>
        </fieldset>
      ))}
    </div>
  );
}
