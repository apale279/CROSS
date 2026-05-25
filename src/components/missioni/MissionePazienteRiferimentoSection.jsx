import { btnSecondary } from '../ui/FormField';

function line(ref) {
  const nome = [ref.cognome, ref.nome].filter(Boolean).join(' ');
  return nome || ref.idPaziente || '—';
}

/** Paziente dimesso PMA: snapshot sulla missione, non collegamento operativo. */
export function MissionePazienteRiferimentoSection({ riferimento, onOpenPaziente }) {
  if (!riferimento?.docId) return null;

  return (
    <section className="rounded border border-violet-200 bg-violet-50/60 p-3">
      <p className="mb-2 text-xs font-bold uppercase text-violet-900">
        Paziente di riferimento (PMA → PS, non collegato)
      </p>
      <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
        <div>
          <p className="font-semibold text-slate-900">{line(riferimento)}</p>
          <p className="mt-0.5 font-mono text-xs text-slate-600">
            ID {riferimento.idPaziente ?? '—'}
            {riferimento.ospedaleDestinazione
              ? ` → ${riferimento.ospedaleDestinazione}`
              : ''}
          </p>
          {riferimento.originePmaNome && (
            <p className="mt-0.5 text-xs text-slate-500">Da PMA: {riferimento.originePmaNome}</p>
          )}
        </div>
        {onOpenPaziente && (
          <button
            type="button"
            className={btnSecondary}
            onClick={() =>
              onOpenPaziente({
                _docId: riferimento.docId,
                idPaziente: riferimento.idPaziente,
                idUnivoco: riferimento.idUnivoco,
                cognome: riferimento.cognome,
                nome: riferimento.nome,
              })
            }
          >
            Apri scheda paziente
          </button>
        )}
      </div>
    </section>
  );
}
