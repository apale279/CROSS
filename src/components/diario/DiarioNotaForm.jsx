import { useEffect, useState } from 'react';
import { FormField, btnPrimary, btnSecondary, inputClass } from '../ui/FormField';

const empty = () => ({ titolo: '', testo: '', importante: false });

export function DiarioNotaForm({ nota, saving, onSave, onCancel }) {
  const [draft, setDraft] = useState(empty);

  useEffect(() => {
    if (nota) {
      setDraft({
        titolo: nota.titolo ?? '',
        testo: nota.testo ?? '',
        importante: nota.importante === true,
      });
    } else {
      setDraft(empty());
    }
  }, [nota]);

  const submit = (e) => {
    e.preventDefault();
    const titolo = draft.titolo.trim();
    if (!titolo) {
      alert('Il titolo nota è obbligatorio.');
      return;
    }
    onSave?.({
      titolo,
      testo: draft.testo.trim(),
      importante: draft.importante,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormField label="Titolo nota">
        <input
          className={inputClass}
          value={draft.titolo}
          onChange={(e) => setDraft((d) => ({ ...d, titolo: e.target.value }))}
          required
          autoFocus
        />
      </FormField>
      <FormField label="Testo nota">
        <textarea
          className={inputClass}
          rows={6}
          value={draft.testo}
          onChange={(e) => setDraft((d) => ({ ...d, testo: e.target.value }))}
        />
      </FormField>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={draft.importante}
          onChange={(e) => setDraft((d) => ({ ...d, importante: e.target.checked }))}
        />
        Nota importante (evidenziata in dashboard)
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={btnPrimary} disabled={saving}>
          {saving ? 'Salvataggio…' : nota ? 'Salva modifiche' : 'Crea nota'}
        </button>
        {onCancel && (
          <button type="button" className={btnSecondary} disabled={saving} onClick={onCancel}>
            Annulla
          </button>
        )}
      </div>
    </form>
  );
}
