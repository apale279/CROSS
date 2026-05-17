import { useState } from 'react';
import { Star } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { DiarioNotaForm } from './DiarioNotaForm';
import { btnDanger, btnPrimary, btnSecondary } from '../ui/FormField';
import { formatTimestamp } from '../../utils/formatters';
import { confirmDelete } from '../../utils/confirmDelete';

export function DiarioNotaModal({
  nota,
  mode = 'view',
  saving,
  onClose,
  onSave,
  onDelete,
  onToggleChiusa,
  onToggleImportante,
}) {
  const [editing, setEditing] = useState(mode === 'edit' || mode === 'create');

  if (!nota && mode !== 'create') return null;

  const isCreate = mode === 'create';
  const titolo = isCreate ? 'Nuova nota' : nota?.titolo ?? 'Nota';
  const aperta = nota?.aperta !== false;

  return (
    <Modal title={isCreate ? 'Nuova nota' : titolo} onClose={onClose} wide>
      {editing || isCreate ? (
        <DiarioNotaForm
          nota={isCreate ? null : nota}
          saving={saving}
          onCancel={isCreate ? onClose : () => setEditing(false)}
          onSave={(payload) => onSave?.(payload, { closeOnSuccess: isCreate })}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={`rounded border px-2 py-0.5 font-semibold uppercase ${
                aperta
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-slate-300 bg-slate-100 text-slate-600'
              }`}
            >
              {aperta ? 'Aperta' : 'Chiusa'}
            </span>
            {nota.importante && (
              <span className="inline-flex items-center gap-1 rounded border border-amber-400 bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" aria-hidden />
                Importante
              </span>
            )}
            <span className="text-slate-500">
              Aggiornata: {formatTimestamp(nota.aggiornatoIl ?? nota.creatoIl)}
            </span>
          </div>
          <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
            {nota.testo || '—'}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} onClick={() => setEditing(true)}>
              Modifica
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={saving}
              onClick={() => onToggleChiusa?.(!aperta)}
            >
              {aperta ? 'Chiudi nota' : 'Riapri nota'}
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={saving}
              onClick={() => onToggleImportante?.(!nota.importante)}
            >
              {nota.importante ? 'Rimuovi importante' : 'Segna importante'}
            </button>
            <button
              type="button"
              className={btnDanger}
              disabled={saving}
              onClick={() => {
                if (!confirmDelete(`nota «${nota.titolo}»`)) return;
                onDelete?.();
              }}
            >
              Elimina
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
