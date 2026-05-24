import { Search } from 'lucide-react';
import { etaDaDataNascita } from '../../lib/excelPartecipanti';
import { FormField, inputClass, selectClass } from '../ui/FormField';

/**
 * Blocco anagrafica condiviso (scheda paziente centrale e form autopresentato PMA).
 * Fino al campo Note incluso.
 */
export function PazienteAnagraficaFields({
  draft,
  onChange,
  onBlurField,
  onSearchPettorale,
  registryAvailable = true,
  readOnly = false,
}) {
  const touch = (key, value) => onChange?.(key, value);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField label="Pettorale">
        <div className="flex gap-1">
          <input
            type="number"
            min={1}
            className={`${inputClass} flex-1`}
            value={draft.pettorale ?? ''}
            placeholder="Nr."
            disabled={readOnly}
            onChange={(e) => touch('pettorale', e.target.value)}
            onBlur={() => onBlurField?.('pettorale')}
          />
          {onSearchPettorale && (
            <button
              type="button"
              title="Compila dall’Excel partecipanti (Impostazioni)"
              className="inline-flex shrink-0 items-center justify-center rounded border border-teal-300 bg-white px-2 text-teal-800 hover:bg-teal-50 disabled:opacity-40"
              disabled={
                readOnly ||
                !registryAvailable ||
                !draft.pettorale ||
                String(draft.pettorale).trim() === ''
              }
              onClick={() => void onSearchPettorale()}
            >
              <Search className="h-4 w-4" aria-hidden />
              <span className="sr-only">Cerca nel registro pettorali</span>
            </button>
          )}
        </div>
      </FormField>
      <FormField label="Nome">
        <input
          className={inputClass}
          value={draft.nome ?? ''}
          disabled={readOnly}
          onChange={(e) => touch('nome', e.target.value)}
          onBlur={() => onBlurField?.('nome')}
        />
      </FormField>
      <FormField label="Cognome">
        <input
          className={inputClass}
          value={draft.cognome ?? ''}
          disabled={readOnly}
          onChange={(e) => touch('cognome', e.target.value)}
          onBlur={() => onBlurField?.('cognome')}
        />
      </FormField>
      <FormField label="Data di nascita">
        <input
          type="date"
          className={inputClass}
          value={draft.dataNascita ? String(draft.dataNascita).slice(0, 10) : ''}
          disabled={readOnly}
          onChange={(e) => {
            const dataNascita = e.target.value;
            const nuovaEta =
              dataNascita && dataNascita.length >= 10 ? etaDaDataNascita(dataNascita) : null;
            onChange?.('dataNascita', dataNascita);
            if (nuovaEta != null) onChange?.('eta', String(nuovaEta));
          }}
          onBlur={() => onBlurField?.('dataNascita')}
        />
      </FormField>
      <FormField label="Telefono">
        <input
          type="tel"
          className={inputClass}
          value={draft.telefono ?? ''}
          disabled={readOnly}
          onChange={(e) => touch('telefono', e.target.value)}
          onBlur={() => onBlurField?.('telefono')}
        />
      </FormField>
      <FormField label="Età">
        <input
          type="number"
          className={inputClass}
          value={draft.eta ?? ''}
          disabled={readOnly}
          onChange={(e) => touch('eta', e.target.value)}
          onBlur={() => onBlurField?.('eta')}
        />
      </FormField>
      <FormField label="Sesso">
        <select
          className={selectClass}
          value={draft.sesso ?? ''}
          disabled={readOnly}
          onChange={(e) => {
            touch('sesso', e.target.value);
            onBlurField?.('sesso');
          }}
        >
          <option value="">—</option>
          <option value="M">M</option>
          <option value="F">F</option>
          <option value="Altro">Altro</option>
        </select>
      </FormField>
      <FormField label="Note" className="sm:col-span-2">
        <textarea
          className={inputClass}
          rows={2}
          value={draft.notePaziente ?? ''}
          disabled={readOnly}
          onChange={(e) => touch('notePaziente', e.target.value)}
          onBlur={() => onBlurField?.('notePaziente')}
        />
      </FormField>
    </div>
  );
}
