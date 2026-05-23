import { useState } from 'react';
import { useImpostazioniField } from '../../hooks/useImpostazioniField';
import { AddressPicker } from '../maps/AddressPicker';
import { LuogoFisicoField } from '../maps/LuogoFisicoField';
import { FormField, btnPrimary, btnSecondary, inputClass } from '../ui/FormField';

/** Modifica posizione PMA dalla mappa operativa. */
export function PmaMapModal({ pma, onClose }) {
  const { value: list, saveField, saving } = useImpostazioniField('pma');
  const [draft, setDraft] = useState({ ...pma });

  const save = async () => {
    const nome = draft.nome?.trim();
    if (!nome) {
      alert('Il nome PMA è obbligatorio.');
      return;
    }
    const items = list ?? [];
    const next = items.map((p) => (p.id === draft.id ? { ...draft, nome } : p));
    try {
      await saveField(next);
      onClose();
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Imposta indirizzo o coordinate GPS del PMA (come stazionamento mezzo).
      </p>
      <FormField label="Nome">
        <input
          className={inputClass}
          value={draft.nome ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
        />
      </FormField>
      <LuogoFisicoField
        value={draft.luogo_fisico}
        onChange={(luogo_fisico) => setDraft((d) => ({ ...d, luogo_fisico }))}
      />
      <AddressPicker
        indirizzo={draft.indirizzo}
        coordinate={draft.coordinate}
        onCommit={({ indirizzo, coordinate }) =>
          setDraft((d) => ({ ...d, indirizzo, coordinate }))
        }
      />
      <div className="flex gap-2">
        <button type="button" className={btnPrimary} disabled={saving} onClick={() => void save()}>
          {saving ? 'Salvataggio…' : 'Salva posizione'}
        </button>
        <button type="button" className={btnSecondary} disabled={saving} onClick={onClose}>
          Chiudi
        </button>
      </div>
    </div>
  );
}
