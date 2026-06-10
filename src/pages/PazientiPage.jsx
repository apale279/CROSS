import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { COLLECTIONS } from '../lib/firestorePaths';
import { useManifestazioneCollection } from '../hooks/useManifestazioneCollection';
import { findEvento, missioniPerEvento } from '../lib/eventoLinks';
import { formatTimestamp } from '../utils/formatters';
import { Modal } from '../components/ui/Modal';
import { PazienteScheda } from '../components/pazienti/PazienteScheda';
import {
  displayEventoPazienteInLista,
  isPazienteCodiceMinore,
  isPazienteOriginePma,
  pazienteHaDestinazionePma,
  pazientePassatoDalPma,
  pmaIdPerPaziente,
  statoPzPmaLabel,
} from '../lib/pmaModule';
import { displayAnagraficaCodiceMinore } from '../lib/codiceMinoreTrasportoNome';
import {
  isChiusoCentrale,
  pazienteChiusuraAt,
  pazienteInElencoAperti,
  pazienteInElencoChiusi,
} from '../lib/pazienteStati';
import { usePmaAccess } from '../hooks/usePmaAccess';
import { usePmaFieldUx } from '../pma/hooks/usePmaFieldUx';
import { PazientiMobileList } from '../components/pazienti/PazientiMobileList';

const thClass =
  'bg-slate-100 px-4 py-3 text-left text-xs font-bold uppercase text-slate-600';
const tdClass = 'border-t border-slate-200 px-4 py-3 text-sm';

function pazienteRowClass(paziente) {
  if (!pazientePassatoDalPma(paziente)) {
    return 'cursor-pointer hover:bg-sky-50';
  }
  return 'cursor-pointer border-l-4 border-l-violet-500 bg-violet-50/60 hover:bg-violet-100/70';
}

/** Colonna «Stato»: solo stato trasporto centrale (lo stato tenda è nella colonna PMA). */
function statoCentraleColonna(paziente) {
  if (isPazienteOriginePma(paziente)) return 'Autopresentato';
  return paziente.stato ?? '—';
}

/** Colonna «Centrale»: aperto/chiuso lato centrale; vuota se non c'è percorso centrale. */
function centraleApertoChiusoLabel(paziente) {
  if (isPazienteOriginePma(paziente)) return '';
  if (isPazienteCodiceMinore(paziente) && !paziente.stato) return '';
  return isChiusoCentrale(paziente) ? 'Chiuso' : 'Aperto';
}

/** Colonna «Ospedale»: destinazione se presente, altrimenti vuota. */
function ospedaleColonna(paziente) {
  return String(
    paziente.ospedaleDestinazione ?? paziente.pmaScheda?.invio_ps_ospedale ?? '',
  ).trim();
}

/** Colonna «PMA»: stato in tenda; vuota se il paziente non passa dal PMA. */
function statoPmaColonna(paziente) {
  if (isPazienteCodiceMinore(paziente)) {
    return statoPzPmaLabel(paziente.statoPzPma) ?? 'Codice minore';
  }
  if (isPazienteOriginePma(paziente)) {
    return statoPzPmaLabel(paziente.statoPzPma) ?? '—';
  }
  if (!pazienteHaDestinazionePma(paziente)) return '';
  return statoPzPmaLabel(paziente.statoPzPma) ?? 'In attesa mezzo';
}

