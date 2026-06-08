import { CODICE_COLORE_LABEL } from '../../pma/types/paziente';
import { formatTimestamp } from '../../utils/formatters';
import { displayNomePazientePma } from '../../lib/pmaDisplayName';
import { mostraPettoralePazientePma } from '../../lib/pmaDeskPatientInfo';
import { pmaCodiceColoreCardClass } from '../../lib/pmaCodiceColoreUi';
import { PmaAvanzamentoBadge } from './PmaAvanzamentoBadge';
import { PmaOrigineEmoji } from './PmaOrigineEmoji';
import { PmaPettoraleBadge } from './PmaPettoraleBadge';

export function PmaInCaricoCard({ paziente, evento, onOpen }) {
  const colore = paziente.pmaScheda?.codice_colore ?? 'verde';
  const coloreClass = pmaCodiceColoreCardClass(paziente);
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
      className={`pma-patient-card w-full rounded-lg border-2 p-4 text-left shadow-sm transition hover:shadow-md ${coloreClass}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="pma-patient-card__label font-bold uppercase text-slate-700">
          {CODICE_COLORE_LABEL[colore] ?? colore}
        </span>
        <span className="pma-patient-card__label font-mono text-slate-500">{paziente.idPaziente}</span>
        <PmaOrigineEmoji paziente={paziente} />
        <PmaAvanzamentoBadge paziente={paziente} />
      </div>
      <p className="flex min-w-0 items-center gap-2 font-bold text-slate-900">
        {mostraPettoralePazientePma(paziente) ? (
          <PmaPettoraleBadge
            pettorale={paziente.pettorale}
            className="pma-patient-card__name-lg shrink-0 px-1.5 py-0.5 font-bold normal-case tracking-normal"
          />
        ) : null}
        <span className="pma-patient-card__name-lg min-w-0 truncate">
          {displayNomePazientePma(paziente)}
        </span>
      </p>
      <p className="pma-patient-card__name mt-1 text-slate-700">
        {tipoEv}
        {dettaglioEv ? ` — ${dettaglioEv}` : ''}
      </p>
      <dl className="pma-patient-card__label mt-3 grid gap-1 text-slate-600 sm:grid-cols-2">
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
      <p className="pma-patient-card__label mt-2 font-bold text-violet-800">Apri scheda PMA →</p>
    </button>
  );
}
