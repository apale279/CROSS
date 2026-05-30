import { useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { btnDanger, btnSecondary } from '../ui/FormField';
import { formatTimestamp } from '../../utils/formatters';
import { codiceMinoreFromPaziente } from '../../services/pmaCodiceMinoreService';
import { PmaCodiceMinoreFormModal } from './PmaCodiceMinoreFormModal';
import { PmaCodiciMinoriTabellaFotoStrip } from './PmaCodiciMinoriTabellaFotoStrip';

const thClass =
  'sticky top-0 z-10 bg-slate-100 px-2 py-1.5 text-left text-[11px] font-bold uppercase text-slate-600';
const tdClass = 'border-t border-slate-200 px-2 py-1.5 align-middle text-sm text-slate-900';

export function PmaCodiciMinoriPanel({
  rows,
  busy,
  manifestationId,
  pmaId,
  impostazioni,
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
          Astanteria per piccole medicazioni: pettorale, anagrafica, motivo, trattamento e orari.
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
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Pett.</th>
                <th className={thClass}>Nome</th>
                <th className={thClass}>Cognome</th>
                <th className={`${thClass} text-center`}>Età</th>
                <th className={thClass}>Motivo</th>
                <th className={thClass}>Arrivo</th>
                <th className={thClass}>Fine</th>
                <th className={thClass}>Stato</th>
                <th className={`${thClass} text-right`}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const cm = codiceMinoreFromPaziente(row);
                const chiuso = cm.oraFine != null;
                return (
                  <tr key={row._docId} className="hover:bg-slate-50/80">
                    <td className={`${tdClass} font-mono font-bold`}>{row.pettorale ?? '—'}</td>
                    <td className={tdClass}>{cm.nome || '—'}</td>
                    <td className={tdClass}>{cm.cognome || '—'}</td>
                    <td className={`${tdClass} text-center font-mono`}>{cm.eta ?? '—'}</td>
                    <td className={`${tdClass} max-w-[16rem] truncate`} title={cm.motivoArrivo}>
                      {cm.motivoArrivo || '—'}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap font-mono text-xs`}>
                      {formatTimestamp(cm.oraArrivo)}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap font-mono text-xs`}>
                      {cm.oraFine ? formatTimestamp(cm.oraFine) : '—'}
                    </td>
                    <td className={tdClass}>
                      {chiuso ? (
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                          Chiuso
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                          Aperto
                        </span>
                      )}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          className={`${btnSecondary} inline-flex items-center gap-1 px-2 py-1 text-xs`}
                          disabled={busy}
                          onClick={() => openEdit(row)}
                          aria-label="Modifica"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={`${btnDanger} inline-flex items-center gap-1 px-2 py-1 text-xs`}
                          disabled={busy}
                          onClick={() => void handleDelete(row)}
                          aria-label="Elimina"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PmaCodiciMinoriTabellaFotoStrip
        manifestationId={manifestationId}
        pmaId={pmaId}
        impostazioni={impostazioni}
        busy={busy}
        onFotoChange={() => {}}
      />

      <PmaCodiceMinoreFormModal
        open={formOpen}
        row={formRow}
        busy={busy}
        impostazioni={impostazioni}
        onClose={closeForm}
        onSave={handleSave}
      />
    </div>
  );
}
