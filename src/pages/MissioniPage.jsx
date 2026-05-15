import { COLLECTIONS } from '../lib/firestorePaths';
import { useManifestazioneCollection } from '../hooks/useManifestazioneCollection';
import { useEventoScheda } from '../context/EventoSchedaContext';
import { formatTimestamp, statoMissioneBadgeClass } from '../utils/formatters';

export default function MissioniPage() {
  const { data: missioni, loading } = useManifestazioneCollection(COLLECTIONS.missioni);
  const { openEventoScheda } = useEventoScheda();

  const sorted = [...missioni].sort((a, b) => {
    const ta = a.apertura?.toMillis?.() ?? 0;
    const tb = b.apertura?.toMillis?.() ?? 0;
    return tb - ta;
  });

  const thClass =
    'bg-slate-100 px-4 py-3 text-left text-xs font-bold uppercase text-slate-600';
  const tdClass = 'border-t border-slate-200 px-4 py-3 text-sm';

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="mb-4 text-xl font-bold uppercase text-slate-900">Missioni</h2>
      <div className="overflow-hidden rounded border border-slate-300 bg-white">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thClass}>ID</th>
              <th className={thClass}>Stato</th>
              <th className={thClass}>Mezzo</th>
              <th className={thClass}>Evento</th>
              <th className={thClass}>Aperta</th>
              <th className={thClass}>Apertura</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className={tdClass} />
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={row._docId}
                  onClick={() => openEventoScheda(row.eventoIdUnivoco || row.eventoCorrelato)}
                  className="cursor-pointer hover:bg-violet-50"
                >
                  <td className={`${tdClass} font-mono font-bold`}>{row.idMissione}</td>
                  <td className={tdClass}>
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-xs font-bold uppercase ${statoMissioneBadgeClass(row.stato)}`}
                    >
                      {row.stato}
                    </span>
                  </td>
                  <td className={`${tdClass} font-mono`}>{row.mezzo}</td>
                  <td className={`${tdClass} font-mono`}>{row.eventoCorrelato}</td>
                  <td className={tdClass}>{row.aperta !== false ? 'Sì' : 'No'}</td>
                  <td className={tdClass}>{formatTimestamp(row.apertura)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
