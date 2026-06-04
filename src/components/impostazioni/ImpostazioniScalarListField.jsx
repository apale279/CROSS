import { useState } from 'react';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { useImpostazioniField } from '../../hooks/useImpostazioniField';
import { saveImpostazioniField } from '../../services/impostazioniService';
import { ListEditor } from './ListEditor';

/**
 * Array di stringhe in impostazioni: un valore per riga (come Dettaglio — tipo evento).
 * Salva solo il campo indicato.
 */
export function ImpostazioniScalarListField({ fieldKey, label, rows = 6 }) {
  const manifestationId = useManifestazioneId();
  const { value, saving, loading } = useImpostazioniField(fieldKey);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <section className="rounded border border-slate-300 bg-white p-4 text-sm text-slate-500">
        Caricamento {label}…
      </section>
    );
  }

  return (
    <ListEditor
      label={label}
      fieldKey={fieldKey}
      items={value ?? []}
      saving={saving || busy}
      onSave={async (partial) => {
        setBusy(true);
        try {
          await saveImpostazioniField(manifestationId, fieldKey, partial[fieldKey]);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
