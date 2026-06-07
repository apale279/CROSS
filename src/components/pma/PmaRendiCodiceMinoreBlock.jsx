import { PmaRendiCodiceMinoreButton } from './PmaRendiCodiceMinoreButton';

/** Blocco «Rendi codice minore» (dashboard o anagrafica PMA). */
export function PmaRendiCodiceMinoreBlock({ busy, onClick, compact = false }) {
  return (
    <div className={compact ? 'mt-2' : 'border-t border-slate-200 pt-4'}>
      {!compact ? (
        <>
          <p className="mb-2 text-xs font-bold uppercase text-violet-800">Codice minore (fast track)</p>
          <p className="mb-3 text-xs text-slate-600">
            Invia il paziente in astanteria senza aprire la cartella clinica. Evento, missione e dati
            centrale restano archiviati sul paziente.
          </p>
        </>
      ) : null}
      <PmaRendiCodiceMinoreButton busy={busy} className="max-w-xs" onClick={onClick} />
    </div>
  );
}
