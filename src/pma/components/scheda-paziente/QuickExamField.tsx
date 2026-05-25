import { useEffect, useMemo, useRef } from 'react'
import { EO_CLINICAL_TABS, type EoTabKey } from '@pma/lib/multilineList'
import { toggleEoQuickSelection } from '@pma/lib/eoQuickSelection'
import { EO_OPZIONI_RAPIDE } from '@pma/types/cartellaClinica'
import { EoRapidoTypeDropdown } from './EoRapidoTypeDropdown'
import { EoRapidoRiepilogo } from './EoRapidoRiepilogo'

export type EoQuickGroup = { title: string; labels: readonly string[] }

type PropsGrouped = {
  note: string
  disabled?: boolean
  gruppiRapidi: readonly EoQuickGroup[]
  selectedByTab: Record<EoTabKey, string[]>
  onColumnSelectionChange: (tab: EoTabKey, baseAtOpen: string[], draft: string[]) => void
  onNoteBlur: (text: string) => void
  opzioniRapide?: undefined
  selected?: undefined
  onSelectionChange?: undefined
  defaultQuickSelection?: undefined
}

type PropsFlat = {
  note: string
  disabled?: boolean
  opzioniRapide?: readonly string[]
  gruppiRapidi?: undefined
  selected: string[]
  onSelectionChange: (next: string[]) => void
  defaultQuickSelection?: string | null
  onNoteBlur: (text: string) => void
  selectedByTab?: undefined
  onColumnSelectionChange?: undefined
}

export type QuickExamFieldProps = PropsGrouped | PropsFlat

function isGroupedMode(p: QuickExamFieldProps): p is PropsGrouped {
  return Boolean(p.gruppiRapidi?.length && p.selectedByTab && p.onColumnSelectionChange)
}

/** EO rapido: menu a tendina multiselect per ogni area clinica, sopra le note. */
export function QuickExamField(props: QuickExamFieldProps) {
  const grouped = isGroupedMode(props)
  const { note, disabled, onNoteBlur } = props

  const appliedDefaultFlatRef = useRef(false)

  const flatLabels = useMemo(() => {
    if (grouped) return [] as string[]
    const flat = props as PropsFlat
    return flat.opzioniRapide?.length ? [...flat.opzioniRapide] : [...EO_OPZIONI_RAPIDE]
  }, [grouped, props])

  const labelsKey = flatLabels.join('\0')
  const flatSelected = grouped ? [] : (props as PropsFlat).selected
  const defaultQuickSelection = grouped ? null : (props as PropsFlat).defaultQuickSelection

  useEffect(() => {
    if (grouped) return
    const flat = props as PropsFlat
    if (disabled || appliedDefaultFlatRef.current) return
    if (flatSelected.length > 0) return
    const d = defaultQuickSelection?.trim()
    if (!d) return
    if (!flatLabels.includes(d)) return
    appliedDefaultFlatRef.current = true
    flat.onSelectionChange([d])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouped, disabled, flatSelected.length, defaultQuickSelection, labelsKey])

  const chipFlat = (on: boolean) =>
    on
      ? 'rounded-full bg-sky-600 px-3 py-1 text-xs font-medium text-white ring-1 ring-sky-600/10 disabled:opacity-50'
      : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800 ring-1 ring-slate-600/15 hover:bg-slate-200 disabled:opacity-50'

  if (grouped) {
    const { gruppiRapidi, selectedByTab, onColumnSelectionChange } = props

    return (
      <div className="space-y-3">
        <div>
          <p className="pma-field__label mb-2">EO rapido</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {gruppiRapidi.map((g) => {
              const tab = g.title as EoTabKey
              if (!EO_CLINICAL_TABS.includes(tab)) return null
              return (
                <EoRapidoTypeDropdown
                  key={g.title}
                  tab={tab}
                  title={g.title}
                  labels={g.labels}
                  selected={selectedByTab[tab] ?? []}
                  disabled={disabled}
                  onChange={(baseAtOpen, draft) => onColumnSelectionChange(tab, baseAtOpen, draft)}
                />
              )
            })}
          </div>
        </div>
        <label className="pma-field">
          <span className="pma-field__label">Note esame obiettivo</span>
          <textarea
            disabled={disabled}
            rows={3}
            defaultValue={note}
            onBlur={(e) => onNoteBlur(e.target.value)}
          />
        </label>
        <EoRapidoRiepilogo selectedByTab={selectedByTab} />
      </div>
    )
  }

  const flat = props as PropsFlat
  const set = new Set(flat.selected)
  return (
    <div className="space-y-2">
      <div>
        <div className="flex flex-wrap gap-2">
          {flatLabels.map((label) => {
            const on = set.has(label)
            return (
              <button
                key={label}
                type="button"
                disabled={disabled}
                onClick={() => {
                  flat.onSelectionChange(toggleEoQuickSelection(flat.selected, label))
                }}
                className={`pma-theme-skip ${chipFlat(on)}`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
      <label className="pma-field">
        <span className="pma-field__label">Note esame obiettivo</span>
        <textarea
          disabled={disabled}
          rows={3}
          defaultValue={note}
          onBlur={(e) => onNoteBlur(e.target.value)}
        />
      </label>
    </div>
  )
}
