import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PMA_PAZIENTE_DRAG_MIME,
  buildPostiLetto,
  getPmaPatientDragDocId,
  partitionInCaricoPerPostiLetto,
  pmaHaGrigliaPostiLetto,
} from '../../lib/pmaPostiLetto';
import { assegnaPostoLettoConPresaInCarico, updatePostoLettoLabel } from '../../services/pmaPostoLettoService';
import { notifyPmaDeskError, notifyPmaDeskSoftIssue } from '../../lib/pmaDeskFeedback';
import { PmaInCaricoBedCard } from './PmaInCaricoBedCard';
import { startPmaPatientDrag } from './PmaDeskPatientSummary';
import { inputClass } from '../ui/FormField';

function readDragPatientId(e) {
  return e.dataTransfer.getData(PMA_PAZIENTE_DRAG_MIME) || e.dataTransfer.getData('text/plain');
}

function PostoLettoLabelEditor({ label, onSave, disabled, variant = 'header' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);

  if (!editing) {
    return (
      <button
        type="button"
        className={
          variant === 'header'
            ? 'w-full truncate text-center text-sm font-extrabold uppercase tracking-wide text-white hover:text-violet-100'
            : 'truncate text-left text-xs font-bold uppercase text-slate-700 hover:text-sky-700'
        }
        title="Clic per rinominare il posto letto"
        disabled={disabled}
        onClick={() => {
          setDraft(label);
          setEditing(true);
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <input
      className={`${inputClass} w-full py-1 text-center text-sm font-bold uppercase ${
        variant === 'header' ? 'text-violet-950' : ''
      }`}
      value={draft}
      autoFocus
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        void onSave(draft.trim() || label);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}

function PostoLettoSlot({
  posto,
  paziente,
  evento,
  labelBusy,
  draggingDocId,
  assignBusy,
  onOpenPatient,
  onAssign,
  onSaveLabel,
  onDragPatientStart,
}) {
  const dragId = draggingDocId || getPmaPatientDragDocId();
  const occupiedByOther =
    Boolean(paziente) && Boolean(dragId) && paziente._docId !== dragId;

  const onDragOver = (e) => {
    const liveDragId = draggingDocId || getPmaPatientDragDocId();
    const blocked =
      assignBusy ||
      (Boolean(paziente) && Boolean(liveDragId) && paziente._docId !== liveDragId);
    if (blocked) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (assignBusy) return;
    const docId = readDragPatientId(e);
    if (!docId) return;
    if (paziente && paziente._docId !== docId) return;
    void onAssign(docId, posto.id);
  };

  return (
    <div
      className={`flex min-h-0 flex-col rounded-lg border-2 border-dashed p-1.5 ${
        paziente
          ? occupiedByOther
            ? 'border-slate-300 bg-slate-100/80'
            : 'border-violet-400 bg-violet-50/50'
          : 'border-slate-300 bg-slate-50/90'
      }`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="mb-1.5 rounded-md bg-violet-800 px-2 py-1.5 shadow-sm">
        <PostoLettoLabelEditor
          label={posto.label}
          disabled={labelBusy}
          variant="header"
          onSave={(next) => onSaveLabel(posto.id, next)}
        />
      </div>
      {paziente ? (
        <PmaInCaricoBedCard
          paziente={paziente}
          evento={evento}
          onOpen={() => onOpenPatient(paziente._docId)}
          onDragStart={onDragPatientStart}
        />
      ) : (
        <p className="flex flex-1 items-center justify-center px-1 text-center text-[10px] font-medium leading-snug text-slate-400">
          Trascina paziente qui
        </p>
      )}
    </div>
  );
}

/**
 * Vista griglia posti letto + sezione «Senza letto».
 * L&apos;apertura cartella clinica resta sempre disponibile (non richiede letto).
 */
export function PmaPostiLettoDashboard({
  pma,
  pmaRaw,
  impostazioni,
  manifestationId,
  inCarico,
  eventoFor,
  getPaziente,
  onOpenPatient,
}) {
  const postiLetto = useMemo(() => buildPostiLetto(pmaRaw ?? pma), [pmaRaw, pma]);
  const griglia = pma?.grigliaPostiLetto;
  const { byBed, senzaLetto } = useMemo(
    () => partitionInCaricoPerPostiLetto(inCarico, postiLetto),
    [inCarico, postiLetto],
  );
  const [labelBusy, setLabelBusy] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);
  const [draggingDocId, setDraggingDocId] = useState(null);
  const assignBusyRef = useRef(false);

  useEffect(() => {
    const syncDraggingDocId = () => setDraggingDocId(getPmaPatientDragDocId());
    const clearDraggingDocId = () => setDraggingDocId(null);
    document.addEventListener('dragstart', syncDraggingDocId);
    document.addEventListener('dragend', clearDraggingDocId, true);
    document.addEventListener('drop', clearDraggingDocId, true);
    return () => {
      document.removeEventListener('dragstart', syncDraggingDocId);
      document.removeEventListener('dragend', clearDraggingDocId, true);
      document.removeEventListener('drop', clearDraggingDocId, true);
    };
  }, []);

  const onDragPatientStart = startPmaPatientDrag;

  const handleAssign = async (patientDocId, postoLettoId) => {
    if (assignBusyRef.current) return;
    const paziente = getPaziente?.(patientDocId);
    if (!paziente) return;
    assignBusyRef.current = true;
    setAssignBusy(true);
    try {
      const result = await assegnaPostoLettoConPresaInCarico(
        manifestationId,
        patientDocId,
        postoLettoId,
        paziente,
        inCarico,
      );
      if (result.warning) {
        notifyPmaDeskSoftIssue(
          result.warning,
          'Il paziente è in carico: apri la cartella clinica quando vuoi.',
        );
      }
    } catch (err) {
      notifyPmaDeskError(err?.message ?? 'Errore presa in carico');
    } finally {
      assignBusyRef.current = false;
      setAssignBusy(false);
    }
  };

  const senzaLettoDrop = (e) => {
    e.preventDefault();
    if (assignBusy) return;
    const docId = readDragPatientId(e);
    if (!docId) return;
    void handleAssign(docId, null);
  };

  const handleSaveLabel = async (postoId, label) => {
    setLabelBusy(true);
    try {
      const result = await updatePostoLettoLabel(manifestationId, pma.id, postoId, label, impostazioni);
      if (result.warning) {
        notifyPmaDeskSoftIssue(result.warning, 'I pazienti e la cartella clinica non sono coinvolti.');
      }
    } finally {
      setLabelBusy(false);
    }
  };

  if (!pmaHaGrigliaPostiLetto(pmaRaw ?? pma) || postiLetto.length === 0) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase text-slate-800">
          In carico ({inCarico.length})
        </h2>
        <p className="text-xs text-slate-500">
          Griglia {griglia?.righe}×{griglia?.colonne} — trascina i pazienti sui posti letto
        </p>
      </div>

      <div
        className="grid min-h-0 flex-1 gap-3 overflow-y-auto"
        style={{
          gridTemplateColumns: `repeat(${griglia.colonne}, minmax(0, 1fr))`,
        }}
      >
        {postiLetto.map((posto) => (
          <PostoLettoSlot
            key={posto.id}
            posto={posto}
            paziente={byBed.get(posto.id)}
            evento={byBed.get(posto.id) ? eventoFor(byBed.get(posto.id)) : null}
            labelBusy={labelBusy}
            draggingDocId={draggingDocId}
            assignBusy={assignBusy}
            onOpenPatient={onOpenPatient}
            onAssign={handleAssign}
            onSaveLabel={handleSaveLabel}
            onDragPatientStart={onDragPatientStart}
          />
        ))}
      </div>

      <section
        className="shrink-0 rounded-lg border-2 border-amber-300 bg-amber-50/40 p-2"
        onDragOver={(e) => {
          if (assignBusy) {
            e.dataTransfer.dropEffect = 'none';
            return;
          }
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={senzaLettoDrop}
      >
        <h3 className="mb-2 px-0.5 text-xs font-bold uppercase text-amber-950">
          Senza letto ({senzaLetto.length})
        </h3>
        {senzaLetto.length === 0 ? (
          <p className="px-0.5 text-xs text-slate-500">Nessun paziente senza letto.</p>
        ) : (
          <ul className="pma-senza-letto-grid">
            {senzaLetto.map((p) => (
              <li key={p._docId} className="min-w-0">
                <PmaInCaricoBedCard
                  compact
                  paziente={p}
                  evento={eventoFor(p)}
                  onOpen={() => onOpenPatient(p._docId)}
                  onDragStart={onDragPatientStart}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export { PMA_PAZIENTE_DRAG_MIME };
