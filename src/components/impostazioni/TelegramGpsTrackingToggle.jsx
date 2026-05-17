import { useState } from 'react';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { saveImpostazioniField } from '../../services/impostazioniService';

export function TelegramGpsTrackingToggle() {
  const manifestationId = useManifestazioneId();
  const { impostazioni, loading } = useImpostazioni();
  const [saving, setSaving] = useState(false);

  const enabled = impostazioni?.telegramGpsTrackingEnabled !== false;

  const toggle = async () => {
    setSaving(true);
    try {
      await saveImpostazioniField(manifestationId, 'telegramGpsTrackingEnabled', !enabled);
    } catch (err) {
      console.error(err);
      alert('Errore salvataggio tracking GPS: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">TRACKING GPS</h3>
      <p className="mt-1 max-w-xl text-sm text-slate-600">
        {enabled
          ? 'Attivo: l’equipaggio può inviare la posizione da Telegram; in missione i mezzi esterni compaiono sulla mappa operativa con la posizione reale.'
          : 'Spento: la posizione reale non viene aggiornata; i mezzi restano sulla mappa secondo l’indirizzo di stazionamento.'}
      </p>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={loading || saving}
        className={`mt-4 rounded-lg border-2 px-4 py-2 text-sm font-bold uppercase tracking-wide disabled:opacity-50 ${
          enabled
            ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
            : 'border-slate-400 bg-slate-100 text-slate-700'
        }`}
      >
        {saving ? 'Salvataggio…' : enabled ? 'ON' : 'OFF'}
      </button>
    </section>
  );
}
