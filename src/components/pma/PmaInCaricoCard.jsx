import { CODICE_COLORE_LABEL } from '../../pma/types/paziente';
import { pazienteNomeDisplay, pazientePettoraleDisplay } from '../../lib/pazienteDisplay';
import { formatTimestamp } from '../../utils/formatters';

const COLORE_CLASS = {
  bianco: 'bg-slate-100 border-slate-300',
  verde: 'bg-emerald-50 border-emerald-400',
  giallo: 'bg-amber-50 border-amber-400',
  rosso: 'bg-red-50 border-red-500',
};

export function PmaInCaricoCard({ paziente, evento, onOpen }) {
  const pettorale = pazientePettoraleDisplay(paziente);
  const colore = paziente.pmaScheda?.codice_colore ?? 'verde';
  const coloreClass = COLORE_CLASS[colore] ?? COLORE_CLASS.verde;
  const ingresso =
    paziente.pmaScheda?.ingresso_carico_at ??
    paziente.arrivatoHAt ??
    paziente.apertura;
  const tipoEv =
    paziente.pmaScheda?.tipo_evento ||
    evento?.tipoEvento ||
    '—';
  const dettaglioEv =
    paziente.pmaScheda?.dettaglio_evento ||
    evento?.dettaglioEvento ||
    '';

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full rounded-lg border-2 p-4 text-left shadow-sm transition hover:shadow-md ${coloreClass}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-full border border-black/20"
          style={{
            background:
              colore === 'rosso'
                ? '#dc2626'
                : colore === 'giallo'
                  ? '#eab308'
                  : colore === 'verde'
                    ? '#16a34a'
                    : '#f8fafc',
          }}
          aria-hidden
        />
        <span className="text-xs font-bold uppercase text-slate-700">
          {CODICE_COLORE_LABEL[colore] ?? colore}
        </span>
        <span className="font-mono text-xs text-slate-500">{paziente.idPaziente}</span>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2 text-lg font-bold text-slate-900">
        <span>{pazienteNomeDisplay(paziente)}</span>
        {pettorale != null ? (
          <span className="font-mono text-sm font-bold text-teal-800">#{pettorale}</span>
        ) : null}
      </p>
      <p className="mt-1 text-sm text-slate-700">
        {tipoEv}
        {dettaglioEv ? ` — ${dettaglioEv}` : ''}
      </p>
      <dl className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
        <div>
          <span className="font-medium">Ingresso: </span>
          {formatTimestamp(ingresso)}
        </div>
        <div>
          <span className="font-medium">Evento: </span>
          {paziente.eventoCorrelato || evento?.idEvento || '—'}
        </div>
        <div>
          <span className="font-medium">Medico rif.: </span>
          {paziente.pmaScheda?.medico_rif || '—'}
        </div>
        <div>
          <span className="font-medium">Infermiere rif.: </span>
          {paziente.pmaScheda?.infermiere_rif || '—'}
        </div>
      </dl>
      <p className="mt-2 text-xs font-bold text-violet-800">Apri scheda PMA →</p>
    </button>
  );
}
