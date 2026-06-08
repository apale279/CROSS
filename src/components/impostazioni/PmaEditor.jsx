import { useState } from 'react';
import { X } from 'lucide-react';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { enrichPmaEntryWithIpadCredentials } from '../../lib/pmaIpadCredentials';
import { buildPostiLetto, normalizeGrigliaPostiLetto } from '../../lib/pmaPostiLetto';
import { useImpostazioniField } from '../../hooks/useImpostazioniField';
import {
  deleteImpostazioniArrayEntryById,
  saveImpostazioniArrayEntryById,
} from '../../services/impostazioniService';
import { syncPmaIpadConfigFromPmaEntry } from '../../services/pmaIpadFirmaService';
import { AddressPicker } from '../maps/AddressPicker';
import { LuogoFisicoField } from '../maps/LuogoFisicoField';
import { Modal } from '../ui/Modal';
import { FormField, btnPrimary, btnSecondary, inputClass } from '../ui/FormField';
import { SaveFeedback } from './SaveFeedback';

function newPma() {
  return enrichPmaEntryWithIpadCredentials({
    id: crypto.randomUUID(),
    nome: '',
    indirizzo: '',
    luogo_fisico: '',
    coordinate: null,
    grigliaPostiLetto: { righe: 5, colonne: 2 },
    postiLettoLabels: {},
  });
}

export function PmaEditor() {
  const manifestationId = useManifestazioneId();
  const { value: items, saving, loading } = useImpostazioniField('pma');
  const list = items ?? [];
  const [feedback, setFeedback] = useState('');
  const [modal, setModal] = useState(null);

  const persistEntry = async (entry, successMessage) => {
    setFeedback('');
    try {
      await saveImpostazioniArrayEntryById(manifestationId, 'pma', entry);
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
    const entry = enrichPmaEntryWithIpadCredentials({ ...modal.draft, nome });
    const isEdit = list.some((p) => p.id === modal.draft.id);

    try {
      await persistEntry(entry, isEdit ? 'PMA aggiornato.' : 'PMA creato.');
      if (manifestationId) {
        await syncPmaIpadConfigFromPmaEntry(manifestationId, entry);
      }
      setModal(null);
    } catch {
      /* feedback in persistEntry */
    }
  };

  const remove = async (id) => {
    const p = list.find((x) => x.id === id);
    if (!p) return;
    if (!window.confirm(`Rimuovere PMA «${p.nome}»?`)) return;
    try {
      await deleteImpostazioniArrayEntryById(manifestationId, 'pma', id);
      setFeedback('PMA rimosso.');
    } catch (err) {
      alert('Errore: ' + err.message);
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
        Ogni PMA ha un ID univoco e un account iPad automatico (utente <code className="font-mono">nomepma_ipad</code>
        , password <code className="font-mono">ipad123</code>). In mappa operativa compare con l&apos;icona tenda.
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

      <p className="mt-4 text-xs text-slate-500">
        Per assegnare operatori ai PMA (tipo accesso, rank, password) usa il tab{' '}
        <strong className="text-slate-700">Utenti → Account operatori</strong>.
      </p>

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
            <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
              <p className="mb-2 text-xs font-bold uppercase text-violet-900">
                Griglia posti letto (dashboard PMA)
              </p>
              <p className="mb-3 text-xs text-slate-600">
                Es. 5 righe × 2 colonne = 2 colonne da 5 letti. Numerazione default: LETTO N°1, LETTO
                N°2 in alto, poi a capo. I nomi si modificano dalla dashboard PMA.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Righe per colonna">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className={inputClass}
                    value={modal.draft.grigliaPostiLetto?.righe ?? ''}
                    onChange={(e) => {
                      const righe = Math.max(0, Math.trunc(Number(e.target.value) || 0));
                      setModal((m) => ({
                        ...m,
                        draft: {
                          ...m.draft,
                          grigliaPostiLetto: {
                            righe,
                            colonne: m.draft.grigliaPostiLetto?.colonne ?? 2,
                          },
                        },
                      }));
                    }}
                  />
                </FormField>
                <FormField label="Numero colonne">
                  <input
                    type="number"
                    min={1}
                    max={12}
                    className={inputClass}
                    value={modal.draft.grigliaPostiLetto?.colonne ?? ''}
                    onChange={(e) => {
                      const colonne = Math.max(0, Math.trunc(Number(e.target.value) || 0));
                      setModal((m) => ({
                        ...m,
                        draft: {
                          ...m.draft,
                          grigliaPostiLetto: {
                            righe: m.draft.grigliaPostiLetto?.righe ?? 5,
                            colonne,
                          },
                        },
                      }));
                    }}
                  />
                </FormField>
              </div>
              {normalizeGrigliaPostiLetto(modal.draft.grigliaPostiLetto) ? (
                <p className="mt-2 text-xs text-slate-600">
                  {buildPostiLetto(modal.draft).length} posti:{' '}
                  {buildPostiLetto(modal.draft)
                    .slice(0, 8)
                    .map((b) => b.label)
                    .join(', ')}
                  {buildPostiLetto(modal.draft).length > 8 ? '…' : ''}
                </p>
              ) : (
                <p className="mt-2 text-xs text-amber-800">
                  Imposta righe e colonne ≥ 1 per attivare la griglia in dashboard.
                </p>
              )}
            </div>
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
