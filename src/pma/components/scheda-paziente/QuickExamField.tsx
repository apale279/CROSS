import { useEffect, useMemo, useRef, useState } from 'react'
import { EO_CLINICAL_TABS, type EoTabKey } from '@pma/lib/multilineList'
import { nessunaEoOptionDisabled, toggleEoQuickFirstDefaultExclusive, toggleEoQuickSelection, defaultEoLabelForColumn } from '@pma/lib/eoQuickSelection'
import { EO_OPZIONI_RAPIDE } from '@pma/types/cartellaClinica'

export type EoQuickGroup = { title: string; labels: readonly string[] }

type PropsGrouped = {
  note: string
  disabled?: boolean
  gruppiRapidi: readonly EoQuickGroup[]
  selectedByTab: Record<EoTabKey, string[]>
  onColumnSelectionChange: (tab: EoTabKey, next: string[]) => void
  onNoteBlur: (text: string) => void
  infermiereMobileEOPopup?: boolean
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

/** EO rapido: tabella con intestazione per categoria e valori multiselect sotto. Default «NELLA NORMA». */
export function QuickExamField(props: QuickExamFieldProps) {
  const grouped = isGroupedMode(props)
  const { note, disabled, onNoteBlur } = props
  const [eoOpen, setEoOpen] = useState(false)

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

  const chipColumn = (on: boolean) =>
    on
      ? 'w-full rounded border border-slate-800 bg-slate-900 px-2 py-1.5 text-left text-sm font-medium leading-snug text-white shadow-sm disabled:opacity-50'
      : 'w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-sm font-medium leading-snug text-slate-800 hover:border-slate-300 hover:bg-white disabled:opacity-50'

  const chipFlat = (on: boolean) =>
    on
      ? 'rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white ring-1 ring-slate-900/10 disabled:opacity-50'
      : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800 ring-1 ring-slate-600/15 hover:bg-slate-200 disabled:opacity-50'

  if (grouped) {
    const { gruppiRapidi, selectedByTab, onColumnSelectionChange, infermiereMobileEOPopup } = props

    const renderColumnButtons = (g: EoQuickGroup, tab: EoTabKey, keySuffix: string) => {
      const colSelected = selectedByTab[tab] ?? []
      const set = new Set(colSelected)
      const defaultLabel = defaultEoLabelForColumn(g.labels)
      if (g.labels.length === 0) {
        return <span className="px-1 py-2 text-center text-xs text-slate-400">—</span>
      }
      return g.labels.map((label) => {
        const on = set.has(label)
        const chipDisabled = nessunaEoOptionDisabled(disabled, colSelected, label)
        return (
          <button
            key={`${g.title}-${label}${keySuffix}`}
            type="button"
            disabled={chipDisabled}
            onClick={() => {
              onColumnSelectionChange(
                tab,
                toggleEoQuickFirstDefaultExclusive(colSelected, label, defaultLabel),
              )
            }}
            className={`pma-theme-skip ${chipColumn(on)}`}
          >
            {label}
          </button>
        )
      })
    }

    const eoGrid = (
      <div className="mt-2 overflow-x-auto">
        <table
          className="min-w-full border-collapse text-sm"
          role="grid"
          aria-label="Opzioni rapide esame obiettivo per categoria"
        >
          <thead>
            <tr>
              {gruppiRapidi.map((g) => {
                const tab = g.title as EoTabKey
                if (!EO_CLINICAL_TABS.includes(tab)) return null
                return (
                  <th
                    key={`h-${g.title}`}
                    className="border border-slate-200 bg-slate-100 px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-slate-600"
                  >
                    {g.title}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              {gruppiRapidi.map((g) => {
                const tab = g.title as EoTabKey
                if (!EO_CLINICAL_TABS.includes(tab)) return null
                return (
                  <td key={`c-${g.title}`} className="border border-slate-200 bg-white p-1.5 align-top">
                    <div className="flex flex-col gap-1">{renderColumnButtons(g, tab, '')}</div>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    )

    const eoVerticalModal = (
      <div className="flex max-h-[min(72vh,28rem)] flex-col gap-4 overflow-y-auto px-1 py-2">
        {gruppiRapidi.map((g) => {
          const tab = g.title as EoTabKey
          if (!EO_CLINICAL_TABS.includes(tab)) return null
          return (
            <div key={g.title} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-600">{g.title}</div>
              <div className="mt-2 flex flex-col gap-1.5">{renderColumnButtons(g, tab, '-m')}</div>
            </div>
          )
        })}
      </div>
    )

    return (
      <div className="space-y-2">
        <div>
          {infermiereMobileEOPopup ? (
            <>
              <button
                type="button"
                disabled={disabled}
                className="w-full max-w-md border border-slate-300 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 shadow-sm"
                onClick={() => setEoOpen(true)}
              >
                Apri opzioni rapide EO…
              </button>
              {eoOpen ? (
                <div
                  className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
                  role="presentation"
                  onClick={() => setEoOpen(false)}
                >
                  <div
                    className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl"
                    role="dialog"
                    aria-modal
                    aria-label="Opzioni rapide esame obiettivo"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                      <span className="text-sm font-bold text-slate-900">Opzioni rapide EO</span>
                      <button
                        type="button"
                        className="pma-theme-skip rounded-md px-3 py-1.5 text-sm font-semibold text-slate-700"
                        onClick={() => setEoOpen(false)}
                      >
                        Chiudi
                      </button>
                    </div>
                    {eoVerticalModal}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            eoGrid
          )}
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

  const flat = props as PropsFlat
  const set = new Set(flat.selected)
  return (
    <div className="space-y-2">
      <div>
        <div className="flex flex-wrap gap-2">
          {flatLabels.map((label) => {
            const on = set.has(label)
            const chipDisabled = nessunaEoOptionDisabled(disabled, flat.selected, label)
            return (
              <button
                key={label}
                type="button"
                disabled={chipDisabled}
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

