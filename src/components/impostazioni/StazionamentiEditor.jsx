import { useState } from 'react';
import { X } from 'lucide-react';
import { useImpostazioniField } from '../../hooks/useImpostazioniField';
import { AddressPicker } from '../maps/AddressPicker';
import { LuogoFisicoField } from '../maps/LuogoFisicoField';
import { Modal } from '../ui/Modal';
import { FormField, btnPrimary, btnSecondary, inputClass } from '../ui/FormField';
import { SaveFeedback } from './SaveFeedback';

function newStazionamento() {
  return {
    id: crypto.randomUUID(),
    nome: '',
    indirizzo: '',
    luogo_fisico: '',
    coordinate: null,
  };
}

export function StazionamentiEditor() {
  const { value: items, saveField, saving, loading } = useImpostazioniField('stazionamenti');
  const list = items ?? [];
  const [feedback, setFeedback] = useState('');
  const [modal, setModal] = useState(null);

  const persistList = async (next, successMessage) => {
    setFeedback('');
    try {
      await saveField(next);
      setFeedback(successMessage);
    } catch (err) {
      alert('Errore: ' + err.message);
      throw err;
    }
  };

  const openNew = () => setModal({ draft: newStazionamento() });

  const openEdit = (st) => setModal({ draft: { ...st } });

  const saveDraft = async () => {
    const nome = modal.draft.nome.trim();
    if (!nome) {
      alert('Il nome stazionamento è obbligatorio.');
      return;
    }
    const duplicate = list.some(
      (s) => s.nome.toLowerCase() === nome.toLowerCase() && s.id !== modal.draft.id,
    );
    if (duplicate) {
      alert('Nome stazionamento già esistente.');
      return;
    }
    const entry = { ...modal.draft, nome };
    const next = list.some((s) => s.id === modal.draft.id)
      ? list.map((s) => (s.id === modal.draft.id ? entry : s))
      : [...list, entry];

    try {
      await persistList(next, list.some((s) => s.id === modal.draft.id) ? 'Stazionamento aggiornato.' : 'Stazionamento creato.');
      setModal(null);
    } catch {
      /* feedback in persistList */
    }
  };

  const remove = async (id) => {
    const st = list.find((s) => s.id === id);
    if (!st) return;
    if (!window.confirm(`Rimuovere «${st.nome}»?`)) return;
    const next = list.filter((s) => s.id !== id);
    try {
      await persistList(next, 'Stazionamento rimosso.');
    } catch {
      /* */
    }
  };

  if (loading) {
    return (
      <section className="rounded border border-slate-300 bg-white p-4 text-sm text-slate-500">
        Caricamento stazionamenti…
      </section>
    );
  }

  return (
    <section className="rounded border border-slate-300 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase text-slate-800">Stazionamento</h3>
        <button type="button" className={btnSecondary} disabled={saving} onClick={openNew}>
          + Nuovo stazionamento
        </button>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-slate-500">Nessuno stazionamento definito.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {list.map((st) => (
            <li key={st.id}>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 py-1 pl-3 pr-1 text-sm">
                <button
                  type="button"
                  className="font-semibold text-slate-800 hover:text-sky-700"
                  onClick={() => openEdit(st)}
                  title={st.indirizzo || 'Senza indirizzo'}
                  disabled={saving}
                >
                  {st.nome}
                </button>
                <button
                  type="button"
                  className="rounded-full p-0.5 text-slate-400 hover:bg-red-100 hover:text-red-700"
                  onClick={() => remove(st.id)}
                  disabled={saving}
                  aria-label={`Rimuovi ${st.nome}`}
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

      {modal && (
        <Modal title="Stazionamento" onClose={() => !saving && setModal(null)} wide>
          <div className="space-y-4">
            <FormField label="Nome (univoco)">
              <input
                className={inputClass}
                value={modal.draft.nome}
                onChange={(e) =>
                  setModal((m) => ({ ...m, draft: { ...m.draft, nome: e.target.value } }))
                }
                placeholder="es. PMA Centro"
              />
            </FormField>
            <LuogoFisicoField
              value={modal.draft.luogo_fisico}
              onChange={(luogo_fisico) =>
                setModal((m) => ({ ...m, draft: { ...m.draft, luogo_fisico } }))
              }
            />
            <AddressPicker
              indirizzo={modal.draft.indirizzo}
              coordinate={modal.draft.coordinate}
              onCommit={({ indirizzo, coordinate }) =>
                setModal((m) => ({
                  ...m,
                  draft: { ...m.draft, indirizzo, coordinate },
                }))
              }
            />
            <div className="flex gap-2">
              <button type="button" className={btnPrimary} disabled={saving} onClick={saveDraft}>
                {saving ? 'Salvataggio…' : 'Salva stazionamento'}
              </button>
              <button
                type="button"
                className={btnSecondary}
                disabled={saving}
                onClick={() => setModal(null)}
              >
                Annulla
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