function PazientiTable({ rows, eventi, onRow, emptyLabel }) {
  return (
    <div className="overflow-hidden rounded border border-slate-300 bg-white">
      <table className="w-full">
        <thead>
          <tr>
            <th className={thClass}>ID</th>
            <th className={thClass}>Cognome / nome</th>
            <th className={thClass}>Evento</th>
            <th className={thClass}>Stato</th>
            <th className={thClass}>Esito</th>
            <th className={thClass}>Centrale</th>
            <th className={thClass}>Ospedale</th>
            <th className={thClass}>PMA</th>
            <th className={thClass}>Apertura</th>
            <th className={thClass}>Chiusura</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} className={`${tdClass} text-slate-500`}>
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const ev = findEvento(eventi, row.eventoIdUnivoco ?? row.eventoCorrelato);
              const label = displayEventoPazienteInLista(row, ev);
              const centrale = centraleApertoChiusoLabel(row);
              return (
                <tr key={row._docId} onClick={() => onRow(row)} className={pazienteRowClass(row)}>
                  <td className={`${tdClass} font-mono font-bold`}>{row.idPaziente}</td>
                  <td className={tdClass}>
                    {isPazienteCodiceMinore(row)
                      ? displayAnagraficaCodiceMinore(row)
                      : [row.cognome, row.nome].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className={`${tdClass} font-mono`}>{label}</td>
                  <td className={tdClass}>{statoCentraleColonna(row)}</td>
                  <td className={`${tdClass} max-w-[140px] truncate`}>{row.esito || '—'}</td>
                  <td
                    className={`${tdClass} font-semibold ${
                      centrale === 'Aperto' ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {centrale}
                  </td>
                  <td className={`${tdClass} max-w-[160px] truncate`}>{ospedaleColonna(row)}</td>
                  <td className={tdClass}>{statoPmaColonna(row)}</td>
                  <td className={tdClass}>{formatTimestamp(row.apertura)}</td>
                  <td className={tdClass}>{formatTimestamp(pazienteChiusuraAt(row))}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function PazientiPage() {
  const navigate = useNavigate();
  const fieldUx = usePmaFieldUx();
  const { scopeId } = usePmaAccess();
  const { data: pazienti, loading: loadingP } = useManifestazioneCollection(COLLECTIONS.pazienti);
  const { data: eventi } = useManifestazioneCollection(COLLECTIONS.eventi);
  const { data: missioni } = useManifestazioneCollection(COLLECTIONS.missioni);

  const aperti = useMemo(
    () => [...pazienti].filter(pazienteInElencoAperti).sort(sortByApertura),
    [pazienti],
  );
  const chiusi = useMemo(
    () => [...pazienti].filter(pazienteInElencoChiusi).sort(sortByChiusura),
    [pazienti],
  );

  const [selected, setSelected] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId || loadingP) return;
    const p = pazienti.find((x) => x._docId === openId);
    if (p) setSelected(p);
    setSearchParams({}, { replace: true });
  }, [searchParams, pazienti, loadingP, setSearchParams]);

  const eventoForPaziente = (p) => {
    const ev = findEvento(eventi, p.eventoIdUnivoco ?? p.eventoCorrelato);
    if (ev) return ev;
    return {
      _docId: '',
      idEvento: p.eventoCorrelato || '?',
      idUnivoco: p.eventoIdUnivoco || '',
      stato: false,
    };
  };

  const handleRow = (p) => {
    if (fieldUx && scopeId && pazienteHaDestinazionePma(p)) {
      const pid = pmaIdPerPaziente(p) || scopeId;
      navigate(`/pma/${encodeURIComponent(pid)}/paziente/${encodeURIComponent(p._docId)}?tab=cartella`);
      return;
    }
    setSelected(p);
  };

  const List = fieldUx ? PazientiMobileList : PazientiTable;

  return (
    <div className={`mx-auto max-w-6xl ${fieldUx ? 'px-3 pb-4' : 'pb-8'}`}>
      <h2 className={`font-bold uppercase text-slate-900 ${fieldUx ? 'mb-2 text-lg' : 'mb-4 text-xl'}`}>
        Pazienti
      </h2>
      {fieldUx && scopeId ? (
        <p className="mb-3 text-xs text-slate-600">
          Per compilare la cartella usa il{' '}
          <Link to={`/pma/${encodeURIComponent(scopeId)}`} className="font-semibold text-sky-700 underline">
            desk PMA
          </Link>
          . Qui puoi cercare e aprire una scheda.
        </p>
      ) : null}

      {loadingP ? (
        <p className="text-sm text-slate-600">Caricamento…</p>
      ) : (
        <div className="space-y-10">
          <p className="text-xs text-slate-500">
            Le righe con bordo viola indicano i pazienti passati dal PMA (inviati, autopresentati,
            codici minori o già dimessi in tenda).
          </p>
          <section>
            <h3 className="mb-3 text-sm font-bold uppercase text-sky-800">Aperti</h3>
            <List
              rows={aperti}
              eventi={eventi}
              onRow={handleRow}
              emptyLabel="Nessun paziente aperto."
            />
          </section>
          <section>
            <h3 className="mb-1 text-sm font-bold uppercase text-slate-600">Chiusi</h3>
            <p className="mb-3 text-xs text-slate-500">
              Chiusi per centrale e PMA (dimissione completata). Chi è in tenda dopo ARRIVATO H
              resta in «Aperti» finché non è dimesso dal PMA.
            </p>
            <List
              rows={chiusi}
              eventi={eventi}
              onRow={handleRow}
              emptyLabel="Nessun paziente chiuso."
            />
          </section>
        </div>
      )}

      {selected && (
        <Modal
          title={`Paziente ${selected.idPaziente}`}
          onClose={() => setSelected(null)}
          scheda
        >
          <PazienteScheda
            evento={eventoForPaziente(selected)}
            paziente={selected}
            missioniEvento={missioniPerEvento(missioni, eventoForPaziente(selected))}
            allPazienti={pazienti}
            onClose={() => setSelected(null)}
            onSaved={() => {}}
          />
        </Modal>
      )}
    </div>
  );
}

function sortByApertura(a, b) {
  const ta = a.apertura?.toMillis?.() ?? 0;
  const tb = b.apertura?.toMillis?.() ?? 0;
  return tb - ta;
}

/** Chiusi: dalla chiusura più recente alla più remota (fallback apertura). */
function sortByChiusura(a, b) {
  const ta = pazienteChiusuraAt(a)?.toMillis?.() ?? a.apertura?.toMillis?.() ?? 0;
  const tb = pazienteChiusuraAt(b)?.toMillis?.() ?? b.apertura?.toMillis?.() ?? 0;
  return tb - ta;
}
