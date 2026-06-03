import { useState } from 'react';
import { X } from 'lucide-react';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { useImpostazioniField } from '../../hooks/useImpostazioniField';
import {
  appendImpostazioniScalarArrayItem,
  removeImpostazioniScalarArrayItem,
} from '../../services/impostazioniService';
import { btnPrimary, btnSecondary, inputClass } from '../ui/FormField';
import { SaveFeedback } from './SaveFeedback';

/**
 * Array scalare in impostazioni (solo la chiave indicata viene aggiornata in transazione).
 */
export function ScalarArrayChipsEditor({ fieldKey, title, placeholder = 'Nuova voce…' }) {
  const manifestationId = useManifestazioneId();
  const { value: list, saving, loading } = useImpostazioniField(fieldKey);
  const items = list ?? [];
  const [nuovo, setNuovo] = useState('');
  const [feedback, setFeedback] = useState('');

  const addItem = async (e) => {
    e?.preventDefault();
    const nome = nuovo.trim();
    if (!nome) return;
    if (items.some((t) => String(t).toLowerCase() === nome.toLowerCase())) {
      alert('Voce già presente.');
      return;
    }
    setFeedback('');
    try {
      await appendImpostazioniScalarArrayItem(manifestationId, fieldKey, nome);
      setFeedback('Voce aggiunta.');
      setNuovo('');
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Rimuovere «${item}»?`)) return;
    try {
      await removeImpostazioniScalarArrayItem(manifestationId, fieldKey, item);
      setFeedback('Voce rimossa.');
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  };

  if (loading) {
    return (
      <section className="rounded border border-slate-300 bg-white p-4 text-sm text-slate-500">
        Caricamento {title}…
      </section>
    );
  }

  return (
    <section className="rounded border border-slate-300 bg-white p-4">
      <h3 className="mb-3 text-sm font-bold uppercase text-slate-800">{title}</h3>
      <form onSubmit={addItem} className="mb-3 flex flex-wrap gap-2">
        <input
          className={`${inputClass} min-w-[160px] flex-1`}
          value={nuovo}
          onChange={(e) => setNuovo(e.target.value)}
          placeholder={placeholder}
          disabled={saving}
        />
        <button type="submit" className={btnPrimary} disabled={saving || !nuovo.trim()}>
          Aggiungi
        </button>
      </form>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Nessuna voce definita.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-sm font-medium text-slate-800"
            >
              {item}
              <button
                type="button"
                className="rounded p-0.5 text-slate-500 hover:bg-red-100 hover:text-red-700"
                title="Rimuovi"
                disabled={saving}
                onClick={() => void remove(item)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <SaveFeedback message={feedback} />
    </section>
  );
}
