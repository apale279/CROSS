import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { useImpostazioniField } from '../../hooks/useImpostazioniField';
import { saveImpostazioniField } from '../../services/impostazioniService';
import { FormField, inputClass } from '../ui/FormField';
import { ImpostazioniScalarListField } from './ImpostazioniScalarListField';
import { SaveFeedback } from './SaveFeedback';
import { useState } from 'react';

/** Sotto-tab MSB/MSA: liste testo (una riga = un valore) + VAS max. */
export function ValutazioniMsbMsaImpostazioniEditor() {
  const manifestationId = useManifestazioneId();
  const { value: vasMax, saving, loading } = useImpostazioniField('lesioniVasMax');
  const [feedback, setFeedback] = useState('');

  const persistVasMax = async (raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const v = Math.max(1, Math.min(10, Math.floor(n)));
    setFeedback('');
    try {
      await saveImpostazioniField(manifestationId, 'lesioniVasMax', v);
      setFeedback('VAS massimo aggiornato.');
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="rounded border border-slate-300 bg-white p-4">
        <h3 className="text-sm font-bold uppercase text-slate-800">Lesioni (MSB / MSA)</h3>
        <p className="mt-1 text-xs text-slate-500">
          Un valore per riga; l&apos;ordine delle righe è l&apos;ordine in scheda.
        </p>
      </div>
      <ImpostazioniScalarListField
        fieldKey="lesioniLocalizzazioni"
        label="Localizzazioni lesioni"
      />
      <ImpostazioniScalarListField fieldKey="lesioniTipologie" label="Tipologie lesioni" />
      <section className="rounded border border-slate-300 bg-white p-4">
        <h3 className="mb-3 text-sm font-bold uppercase text-slate-800">Scala VAS</h3>
        <p className="mb-2 text-xs text-slate-600">
          Valore massimo selezionabile in scheda (intero da 1 a 10).
        </p>
        {loading ? (
          <p className="text-sm text-slate-500">Caricamento…</p>
        ) : (
          <FormField label="VAS massimo (0 – N)">
            <input
              type="number"
              min={1}
              max={10}
              className={`${inputClass} max-w-[8rem]`}
              defaultValue={vasMax ?? 10}
              disabled={saving}
              onBlur={(e) => void persistVasMax(e.target.value)}
            />
          </FormField>
        )}
        <SaveFeedback message={feedback} />
      </section>

      <div className="rounded border border-slate-300 bg-white p-4">
        <h3 className="text-sm font-bold uppercase text-slate-800">Presidi e prestazioni</h3>
        <p className="mt-1 text-xs text-slate-500">
          Cataloghi per multiselect in valutazione MSB e MSA (solo nomi, un valore per riga).
        </p>
      </div>
      <ImpostazioniScalarListField fieldKey="msbMsaPresidi" label="Presidi (MSB e MSA)" />
      <ImpostazioniScalarListField fieldKey="prestazioniMsb" label="Prestazioni MSB" />
      <ImpostazioniScalarListField fieldKey="prestazioniMsa" label="Prestazioni MSA" />
    </div>
  );
}
