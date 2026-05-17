import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useImpostazioniField } from '../../hooks/useImpostazioniField';
import { emojiFromSeed, normalizeTipiMezzo, sanitizeEmoji } from '../../lib/tipiMezzo';
import { btnPrimary, btnSecondary, inputClass } from '../ui/FormField';
import { SaveFeedback } from './SaveFeedback';

const thClass =
  'bg-slate-100 px-3 py-2 text-left text-xs font-bold uppercase text-slate-600';
const tdClass = 'border-t border-slate-200 px-2 py-2 align-middle';

const nomeInputClass = `${inputClass} min-w-0`;
const emojiInputClass =
  'box-border w-full min-h-12 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center text-3xl leading-none text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20';

function emptyRow() {
  return { nome: '', emoji: '' };
}

export function TipiMezzoEditor() {
  const { value, saveField, saving, loading } = useImpostazioniField('tipiMezzo');
  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!dirty) {
      const normalized = normalizeTipiMezzo(value);
      setRows(normalized.length ? normalized : [emptyRow()]);
    }
  }, [value, dirty]);

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow()]);
    setDirty(true);
  };

  const removeRow = (index) => {
    setRows((prev) => (prev.length <= 1 ? [emptyRow()] : prev.filter((_, i) => i !== index)));
    setDirty(true);
  };

  const handleSave = async () => {
    setFeedback('');
    const next = normalizeTipiMezzo(
      rows
        .map((r) => {
          const nome = r.nome.trim();
          if (!nome) return null;
          return {
            nome,
            emoji: sanitizeEmoji(r.emoji) || emojiFromSeed(nome),
          };
        })
        .filter(Boolean),
    );

    if (next.length === 0) {
      alert('Aggiungi almeno un tipo mezzo.');
      return;
    }

    try {
      await saveField(next);
      setDirty(false);
      setFeedback('«Tipo mezzo» salvato.');
    } catch (err) {
      console.error(err);
      alert('Errore salvataggio: ' + err.message);
    }
  };

  if (loading) {
    return (
      <section className="rounded border border-slate-300 bg-white p-4 text-sm text-slate-500">
        Caricamento «Tipo mezzo»…
      </section>
    );
  }

  return (
    <section className="rounded border border-slate-300 bg-white p-4">
      <h3 className="mb-1 text-sm font-bold uppercase text-slate-800">Tipo mezzo</h3>
      <p className="mb-3 text-xs text-slate-600">
        Nome del tipo e emoji usata come simbolo sulla mappa operativa (dashboard).
      </p>

      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[48%]" />
            <col className="w-40" />
            <col className="w-11" />
          </colgroup>
          <thead>
            <tr>
              <th className={thClass}>Nome</th>
              <th className={`${thClass} text-center`}>Emoji</th>
              <th className={`${thClass} text-center`} aria-label="Azioni">
                <span className="sr-only">Azioni</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="bg-white hover:bg-slate-50/80">
                <td className={tdClass}>
                  <input
                    className={nomeInputClass}
                    value={row.nome}
                    onChange={(e) => updateRow(index, { nome: e.target.value })}
                    placeholder="es. Ambulanza"
                    aria-label={`Nome tipo ${index + 1}`}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    className={emojiInputClass}
                    value={row.emoji}
                    maxLength={8}
                    onChange={(e) => updateRow(index, { emoji: sanitizeEmoji(e.target.value) })}
                    placeholder="🚑"
                    aria-label={`Emoji tipo ${index + 1}`}
                  />
                </td>
                <td className={`${tdClass} text-center`}>
                  <button
                    type="button"
                    className={`${btnSecondary} inline-flex p-2`}
                    onClick={() => removeRow(index)}
                    title="Rimuovi"
                    aria-label={`Rimuovi tipo ${row.nome || index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={`${btnSecondary} flex items-center gap-1`} onClick={addRow}>
          <Plus className="h-4 w-4" />
          Aggiungi tipo
        </button>
        <button type="button" className={btnPrimary} disabled={!dirty || saving} onClick={handleSave}>
          {saving ? 'Salvataggio…' : 'Salva'}
        </button>
        <SaveFeedback message={feedback} onClear={() => setFeedback('')} />
      </div>
    </section>
  );
}
