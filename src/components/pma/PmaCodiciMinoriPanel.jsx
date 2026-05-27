import { useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { btnDanger, btnSecondary } from '../ui/FormField';
import { formatTimestamp } from '../../utils/formatters';
import { codiceMinoreFromPaziente } from '../../services/pmaCodiceMinoreService';
import { PmaCodiceMinoreFormModal } from './PmaCodiceMinoreFormModal';
import { PmaCodiceMinoreFotoStrip } from './PmaCodiceMinoreFotoStrip';

function CodiceMinoreCard({ row, busy, manifestationId, onEdit, onDelete }) {
  const cm = codiceMinoreFromPaziente(row);
  const chiuso = cm.oraFine != null;

  return (
    <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-lg font-bold text-slate-900">
            Pett. {row.pettorale ?? '—'}
          </p>
          {chiuso ? (
            <span className="mt-0.5 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
              Chiuso
            </span>
          ) : (
            <span className="mt-0.5 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
              Aperto
            </span>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            className={`${btnSecondary} inline-flex items-center gap-1 px-2 py-1.5 text-xs`}
            disabled={busy}
            onClick={() => onEdit(row)}
            aria-label="Modifica"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Modifica
          </button>
          <button
            type="button"
            className={`${btnDanger} inline-flex items-center gap-1 px-2 py-1.5 text-xs`}
            disabled={busy}
            onClick={() => void onDelete(row)}
            aria-label="Elimina"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      <dl className="grid gap-1.5 text-sm">
        <div className="min-w-0">
          <dt className="text-[10px] font-bold uppercase text-slate-500">Motivo arrivo</dt>
          <dd className="break-words text-slate-800">{cm.motivoArrivo || '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[10px] font-bold uppercase text-slate-500">Trattamento</dt>
          <dd className="whitespace-pre-wrap break-words text-slate-800">
            {cm.trattamento || '—'}
          </dd>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="font-bold uppercase text-slate-500">Ora arrivo</dt>
            <dd className="font-mono text-slate-800">{formatTimestamp(cm.oraArrivo)}</dd>
          </div>
          <div>
            <dt className="font-bold uppercase text-slate-500">Ora fine</dt>
            <dd className="font-mono text-slate-800">
              {cm.oraFine ? formatTimestamp(cm.oraFine) : '—'}
            </dd>
          </div>
        </div>
      </dl>

      <div className="mt-3 border-t border-slate-100 pt-2">
        <PmaCodiceMinoreFotoStrip
          manifestationId={manifestationId}
          pazienteDocId={row._docId}
          row={row}
          busy={busy}
          compact
        />
      </div>
    </article>
  );
}

export function PmaCodiciMinoriPanel({
  rows,
  busy,
  manifestationId,
  onCreate,
  onUpdate,
  onDelete,
}) {
  const [formDocId, setFormDocId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

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

  const formRow = formDocId ? sorted.find((r) => r._docId === formDocId) ?? null : null;

  const openCreate = () => {
    setFormDocId(null);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setFormDocId(row._docId);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormDocId(null);
  };

  const handleSave = async (payload, existingRow) => {
    if (existingRow?._docId) {
      await onUpdate(existingRow._docId, payload, existingRow);
      return;
    }
    const result = await onCreate(payload);
    if (result?.docId) {
      setFormDocId(result.docId);
    } else {
      closeForm();
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Eliminare codice minore pettorale ${row.pettorale ?? '—'}?`)) return;
    await onDelete(row._docId, row);
    if (formDocId === row._docId) closeForm();
  };

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 max-w-prose text-sm text-slate-600">
          Astanteria per piccole medicazioni: pettorale, motivo, trattamento, orari e foto
          documentazione.
        </p>
        <button
          type="button"
          className={`${btnSecondary} shrink-0`}
          disabled={busy}
          onClick={openCreate}
        >
          + Codice minore
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          Nessun codice minore registrato.
        </p>
      ) : (
        <ul className="grid min-w-0 gap-3 sm:grid-cols-2">
          {sorted.map((row) => (
            <li key={row._docId} className="min-w-0">
              <CodiceMinoreCard
                row={row}
                busy={busy}
                manifestationId={manifestationId}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            </li>
          ))}
        </ul>
      )}

      <PmaCodiceMinoreFormModal
        open={formOpen}
        row={formRow}
        busy={busy}
        manifestationId={manifestationId}
        onClose={closeForm}
        onSave={handleSave}
        onFotoChange={() => {}}
      />
    </div>
  );
}
