import { EO_CLINICAL_TABS, type EoTabKey } from '@pma/lib/multilineList'
import { buildEoRiepilogoLinesFromSelectedByTab } from '@pma/lib/eoPazienteFields'

type Props = {
  selectedByTab: Record<EoTabKey, string[]>
}

/** Riepilogo testuale TIPO + voci selezionate (sotto le note EO). */
export function EoRapidoRiepilogo({ selectedByTab }: Props) {
  const rows = buildEoRiepilogoLinesFromSelectedByTab(selectedByTab)

  if (rows.length === 0) {
    return (
      <p className="mt-2 text-sm italic text-slate-500">Nessuna voce EO rapido selezionata.</p>
    )
  }

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">EO rapido</p>
      <ul className="space-y-1 text-sm leading-snug text-slate-800">
        {rows.map(({ tab, values }) => (
          <li key={tab}>
            <span className="font-bold text-slate-900">{tab}:</span>{' '}
            <span>{values.join(', ')}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
