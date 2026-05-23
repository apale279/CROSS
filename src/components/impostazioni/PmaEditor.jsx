import { useState } from 'react';
import { X } from 'lucide-react';
import { useImpostazioniField } from '../../hooks/useImpostazioniField';
import { AddressPicker } from '../maps/AddressPicker';
import { LuogoFisicoField } from '../maps/LuogoFisicoField';
import { Modal } from '../ui/Modal';
import { FormField, btnPrimary, btnSecondary, inputClass } from '../ui/FormField';
import { SaveFeedback } from './SaveFeedback';

function newPma() {
  return {
    id: crypto.randomUUID(),
    nome: '',
    indirizzo: '',
    luogo_fisico: '',
    coordinate: null,
  };
}

export function PmaEditor() {
  const { value: items, saveField, saving, loading } = useImpostazioniField('pma');
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

  const openNew = () => setModal({ draft: newPma() });
  const openEdit = (p) => setModal({ draft: { ...p } });

  const saveDraft = async () => {
    const nome = modal.draft.nome.trim();
    if (!nome) {
      alert('Il nome PMA è obbligatorio.');
      return;
    }
    const duplicate = list.some(
      (p) => p.nome.toLowerCase() === nome.toLowerCase() && p.id !== modal.draft.id,
    );
    if (duplicate) {
      alert('Nome PMA già esistente.');
      return;
    }
    const entry = { ...modal.draft, nome };
    const next = list.some((p) => p.id === modal.draft.id)
      ? list.map((p) => (p.id === modal.draft.id ? entry : p))
      : [...list, entry];

    try {
      await persistList(
        next,
        list.some((p) => p.id === modal.draft.id) ? 'PMA aggiornato.' : 'PMA creato.',
      );
      setModal(null);
    } catch {
      /* feedback in persistList */
    }
  };

  const remove = async (id) => {
    const p = list.find((x) => x.id === id);
    if (!p) return;
    if (!window.confirm(`Rimuovere PMA «${p.nome}»?`)) return;
    try {
      await persistList(
        list.filter((x) => x.id !== id),
        'PMA rimosso.',
      );
    } catch {
      /* */
    }
  };

  if (loading) {
    return (
      <section className="rounded border border-slate-300 bg-white p-4 text-sm text-slate-500">
        Caricamento PMA…
      </section>
    );
  }

  return (
    <section className="rounded border border-slate-300 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase text-slate-800">PMA (posto medico avanzato)</h3>
        <button type="button" className={btnSecondary} disabled={saving} onClick={openNew}>
          + Nuovo PMA
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Ogni PMA può avere indirizzo o coordinate GPS (come uno stazionamento). In mappa operativa
        compare con l&apos;icona tenda.
      </p>

      {list.length === 0 ? (
        <p className="text-sm text-slate-500">Nessun PMA definito.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {list.map((p) => (
            <li key={p.id}>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 py-1 pl-3 pr-1 text-sm">
                <span className="mr-0.5" aria-hidden>
                  🏕️
                </span>
                <button
                  type="button"
                  className="font-semibold text-slate-800 hover:text-sky-700"
                  onClick={() => openEdit(p)}
                  title={p.indirizzo || 'Senza posizione'}
                  disabled={saving}
                >
                  {p.nome}
                </button>
                <button
                  type="button"
                  className="rounded-full p-0.5 text-slate-400 hover:bg-red-100 hover:text-red-700"
                  onClick={() => remove(p.id)}
                  disabled={saving}
                  aria-label={`Rimuovi ${p.nome}`}
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
        <Modal title="PMA" onClose={() => !saving && setModal(null)} wide>
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
                {saving ? 'Salvataggio…' : 'Salva PMA'}
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
