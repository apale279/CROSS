import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { btnPrimary, btnSecondary, FormField, inputClass } from '../ui/FormField';
import { createPazientePmaAutopresentato } from '../../services/pmaPazientiService';

export function PmaPatientQuickForm({ manifestationId, pma, allPazienti, onCreated, onCancel }) {
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    nome: '',
    cognome: '',
    pettorale: '',
    telefono: '',
    notePaziente: '',
  });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await createPazientePmaAutopresentato(
        manifestationId,
        pma.id,
        pma.nome,
        {
          nome: draft.nome.trim(),
          cognome: draft.cognome.trim(),
          pettorale:
            draft.pettorale !== '' && draft.pettorale != null
              ? Number(draft.pettorale)
              : null,
          telefono: draft.telefono.trim(),
          notePaziente: draft.notePaziente.trim(),
          apertura: Timestamp.now(),
        },
        allPazienti,
      );
      onCreated?.(result);
    } catch (err) {
      alert(err.message ?? 'Errore creazione paziente');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/30 p-4">
      <p className="text-xs font-bold uppercase text-violet-900">Nuovo paziente autopresentato</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Nome">
          <input
            className={inputClass}
            value={draft.nome}
            onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
          />
        </FormField>
        <FormField label="Cognome">
          <input
            className={inputClass}
            value={draft.cognome}
            onChange={(e) => setDraft((d) => ({ ...d, cognome: e.target.value }))}
          />
        </FormField>
        <FormField label="Pettorale">
          <input
            type="number"
            min={1}
            className={inputClass}
            value={draft.pettorale}
            onChange={(e) => setDraft((d) => ({ ...d, pettorale: e.target.value }))}
          />
        </FormField>
        <FormField label="Telefono">
          <input
            className={inputClass}
            value={draft.telefono}
            onChange={(e) => setDraft((d) => ({ ...d, telefono: e.target.value }))}
          />
        </FormField>
      </div>
      <FormField label="Note">
        <textarea
          className={inputClass}
          rows={2}
          value={draft.notePaziente}
          onChange={(e) => setDraft((d) => ({ ...d, notePaziente: e.target.value }))}
        />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={btnPrimary} disabled={saving}>
          {saving ? 'Salvataggio…' : 'Crea paziente PMA'}
        </button>
        {onCancel && (
          <button type="button" className={btnSecondary} onClick={onCancel}>
            Annulla
          </button>
        )}
      </div>
    </form>
  );
}
