import { useMemo, useState } from 'react';
import { COLLECTIONS } from '../lib/firestorePaths';
import { useManifestazioneCollection } from '../hooks/useManifestazioneCollection';
import { findEvento, missioniPerEvento } from '../lib/eventoLinks';
import { formatTimestamp } from '../utils/formatters';
import { Modal } from '../components/ui/Modal';
import { PazienteScheda } from '../components/pazienti/PazienteScheda';

const thClass =
  'bg-slate-100 px-4 py-3 text-left text-xs font-bold uppercase text-slate-600';
const tdClass = 'border-t border-slate-200 px-4 py-3 text-sm';

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
            <th className={thClass}>Apertura</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className={`${tdClass} text-slate-500`}>
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const ev = findEvento(eventi, row.eventoIdUnivoco ?? row.eventoCorrelato);
              const label = ev?.idEvento ?? row.eventoCorrelato ?? '—';
              return (
                <tr
                  key={row._docId}
                  onClick={() => onRow(row)}
                  className="cursor-pointer hover:bg-sky-50"
                >
                  <td className={`${tdClass} font-mono font-bold`}>{row.idPaziente}</td>
                  <td className={tdClass}>
                    {[row.cognome, row.nome].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className={`${tdClass} font-mono`}>{label}</td>
                  <td className={tdClass}>{row.stato ?? '—'}</td>
                  <td className={`${tdClass} max-w-[140px] truncate`}>{row.esito || '—'}</td>
                  <td className={tdClass}>{formatTimestamp(row.apertura)}</td>
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
  const { data: pazienti, loading: loadingP } = useManifestazioneCollection(COLLECTIONS.pazienti);
  const { data: eventi } = useManifestazioneCollection(COLLECTIONS.eventi);
  const { data: missioni } = useManifestazioneCollection(COLLECTIONS.missioni);

  const aperti = useMemo(
    () =>
      [...pazienti].filter((p) => p.aperta !== false).sort(sortByApertura),
    [pazienti],
  );
  const chiusi = useMemo(
    () =>
      [...pazienti].filter((p) => p.aperta === false).sort(sortByApertura),
    [pazienti],
  );

  const [selected, setSelected] = useState(null);

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

  const handleRow = (p) => setSelected(p);

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <h2 className="mb-4 text-xl font-bold uppercase text-slate-900">Pazienti</h2>

      {loadingP ? (
        <p className="text-sm text-slate-600">Caricamento…</p>
      ) : (
        <div className="space-y-10">
          <section>
            <h3 className="mb-3 text-sm font-bold uppercase text-sky-800">Aperti</h3>
            <PazientiTable
              rows={aperti}
              eventi={eventi}
              onRow={handleRow}
              emptyLabel="Nessun paziente aperto."
            />
          </section>
          <section>
            <h3 className="mb-3 text-sm font-bold uppercase text-slate-600">Chiusi</h3>
            <PazientiTable
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
          wide
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
