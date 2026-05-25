import { useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { btnDanger, btnPrimary, btnSecondary } from '../ui/FormField';
import { toDatetimeLocalValue, fromDatetimeLocalValue } from '../../lib/datetimeLocal';
import { formatTimestamp } from '../../utils/formatters';
import { codiceMinoreFromPaziente } from '../../services/pmaCodiceMinoreService';

const thClass =
  'whitespace-nowrap bg-slate-100 px-3 py-2 text-left text-xs font-bold uppercase text-slate-600';
const tdClass = 'whitespace-nowrap border-t border-slate-200 px-3 py-2 align-middle text-sm';
const tdWrapClass =
  'max-w-[14rem] truncate border-t border-slate-200 px-3 py-2 align-middle text-sm';
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20';

function emptyDraft() {
  return {
    pettorale: '',
    motivoArrivo: '',
    trattamento: '',
    oraArrivo: toDatetimeLocalValue(Timestamp.now()),
    oraFine: '',
  };
}

function draftFromPaziente(p) {
  const cm = codiceMinoreFromPaziente(p);
  return {
    pettorale: cm.pettorale != null ? String(cm.pettorale) : '',
    motivoArrivo: cm.motivoArrivo,
    trattamento: cm.trattamento,
    oraArrivo: toDatetimeLocalValue(cm.oraArrivo),
    oraFine: toDatetimeLocalValue(cm.oraFine),
  };
}

function tsFromLocal(value, fallbackNow = true) {
  const d = fromDatetimeLocalValue(value);
  if (d) return Timestamp.fromDate(d);
  return fallbackNow ? Timestamp.now() : null;
}

export function PmaCodiciMinoriPanel({ rows, busy, onCreate, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [showForm, setShowForm] = useState(false);

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const pa = Number(a.pettorale);
        const pb = Number(b.pettorale);
        if (Number.isFinite(pa) && Number.isFinite(pb) && pa !== pb) return pa - pb;
        return (b.apertura?.toMillis?.() ?? 0) - (a.apertura?.toMillis?.() ?? 0);
      }),
    [rows],
  );

  const resetForm = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setShowForm(false);
  };

  const startCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setShowForm(true);
  };

  const startEdit = (row) => {
    setEditingId(row._docId);
    setDraft(draftFromPaziente(row));
    setShowForm(true);
  };

  const handleSave = async () => {
    const payload = {
      pettorale: draft.pettorale,
      motivoArrivo: draft.motivoArrivo,
      trattamento: draft.trattamento,
      oraArrivo: tsFromLocal(draft.oraArrivo, true),
      oraFine: draft.oraFine ? tsFromLocal(draft.oraFine, false) : null,
    };
    if (editingId) {
      await onUpdate(editingId, payload);
    } else {
      await onCreate(payload);
    }
    resetForm();
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Eliminare codice minore pettorale ${row.pettorale ?? '—'}?`)) return;
    await onDelete(row._docId);
    if (editingId === row._docId) resetForm();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Pazienti in astanteria con piccole medicazioni. Campi: pettorale, motivo arrivo,
          trattamento, ora arrivo e ora fine.
        </p>
        <button type="button" className={btnSecondary} disabled={busy} onClick={startCreate}>
          + Codice minore
        </button>
      </div>

      {showForm ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-xs font-bold uppercase text-slate-600">
            {editingId ? 'Modifica codice minore' : 'Nuovo codice minore'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">N. pettorale</span>
              <input
                type="number"
                min={1}
                className={inputClass}
                value={draft.pettorale}
                onChange={(e) => setDraft((d) => ({ ...d, pettorale: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Ora arrivo</span>
              <input
                type="datetime-local"
                className={inputClass}
                value={draft.oraArrivo}
                onChange={(e) => setDraft((d) => ({ ...d, oraArrivo: e.target.value }))}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Motivo arrivo</span>
              <input
                type="text"
                className={inputClass}
                value={draft.motivoArrivo}
                onChange={(e) => setDraft((d) => ({ ...d, motivoArrivo: e.target.value }))}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Trattamento</span>
              <textarea
                rows={2}
                className={inputClass}
                value={draft.trattamento}
                onChange={(e) => setDraft((d) => ({ ...d, trattamento: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Ora fine</span>
              <input
                type="datetime-local"
                className={inputClass}
                value={draft.oraFine}
                onChange={(e) => setDraft((d) => ({ ...d, oraFine: e.target.value }))}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => void handleSave()}>
              {editingId ? 'Salva' : 'Crea'}
            </button>
            <button type="button" className={btnSecondary} disabled={busy} onClick={resetForm}>
              Annulla
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded border border-slate-300 bg-white">
        <table className="w-full min-w-[52rem] table-fixed border-collapse">
          <colgroup>
            <col className="w-[5rem]" />
            <col className="w-[18%]" />
            <col className="w-[26%]" />
            <col className="w-[11rem]" />
            <col className="w-[11rem]" />
            <col className="w-[11.5rem]" />
          </colgroup>
          <thead>
            <tr>
              <th className={thClass}>Pettorale</th>
              <th className={thClass}>Motivo arrivo</th>
              <th className={thClass}>Trattamento</th>
              <th className={thClass}>Ora arrivo</th>
              <th className={thClass}>Ora fine</th>
              <th className={`${thClass} text-right`}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className={`${tdClass} whitespace-normal text-slate-500`}>
                  Nessun codice minore registrato.
                </td>
              </tr>
            ) : (
              sorted.map((row) => {
                const cm = codiceMinoreFromPaziente(row);
                return (
                  <tr key={row._docId} className="hover:bg-sky-50/50">
                    <td className={`${tdClass} font-mono font-bold`}>{row.pettorale ?? '—'}</td>
                    <td className={tdWrapClass} title={cm.motivoArrivo}>
                      {cm.motivoArrivo || '—'}
                    </td>
                    <td className={tdWrapClass} title={cm.trattamento}>
                      {cm.trattamento || '—'}
                    </td>
                    <td className={`${tdClass} font-mono text-xs`}>
                      {formatTimestamp(cm.oraArrivo)}
                    </td>
                    <td className={`${tdClass} font-mono text-xs`}>
                      {cm.oraFine ? formatTimestamp(cm.oraFine) : '—'}
                    </td>
                    <td className={tdClass}>
                      <div className="flex flex-nowrap items-center justify-end gap-2">
                        <button
                          type="button"
                          className={`${btnSecondary} shrink-0 whitespace-nowrap`}
                          disabled={busy}
                          onClick={() => startEdit(row)}
                        >
                          Modifica
                        </button>
                        <button
                          type="button"
                          className={`${btnDanger} shrink-0 whitespace-nowrap`}
                          disabled={busy}
                          onClick={() => void handleDelete(row)}
                        >
                          Elimina
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
