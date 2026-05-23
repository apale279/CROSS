import { useImpostazioniField } from '../../hooks/useImpostazioniField';
import { FormField, inputClass } from '../ui/FormField';

export function PmappIntegrationPanel() {
  const enabled = useImpostazioniField('pmappIntegrationEnabled');
  const manifestazioneId = useImpostazioniField('pmappManifestazioneId');

  if (enabled.loading || manifestazioneId.loading) {
    return (
      <section className="rounded border border-slate-300 bg-white p-4 text-sm text-slate-500">
        Caricamento integrazione PMApp…
      </section>
    );
  }

  return (
    <section className="rounded border border-slate-300 bg-white p-4">
      <h3 className="mb-1 text-sm font-bold uppercase text-slate-800">Integrazione PMApp</h3>
      <p className="mb-4 text-xs text-slate-600">
        Quando una missione passa a <strong>DIRETTO H</strong>, CROSS aggiorna su PMApp i campi{' '}
        <code className="rounded bg-slate-100 px-1">invio_ps_*</code> dei pazienti in trasporto
        (stesso progetto Firebase). Collegamento per <strong>pettorale</strong> o{' '}
        <code className="rounded bg-slate-100 px-1">external_app_id</code> ={' '}
        <code className="rounded bg-slate-100 px-1">idUnivoco</code> paziente CROSS.
      </p>

      <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-400"
          checked={enabled.value === true}
          disabled={enabled.saving}
          onChange={(e) => void enabled.saveField(e.target.checked)}
        />
        Integrazione attiva
      </label>

      <FormField label="ID manifestazione PMApp">
        <input
          type="text"
          className={inputClass}
          value={manifestazioneId.value ?? ''}
          disabled={manifestazioneId.saving || enabled.value !== true}
          placeholder="es. MARATONA2026"
          onChange={(e) => manifestazioneId.saveField(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">
          Nome documento manifestazione in PMApp. Se vuoto, usa la variabile{' '}
          <code className="rounded bg-slate-100 px-1">PMAPP_MANIFESTAZIONE_ID</code> su Vercel.
        </p>
      </FormField>
    </section>
  );
}
