import type { CodiceColorePaziente } from '@pma/types/paziente'
import { CODICE_COLORE_LABEL } from '@pma/types/paziente'

const CODICI_UI: CodiceColorePaziente[] = ['bianco', 'verde', 'giallo', 'rosso']

function pillClass(c: CodiceColorePaziente, on: boolean): string {
  if (c === 'bianco') return `pma-pill ${on ? 'pma-pill--bianco-on' : 'pma-pill--bianco-off'}`
  if (c === 'verde') return `pma-pill ${on ? 'pma-pill--verde-on' : 'pma-pill--verde-off'}`
  if (c === 'giallo') return `pma-pill ${on ? 'pma-pill--giallo-on' : 'pma-pill--giallo-off'}`
  return `pma-pill ${on ? 'pma-pill--rosso-on' : 'pma-pill--rosso-off'}`
}

type Props = {
  value: CodiceColorePaziente | ''
  canEdit: boolean
  onChange: (c: CodiceColorePaziente) => void
  /** Layout compatto per tab integrata CROSS. */
  compact?: boolean
}

/** Selezione codice colore triage PMA (persiste in `pmaScheda.codice_colore`). */
export function PmaCodiceColoreField({ value, canEdit, onChange, compact = false }: Props) {
  return (
    <div className={compact ? 'space-y-2' : 'pma-row'}>
      <span className={compact ? 'text-xs font-bold uppercase text-slate-600' : 'pma-field__label'}>
        Codice colore
      </span>
      <div
        className={compact ? 'flex flex-wrap gap-2' : 'pma-pills pma-pills--grid'}
        role="group"
        aria-label="Codice colore"
      >
        {CODICI_UI.map((c) => {
          const selected = value === c
          return (
            <button
              key={c}
              type="button"
              disabled={!canEdit}
              aria-pressed={selected}
              onClick={() => onChange(c)}
              className={`pma-theme-skip ${pillClass(c, selected)} ${!canEdit ? 'opacity-40' : ''}`}
            >
              {CODICE_COLORE_LABEL[c]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
