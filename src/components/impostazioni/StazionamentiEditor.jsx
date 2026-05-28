import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { useImpostazioniField } from '../../hooks/useImpostazioniField';
import {
  deleteImpostazioniArrayEntryById,
  replaceImpostazioniArrayField,
  saveImpostazioniArrayEntryById,
} from '../../services/impostazioniService';
import {
  parseStazionamentiExcel,
  stazionamentiEntriesWithIds,
} from '../../lib/parseStazionamentiExcel';
import { AddressPicker } from '../maps/AddressPicker';
import { LuogoFisicoField } from '../maps/LuogoFisicoField';
import { Modal } from '../ui/Modal';
import { FormField, btnPrimary, btnSecondary, inputClass } from '../ui/FormField';
import { SaveFeedback } from './SaveFeedback';

const TIPO_STAZIONAMENTO_MAX = 48;

function newStazionamento() {
  return {
    id: crypto.randomUUID(),
    nome: '',
    tipo_stazionamento: '',
    note: '',
    indirizzo: '',
    luogo_fisico: '',
    coordinate: null,
  };
}

function stazionamentoTooltip(st) {
  return [st.tipo_stazionamento, st.note, st.indirizzo].filter(Boolean).join(' · ') || 'Senza indirizzo';
}

export function StazionamentiEditor() {
  const manifestationId = useManifestazioneId();
  const { value: items, saving, loading } = useImpostazioniField('stazionamenti');
  const list = items ?? [];
  const fileRef = useRef(null);
  const [importBusy, setImportBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [modal, setModal] = useState(null);

  const persistEntry = async (entry, successMessage) => {
    setFeedback('');
    try {
      await saveImpostazioniArrayEntryById(manifestationId, 'stazionamenti', entry);
      setFeedback(successMessage);
    } catch (err) {
      alert('Errore: ' + err.message);
      throw err;
    }
  };

  const persistBulkReplace = async (next, successMessage) => {
    setFeedback('');
    try {
      await replaceImpostazioniArrayField(manifestationId, 'stazionamenti', next);
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
    const entry = {
      ...modal.draft,
      nome,
      tipo_stazionamento: String(modal.draft.tipo_stazionamento ?? '').trim(),
      note: String(modal.draft.note ?? '').trim(),
    };
    const isEdit = list.some((s) => s.id === modal.draft.id);

    try {
      await persistEntry(entry, isEdit ? 'Stazionamento aggiornato.' : 'Stazionamento creato.');
      setModal(null);
    } catch {
      /* feedback in persistEntry */
    }
  };

  const onImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
      alert('Seleziona un file Excel (.xlsx o .xls).');
      e.target.value = '';
      return;
    }
    setImportBusy(true);
    setFeedback('');
    try {
      const buf = await file.arrayBuffer();
      const { sheetName, entries } = parseStazionamentiExcel(buf);
      if (!entries.length) {
        alert(
          'Nessuna riga valida. Usa il foglio STAZIONAMENTI con colonne A=nome, B=indirizzo, C=coordinate, D=note, E=tipo.',
        );
        return;
      }
      if (
        !window.confirm(
          `Importare ${entries.length} stazionamenti dal foglio «${sheetName}»? Sostituisce l’elenco attuale (${list.length} voci).`,
        )
      ) {
        return;
      }
      const next = stazionamentiEntriesWithIds(entries);
      await persistBulkReplace(next, `Importati ${next.length} stazionamenti da Excel.`);
    } catch (err) {
      console.error(err);
      alert('Errore lettura file: ' + (err?.message ?? err));
    } finally {
      setImportBusy(false);
      e.target.value = '';
    }
  };

  const remove = async (id) => {
    const st = list.find((s) => s.id === id);
    if (!st) return;
    if (!window.confirm(`Rimuovere «${st.nome}»?`)) return;
    try {
      await deleteImpostazioniArrayEntryById(manifestationId, 'stazionamenti', id);
      setFeedback('Stazionamento rimosso.');
    } catch (err) {
      alert('Errore: ' + err.message);
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btnSecondary}
            disabled={saving || importBusy}
            onClick={() => fileRef.current?.click()}
          >
            {importBusy ? 'Import…' : 'Importa Excel'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={onImportExcel}
          />
          <button type="button" className={btnSecondary} disabled={saving || importBusy} onClick={openNew}>
            + Nuovo stazionamento
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-slate-600">
        Import da foglio <strong>STAZIONAMENTI</strong> (es. FLOTTA RESEGUP):{' '}
        <strong>A</strong> nome, <strong>B</strong> indirizzo, <strong>C</strong> coordinate (lat, lng),{' '}
        <strong>D</strong> note, <strong>E</strong> tipo.
      </p>

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
                  title={stazionamentoTooltip(st)}
                  disabled={saving}
                >
                  {st.nome}
                  {st.tipo_stazionamento ? (
                    <span className="ml-1 font-normal text-slate-500">({st.tipo_stazionamento})</span>
                  ) : null}
                  {st.note ? (
                    <span className="ml-1 max-w-[10rem] truncate font-normal text-slate-500" title={st.note}>
                      — {st.note}
                    </span>
                  ) : null}
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
            <FormField label="Tipo di stazionamento">
              <input
                type="text"
                className={inputClass}
                value={modal.draft.tipo_stazionamento ?? ''}
                maxLength={TIPO_STAZIONAMENTO_MAX}
                placeholder="es. PMA, parcheggio notturno…"
                onChange={(e) =>
                  setModal((m) => ({
                    ...m,
                    draft: { ...m.draft, tipo_stazionamento: e.target.value },
                  }))
                }
              />
            </FormField>
            <FormField label="Note">
              <textarea
                className={inputClass}
                rows={3}
                value={modal.draft.note ?? ''}
                placeholder="Indicazioni operative, accessi, riferimenti…"
                onChange={(e) =>
                  setModal((m) => ({ ...m, draft: { ...m.draft, note: e.target.value } }))
                }
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
