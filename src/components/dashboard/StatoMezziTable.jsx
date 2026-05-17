import { mezzoStazionamentoLabel } from '../../lib/mezzoDisplay';
import { mezzoRowClass } from '../../utils/formatters';

const thClass =
  'sticky top-0 z-10 bg-slate-100/95 px-3 py-2 text-left text-xs font-bold uppercase text-slate-600 backdrop-blur';
const tdClass = 'border-t border-slate-200/80 px-3 py-2 text-sm text-slate-900';

export function StatoMezziTable({ loading, mezzi, readOnly = false, onOpenMezzo }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className={thClass}>Sigla</th>
          <th className={thClass}>Stazionamento</th>
          <th className={thClass}>Tipo</th>
          <th className={thClass}>Stato</th>
          <th className={thClass}>Operativo</th>
        </tr>
      </thead>
      <tbody>
        {loading && (
          <tr>
            <td colSpan={5} className={tdClass} />
          </tr>
        )}
        {!loading &&
          mezzi.map((m) => {
            const sigla = m.sigla ?? m._docId;
            const stazionamento = mezzoStazionamentoLabel(m);
            const interactive = Boolean(onOpenMezzo);
            return (
              <tr
                key={sigla}
                onClick={interactive ? () => onOpenMezzo(m) : undefined}
                className={`${mezzoRowClass(m)} ${interactive ? 'cursor-pointer' : ''}`}
              >
                <td className={`${tdClass} font-mono font-bold`}>{sigla}</td>
                <td className={`${tdClass} max-w-[12rem] text-xs text-slate-700`}>
                  {stazionamento || '—'}
                </td>
                <td className={tdClass}>{m.tipo}</td>
                <td className={tdClass}>
                  <span
                    className={`font-semibold ${
                      (m.statoMezzo ?? 'Disponibile') === 'Disponibile'
                        ? 'text-emerald-800'
                        : 'text-slate-600'
                    }`}
                  >
                    {m.statoMezzo ?? 'Disponibile'}
                  </span>
                </td>
                <td className={tdClass}>
                  <span
                    className={
                      m.operativo !== false
                        ? 'font-semibold text-emerald-800'
                        : 'font-semibold text-red-800'
                    }
                  >
                    {m.operativo !== false ? 'Sì' : 'No'}
                  </span>
                </td>
              </tr>
            );
          })}
      </tbody>
    </table>
  );
}
