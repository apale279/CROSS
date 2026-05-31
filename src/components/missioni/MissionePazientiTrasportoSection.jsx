import { Link } from 'react-router-dom';
import { btnSecondary } from '../ui/FormField';
import { formatTimestamp } from '../../utils/formatters';
import {
  isPazienteCodiceMinore,
  pazienteHaDestinazionePma,
  pmaIdPerPaziente,
} from '../../lib/pmaModule';
import { displayAnagraficaCodiceMinore } from '../../lib/codiceMinoreTrasportoNome';

function anagraficaLine(p) {
  if (isPazienteCodiceMinore(p)) return displayAnagraficaCodiceMinore(p);
  const nome = [p.cognome, p.nome].filter(Boolean).join(' ');
  if (nome) return nome;
  if (p.pettorale != null) return `Pettorale ${p.pettorale}`;
  return p.idPaziente ?? '—';
}

function anagraficaDetail(p) {
  const bits = [];
  if (p.pettorale != null) bits.push(`Pett. ${p.pettorale}`);
  if (p.eta != null && p.eta !== '') bits.push(`${p.eta} anni`);
  if (p.sesso) bits.push(p.sesso);
  if (p.dataNascita) bits.push(`Nasc. ${p.dataNascita}`);
  if (p.telefono) bits.push(p.telefono);
  return bits.join(' · ') || '—';
}

function schedaHref(p) {
  if (isPazienteCodiceMinore(p)) return null;
  const pmaId = pmaIdPerPaziente(p);
  if ((pazienteHaDestinazionePma(p) || p.tipoPz === 'PMA') && pmaId) {
    return `/pma/${encodeURIComponent(pmaId)}/paziente/${encodeURIComponent(p._docId)}`;
  }
  return `/pazienti?open=${encodeURIComponent(p._docId)}`;
}

export function MissionePazientiTrasportoSection({ pazienti, onOpenPaziente }) {
  if (!pazienti?.length) return null;

  return (
    <section className="rounded border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-bold uppercase text-slate-600">
        Pazienti in trasporto ({pazienti.length})
      </p>
      <ul className="space-y-2">
        {pazienti.map((p) => {
          const href = schedaHref(p);
          return (
            <li key={p._docId} className="rounded border border-slate-200 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{anagraficaLine(p)}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{anagraficaDetail(p)}</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">
                    ID {p.idPaziente ?? '—'}
                    {p.esito ? ` · ${p.esito}` : ''}
                    {p.ospedaleDestinazione ? ` → ${p.ospedaleDestinazione}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {href ? (
                    onOpenPaziente ? (
                      <button
                        type="button"
                        className={btnSecondary}
                        onClick={() => onOpenPaziente(p)}
                      >
                        Apri scheda
                      </button>
                    ) : (
                      <Link to={href} className={btnSecondary}>
                        Apri scheda
                      </Link>
                    )
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
