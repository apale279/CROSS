import { useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Modal } from '../ui/Modal';
import { btnPrimary, btnSecondary } from '../ui/FormField';
import { toDatetimeLocalValue, fromDatetimeLocalValue } from '../../lib/datetimeLocal';
import { codiceMinoreFromPaziente } from '../../services/pmaCodiceMinoreService';
import { PmaCodiceMinoreFotoStrip } from './PmaCodiceMinoreFotoStrip';

const inputClass =
  'w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20';

function emptyDraft() {
  return {
    pettorale: '',
    motivoArrivo: '',
    trattamento: '',
    oraArrivo: toDatetimeLocalValue(Timestamp.now()),
    oraFine: '',
  };
}

function draftFromRow(row) {
  const cm = codiceMinoreFromPaziente(row);
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

export function PmaCodiceMinoreFormModal({
  open,
  row,
  busy,
  manifestationId,
  onClose,
  onSave,
  onFotoChange,
}) {
  const editingId = row?._docId ?? null;
  const [draft, setDraft] = useState(emptyDraft);

  useEffect(() => {
    if (!open) return;
    setDraft(row ? draftFromRow(row) : emptyDraft());
  }, [open, row]);

  if (!open) return null;

  const title = editingId
    ? `Modifica codice minore — pett. ${row?.pettorale ?? '—'}`
    : 'Nuovo codice minore';

  const handleSave = async () => {
    const payload = {
      pettorale: draft.pettorale,
      motivoArrivo: draft.motivoArrivo,
      trattamento: draft.trattamento,
      oraArrivo: tsFromLocal(draft.oraArrivo, true),
      oraFine: draft.oraFine ? tsFromLocal(draft.oraFine, false) : null,
    };
    await onSave(payload, row);
  };

  return (
    <Modal title={title} wide fitViewport onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block min-w-0 text-sm">
            <span className="mb-1 block font-medium text-slate-700">N. pettorale</span>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              className={inputClass}
              value={draft.pettorale}
              onChange={(e) => setDraft((d) => ({ ...d, pettorale: e.target.value }))}
            />
          </label>
          <label className="block min-w-0 text-sm">
            <span className="mb-1 block font-medium text-slate-700">Ora arrivo</span>
            <input
              type="datetime-local"
              className={inputClass}
              value={draft.oraArrivo}
              onChange={(e) => setDraft((d) => ({ ...d, oraArrivo: e.target.value }))}
            />
          </label>
          <label className="block min-w-0 text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Motivo arrivo</span>
            <input
              type="text"
              className={inputClass}
              value={draft.motivoArrivo}
              onChange={(e) => setDraft((d) => ({ ...d, motivoArrivo: e.target.value }))}
            />
          </label>
          <label className="block min-w-0 text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Trattamento</span>
            <textarea
              rows={3}
              className={inputClass}
              value={draft.trattamento}
              onChange={(e) => setDraft((d) => ({ ...d, trattamento: e.target.value }))}
            />
          </label>
          <label className="block min-w-0 text-sm">
            <span className="mb-1 block font-medium text-slate-700">Ora fine</span>
            <input
              type="datetime-local"
              className={inputClass}
              value={draft.oraFine}
              onChange={(e) => setDraft((d) => ({ ...d, oraFine: e.target.value }))}
            />
          </label>
        </div>

        {editingId ? (
          <PmaCodiceMinoreFotoStrip
            manifestationId={manifestationId}
            pazienteDocId={editingId}
            row={row}
            busy={busy}
            onFotoChange={onFotoChange}
          />
        ) : (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Dopo il salvataggio potrai allegare foto del trattamento (medicazioni, bendaggi, ecc.).
          </p>
        )}

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2">
          <button
            type="button"
            className={btnPrimary}
            disabled={busy}
            onClick={() => void handleSave()}
          >
            {editingId ? 'Salva' : 'Crea'}
          </button>
          <button type="button" className={btnSecondary} disabled={busy} onClick={onClose}>
            Annulla
          </button>
        </div>
      </div>
    </Modal>
  );
}
