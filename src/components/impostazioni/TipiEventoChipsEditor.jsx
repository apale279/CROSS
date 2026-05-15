import { useState } from 'react';
import { X } from 'lucide-react';
import { useImpostazioniField } from '../../hooks/useImpostazioniField';
import { btnPrimary, btnSecondary, inputClass } from '../ui/FormField';
import { SaveFeedback } from './SaveFeedback';

export function TipiEventoChipsEditor() {
  const { value: tipi, saveField, saving, loading } = useImpostazioniField('tipiEvento');
  const list = tipi ?? [];
  const [nuovo, setNuovo] = useState('');
  const [feedback, setFeedback] = useState('');

  const persist = async (next, message) => {
    setFeedback('');
    try {
      await saveField(next);
      if (message) setFeedback(message);
    } catch (err) {
      alert('Errore: ' + err.message);
      throw err;
    }
  };

  const addTipo = async (e) => {
    e?.preventDefault();
    const nome = nuovo.trim();
    if (!nome) return;
    if (list.some((t) => t.toLowerCase() === nome.toLowerCase())) {
      alert('Tipo evento già presente.');
      return;
    }
    await persist([...list, nome], 'Tipo evento aggiunto.');
    setNuovo('');
  };

  const remove = async (tipo) => {
    if (!window.confirm(`Rimuovere il tipo «${tipo}»?`)) return;
    await persist(
      list.filter((t) => t !== tipo),
      'Tipo evento rimosso.',
    );
  };

  if (loading) {
    return (
      <section className="rounded border border-slate-300 bg-white p-4 text-sm text-slate-500">
        Caricamento tipi evento…
      </section>
    );
  }

  return (
    <section className="rounded border border-slate-300 bg-white p-4">
      <h3 className="mb-3 text-sm font-bold uppercase text-slate-800">Tipo evento</h3>
      <form onSubmit={addTipo} className="mb-3 flex flex-wrap gap-2">
        <input
          className={`${inputClass} min-w-[160px] flex-1`}
          value={nuovo}
          onChange={(e) => setNuovo(e.target.value)}
          placeholder="Nuovo tipo…"
          disabled={saving}
        />
        <button type="submit" className={btnPrimary} disabled={saving || !nuovo.trim()}>
          Aggiungi
        </button>
      </form>
      {list.length === 0 ? (
        <p className="text-sm text-slate-500">Nessun tipo definito.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {list.map((tipo) => (
            <li key={tipo}>
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 py-1 pl-3 pr-1 text-sm font-semibold text-sky-900">
                {tipo}
                <button
                  type="button"
                  className="rounded-full p-0.5 text-sky-600 hover:bg-red-100 hover:text-red-700"
                  onClick={() => remove(tipo)}
                  disabled={saving}
                  aria-label={`Rimuovi ${tipo}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <SaveFeedback message={feedback} onClear={() => setFeedback('')} />
        {saving && <p className="text-xs text-slate-500">Salvataggio…</p>}
      </div>
    </section>
  );
}
