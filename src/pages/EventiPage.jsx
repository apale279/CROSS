import { useMemo } from 'react';
import { User } from 'lucide-react';
import { COLLECTIONS } from '../lib/firestorePaths';
import { useManifestazioneCollection } from '../hooks/useManifestazioneCollection';
import { useEventoScheda } from '../context/EventoSchedaContext';
import { ColoreIndicator } from '../components/ui/ColoreIndicator';
import { formatTimestamp } from '../utils/formatters';
import { pazientiPerEvento } from '../lib/eventoLinks';

export default function EventiPage() {
  const { data: eventi, loading: loadingEventi } = useManifestazioneCollection(COLLECTIONS.eventi);
  const { data: pazienti, loading: loadingPazienti } = useManifestazioneCollection(COLLECTIONS.pazienti);
  const { openEventoScheda } = useEventoScheda();
  const loading = loadingEventi || loadingPazienti;

  const pazientiCountByEvento = useMemo(() => {
    const m = new Map();
    for (const ev of eventi) {
      m.set(ev._docId, pazientiPerEvento(pazienti, ev).length);
    }
    return m;
  }, [eventi, pazienti]);

  const sorted = [...eventi].sort((a, b) => {
    const ta = a.apertura?.toMillis?.() ?? 0;
    const tb = b.apertura?.toMillis?.() ?? 0;
    return tb - ta;
  });

  const thClass =
    'bg-slate-100 px-4 py-3 text-left text-xs font-bold uppercase text-slate-600';
  const tdClass = 'border-t border-slate-200 px-4 py-3 text-sm';

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="mb-4 text-xl font-bold uppercase text-slate-900">Eventi</h2>
      <div className="overflow-hidden rounded border border-slate-300 bg-white">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thClass}>ID</th>
              <th className={thClass}>Stato</th>
              <th className={thClass}>Apertura</th>
              <th className={thClass}>Tipo</th>
              <th className={thClass}>Indirizzo</th>
              <th className={`${thClass} w-px whitespace-nowrap`}>Pazienti</th>
              <th className={thClass}>Colore</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className={tdClass} />
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={row._docId}
                  onClick={() => openEventoScheda(row)}
                  className="cursor-pointer hover:bg-sky-50"
                >
                  <td className={`${tdClass} font-mono font-bold`}>{row.idEvento}</td>
                  <td className={tdClass}>
                    {row.stato !== false ? 'Aperto' : 'Chiuso'}
                  </td>
                  <td className={tdClass}>{formatTimestamp(row.apertura)}</td>
                  <td className={tdClass}>{row.tipoEvento}</td>
                  <td className={`${tdClass} max-w-xs truncate`}>{row.indirizzo || '—'}</td>
                  <td className={`${tdClass} text-center`}>
                    <span
                      className="inline-flex items-center justify-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-slate-800"
                      title={`${pazientiCountByEvento.get(row._docId) ?? 0} pazienti collegati a questo evento`}
                    >
                      <User className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={2} aria-hidden />
                      <span className="font-mono text-sm font-bold tabular-nums">
                        {pazientiCountByEvento.get(row._docId) ?? 0}
                      </span>
                      <span className="sr-only">pazienti</span>
                    </span>
                  </td>
                  <td className={tdClass}>
                    <ColoreIndicator colore={row.colore} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
