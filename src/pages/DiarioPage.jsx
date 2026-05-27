import { useMemo, useState } from 'react';
import { Plus, Star } from 'lucide-react';
import { COLLECTIONS } from '../lib/firestorePaths';
import { useManifestazioneCollection } from '../hooks/useManifestazioneCollection';
import { DiarioNotaModal } from '../components/diario/DiarioNotaModal';
import { useDiarioNotaActions } from '../hooks/useDiarioNotaActions';
import { usePmaAccess } from '../hooks/usePmaAccess';
import { useDiarioTelegramBroadcast } from '../hooks/useDiarioTelegramBroadcast';
import { confirmDelete } from '../utils/confirmDelete';
import { formatTimestamp } from '../utils/formatters';
import { btnDanger, btnPrimary, btnSecondary } from '../components/ui/FormField';

const thClass =
  'sticky top-0 z-10 bg-slate-100/95 px-3 py-2 text-left text-xs font-bold uppercase text-slate-600 backdrop-blur';
const tdClass = 'border-t border-slate-200/80 px-3 py-2 text-sm text-slate-900 align-top';

function noteTime(nota) {
  return nota.aggiornatoIl?.toMillis?.() ?? nota.creatoIl?.toMillis?.() ?? 0;
}

function truncate(text, max = 120) {
  const s = (text ?? '').trim();
  if (!s) return '—';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export default function DiarioPage() {
  const { fullCentrale } = usePmaAccess();
  const { data: note, loading } = useManifestazioneCollection(COLLECTIONS.note_diario);
  const [modal, setModal] = useState(null);
  const { broadcast, broadcasting } = useDiarioTelegramBroadcast();
  const { saving, createNota, updateNota, toggleChiusa, toggleImportante, removeNota, allertaPmaNota } =
    useDiarioNotaActions({
      onAfterSave: () => {},
      onAfterDelete: (docId) => {
        setModal((m) => (m?.nota?._docId === docId ? null : m));
      },
    });

  const sorted = useMemo(
    () =>
      [...note].sort((a, b) => {
        const aOpen = a.aperta !== false ? 1 : 0;
        const bOpen = b.aperta !== false ? 1 : 0;
        if (bOpen !== aOpen) return bOpen - aOpen;
        return noteTime(b) - noteTime(a);
      }),
    [note],
  );

  const openNota = (nota) => setModal({ mode: 'view', nota });
  const openCreate = () => setModal({ mode: 'create', nota: null });

  const handleSave = async (payload, { closeOnSuccess } = {}) => {
    if (modal?.mode === 'create') {
      await createNota(payload);
      if (closeOnSuccess) setModal(null);
      return;
    }
    if (modal?.nota?._docId) {
      await updateNota(modal.nota._docId, payload);
      setModal({ mode: 'view', nota: { ...modal.nota, ...payload } });
    }
  };

  const handleDeleteRow = async (nota) => {
    if (!confirmDelete(`nota «${nota.titolo}»`)) return;
    await removeNota(nota._docId);
  };

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold uppercase text-slate-900">Diario</h2>
        <button type="button" className={`${btnPrimary} flex items-center gap-2`} onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          Aggiungi nota
        </button>
      </header>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[calc(100vh-12rem)] overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Stato</th>
                <th className={thClass}>Importante</th>
                <th className={thClass}>Titolo</th>
                <th className={thClass}>Testo</th>
                <th className={thClass}>Aggiornata</th>
                <th className={thClass}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className={tdClass}>
                    Caricamento…
                  </td>
                </tr>
              )}
              {!loading && sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className={`${tdClass} text-slate-500`}>
                    Nessuna nota. Usa «Aggiungi nota» per iniziare.
                  </td>
                </tr>
              )}
              {!loading &&
                sorted.map((nota) => {
                  const aperta = nota.aperta !== false;
                  const rowClass = nota.importante
                    ? 'bg-amber-50/90 hover:bg-amber-100/80'
                    : 'hover:bg-slate-50';
                  return (
                    <tr
                      key={nota._docId}
                      className={`cursor-pointer ${rowClass}`}
                      onClick={() => openNota(nota)}
                    >
                      <td className={tdClass}>
                        <span
                          className={`rounded border px-2 py-0.5 text-xs font-semibold uppercase ${
                            aperta
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                              : 'border-slate-300 bg-slate-100 text-slate-600'
                          }`}
                        >
                          {aperta ? 'Aperta' : 'Chiusa'}
                        </span>
                      </td>
                      <td className={tdClass}>
                        {nota.importante ? (
                          <Star
                            className="h-4 w-4 fill-amber-500 text-amber-500"
                            aria-label="Importante"
                          />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className={`${tdClass} font-semibold`}>{nota.titolo || '—'}</td>
                      <td className={`${tdClass} max-w-md text-slate-600`}>
                        {truncate(nota.testo)}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-slate-500`}>
                        {formatTimestamp(nota.aggiornatoIl ?? nota.creatoIl)}
                      </td>
                      <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className={btnSecondary}
                            disabled={saving}
                            onClick={() => openNota(nota)}
                          >
                            Modifica
                          </button>
                          <button
                            type="button"
                            className={btnSecondary}
                            disabled={saving}
                            onClick={() => toggleChiusa(nota, !aperta)}
                          >
                            {aperta ? 'Chiudi nota' : 'Riapri'}
                          </button>
                          <button
                            type="button"
                            className={btnDanger}
                            disabled={saving}
                            onClick={() => handleDeleteRow(nota)}
                          >
                            Elimina
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <DiarioNotaModal
          nota={
            modal.nota?._docId
              ? note.find((n) => n._docId === modal.nota._docId) ?? modal.nota
              : modal.nota
          }
          mode={modal.mode}
          saving={saving}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={
            modal.nota?._docId
              ? async () => {
                  await removeNota(modal.nota._docId);
                }
              : undefined
          }
          onToggleChiusa={
            modal.nota?._docId
              ? async (aperta) => {
                  await toggleChiusa(modal.nota, aperta);
                  setModal((m) =>
                    m?.nota ? { ...m, nota: { ...m.nota, aperta } } : m,
                  );
                }
              : undefined
          }
          onToggleImportante={
            modal.nota?._docId
              ? async (importante) => {
                  await toggleImportante(modal.nota, importante);
                  setModal((m) =>
                    m?.nota ? { ...m, nota: { ...m.nota, importante } } : m,
                  );
                }
              : undefined
          }
          onAllertaPma={
            fullCentrale && modal.mode === 'view' && modal.nota?._docId
              ? async (n) => {
                  await allertaPmaNota(n);
                }
              : undefined
          }
          onBroadcastTelegram={modal.mode === 'view' && modal.nota?._docId ? broadcast : undefined}
          broadcasting={broadcasting}
        />
      )}
    </div>
  );
}
