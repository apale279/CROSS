import { formatTimestamp } from '../../utils/formatters';
import { STATO_PZ_PMA_LABEL, TIPO_PZ } from '../../lib/pmaModule';

export function PmaPatientReadonlyCard({ paziente, pmaNome, highlight, onOpen }) {
  const readonly = paziente.tipoPz === TIPO_PZ.CENTRALE;
  const statoPma = paziente.statoPzPma
    ? STATO_PZ_PMA_LABEL[paziente.statoPzPma] ?? paziente.statoPzPma
    : '—';

  const inner = (
    <article
      className={`rounded-lg border bg-white p-4 text-sm shadow-sm ${
        highlight ? 'border-violet-400 ring-2 ring-violet-200' : 'border-slate-200'
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-mono font-bold text-teal-800">{paziente.idPaziente}</span>
        {readonly && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
            Da centrale
          </span>
        )}
        <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-900">
          {statoPma}
        </span>
        {highlight && (
          <span className="ml-auto text-xs font-bold text-violet-700">Apri scheda PMA →</span>
        )}
      </div>
      <p className="font-semibold text-slate-900">
        {[paziente.cognome, paziente.nome].filter(Boolean).join(' ') || 'Senza nome'}
      </p>
      <dl className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
        <div>Pettorale: {paziente.pettorale ?? '—'}</div>
        <div>Mezzo: {paziente.mezzo || '—'}</div>
        <div>Stato centrale: {paziente.stato ?? '—'}</div>
        <div>PMA: {pmaNome ?? paziente.ospedaleDestinazione ?? '—'}</div>
        <div>Evento: {paziente.eventoCorrelato || '—'}</div>
        <div>Apertura: {formatTimestamp(paziente.apertura)}</div>
      </dl>
      {paziente.notePaziente && (
        <p className="mt-2 whitespace-pre-wrap text-xs text-slate-700">{paziente.notePaziente}</p>
      )}
    </article>
  );

  if (onOpen) {
    return (
      <button type="button" className="w-full text-left" onClick={onOpen}>
        {inner}
      </button>
    );
  }

  return inner;
}
