import { useImpostazioniField } from '../../hooks/useImpostazioniField';
import { ListEditor } from './ListEditor';

export function ListEditorField({ fieldKey, label }) {
  const { value, saveField, saving, loading } = useImpostazioniField(fieldKey);

  if (loading) {
    return (
      <section className="rounded border border-slate-300 bg-white p-4 text-sm text-slate-500">
        Caricamento «{label}»…
      </section>
    );
  }

  return (
    <ListEditor
      label={label}
      fieldKey={fieldKey}
      items={value ?? []}
      onSave={async (partial) => {
        const next = partial[fieldKey];
        await saveField(next);
      }}
      saving={saving}
    />
  );
}
