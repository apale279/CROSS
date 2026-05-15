import { useEffect, useState } from 'react';
import { FormField, btnPrimary, inputClass } from '../ui/FormField';
import { SaveFeedback } from './SaveFeedback';

export function ListEditor({ label, fieldKey, items, onSave, saving }) {
  const [text, setText] = useState((items ?? []).join('\n'));
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!dirty) {
      setText((items ?? []).join('\n'));
    }
  }, [items, dirty]);

  const handleSave = async () => {
    setFeedback('');
    const list = text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await onSave({ [fieldKey]: list });
      setDirty(false);
      setFeedback(`«${label}» salvato.`);
    } catch (err) {
      console.error(err);
      alert('Errore salvataggio: ' + err.message);
    }
  };

  return (
    <section className="rounded border border-slate-300 bg-white p-4">
      <h3 className="mb-3 text-sm font-bold uppercase text-slate-800">{label}</h3>
      <FormField label="Un valore per riga">
        <textarea
          className={inputClass}
          rows={6}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDirty(true);
          }}
        />
      </FormField>
      <div className="mt-2 space-y-2">
        <button
          type="button"
          className={btnPrimary}
          disabled={!dirty || saving}
          onClick={handleSave}
        >
          {saving ? 'Salvataggio…' : 'Salva'}
        </button>
        <SaveFeedback message={feedback} onClear={() => setFeedback('')} />
      </div>
    </section>
  );
}
