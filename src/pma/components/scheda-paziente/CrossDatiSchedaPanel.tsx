import type { Paziente } from '@pma/types/paziente'
import { isPazienteDaCross } from '@pma/types/paziente'

type Props = {
  p: Paziente
}

/** Blocco read-only: dati CROSS senza corrispondenza nei campi PMApp. */
export function CrossDatiSchedaPanel({ p }: Props) {
  if (!isPazienteDaCross(p)) return null

  const testo = (p.cross_dati_scheda ?? '').trim()
  const syncLabel =
    p.external_sync_at && typeof p.external_sync_at.toDate === 'function'
      ? p.external_sync_at.toDate().toLocaleString('it-IT')
      : null

  return (
    <div className="pma-row">
      <div className="pma-field w-full">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <span className="pma-field__label">Dati da CROSS</span>
          {syncLabel ? (
            <span className="text-xs text-slate-500">Ultimo sync: {syncLabel}</span>
          ) : null}
        </div>
        <p className="mb-2 text-xs text-slate-600">
          Informazioni ricevute dalla centrale CROSS (valutazioni, evento, missione e altri campi
          senza corrispondenza in PMApp). Solo lettura.
        </p>
        <textarea
          readOnly
          rows={Math.min(24, Math.max(8, testo.split('\n').length + 2))}
          value={testo || 'Nessun dato aggiuntivo da CROSS.'}
          className="w-full resize-y font-mono text-xs leading-relaxed text-slate-800"
          aria-label="Dati importati da CROSS"
        />
        {p.external_app_id ? (
          <p className="mt-1 font-mono text-[10px] text-slate-500">
            Rif. CROSS: {p.external_app_id}
          </p>
        ) : null}
      </div>
    </div>
  )
}
