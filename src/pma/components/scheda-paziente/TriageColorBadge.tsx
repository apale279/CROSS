import type { CodiceColorePaziente } from '@pma/types/paziente'
import { CODICE_COLORE_LABEL } from '@pma/types/paziente'

const DOT: Record<CodiceColorePaziente, string> = {
  bianco: 'bg-white ring-2 ring-slate-300 ring-inset',
  verde: 'bg-emerald-500 ring-1 ring-emerald-700/30',
  giallo: 'bg-amber-400 ring-1 ring-amber-600/40',
  rosso: 'bg-red-600 ring-1 ring-red-800/40',
}

const MINI: Record<CodiceColorePaziente, string> = {
  bianco: 'bg-slate-400',
  verde: 'bg-emerald-600',
  giallo: 'bg-amber-500',
  rosso: 'bg-red-600',
}

const PILL: Record<CodiceColorePaziente, string> = {
  bianco: 'bg-slate-100 text-slate-800 ring-1 ring-slate-300',
  verde: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-600/25',
  giallo: 'bg-amber-100 text-amber-950 ring-1 ring-amber-500/30',
  rosso: 'bg-red-100 text-red-900 ring-1 ring-red-600/25',
}

type Props = {
  codice: CodiceColorePaziente
  /** `dot` = cerchio colore; `pill` = etichetta con testo */
  variant?: 'dot' | 'pill'
  className?: string
}

export function TriageColorBadge({ codice, variant = 'pill', className = '' }: Props) {
  if (variant === 'dot') {
    return (
      <span
        className={`inline-flex h-3.5 w-3.5 shrink-0 rounded-full ${DOT[codice]} ${className}`}
        title={CODICE_COLORE_LABEL[codice]}
        aria-hidden
      />
    )
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${PILL[codice]} ${className}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${MINI[codice]}`} aria-hidden />
      {CODICE_COLORE_LABEL[codice]}
    </span>
  )
}
