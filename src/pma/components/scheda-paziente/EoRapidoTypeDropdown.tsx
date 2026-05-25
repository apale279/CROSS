import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal'
import { btnPrimary } from '@pma/cross/uiTokens'
import { PmaFieldGuard } from '../PmaFieldGuard'
import { usePmaFieldPresence } from '../../context/PmaFieldPresenceContext'
import type { EoTabKey } from '@pma/lib/multilineList'
import { firestoreFieldForEoTab } from '@pma/lib/eoPazienteFields'
import {
  defaultEoLabelForColumn,
  isNellaNormaEoOptionLabel,
  nessunaEoOptionDisabled,
  toggleEoQuickColumnSelection,
} from '@pma/lib/eoQuickSelection'

type Props = {
  tab: EoTabKey
  title: string
  labels: readonly string[]
  selected: string[]
  disabled?: boolean
  onChange: (baseAtOpen: string[], draft: string[]) => void
}

function selectionSummary(selected: string[], defaultLabel: string): string {
  const norma = defaultLabel.trim()
  const clean = selected.map((x) => x.trim()).filter(Boolean)
  if (clean.length === 0) return norma || '—'
  if (clean.length === 1 && norma && clean[0] === norma) return norma
  const altered = clean.filter((x) => !isNellaNormaEoOptionLabel(x))
  if (altered.length === 0) return norma || clean[0]
  if (altered.length <= 2) return altered.join(', ')
  return `${altered.length} voci`
}

export function EoRapidoTypeDropdown({ tab, title, labels, selected, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>(selected)
  const baseAtOpenRef = useRef<string[]>([])
  const fieldKey = firestoreFieldForEoTab(tab)
  const { useFieldLock } = usePmaFieldPresence()
  const lock = useFieldLock(fieldKey)
  const defaultLabel = defaultEoLabelForColumn(labels)
  const summary = selectionSummary(selected, defaultLabel)
  const altered =
    selected.some((x) => !isNellaNormaEoOptionLabel(x)) &&
    !(selected.length === 1 && selected[0] === defaultLabel)

  useEffect(() => {
    if (open) {
      baseAtOpenRef.current = [...selected]
      setDraft([...selected])
    }
  }, [open, selected])

  const closeAndApply = () => {
    onChange(baseAtOpenRef.current, draft)
    setOpen(false)
  }

  const closeWithoutApply = () => {
    setDraft([...selected])
    setOpen(false)
  }

  if (labels.length === 0) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">
        {title}: —
      </div>
    )
  }

  const draftSet = new Set(draft)

  return (
    <PmaFieldGuard fieldKey={fieldKey}>
      <button
        type="button"
        disabled={disabled || lock.isForeign}
        onClick={() => !disabled && !lock.isForeign && setOpen(true)}
        className={`pma-theme-skip flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm font-semibold shadow-sm disabled:opacity-50 ${
          altered
            ? 'border-violet-300 bg-violet-50 text-violet-950'
            : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
        }`}
      >
        <span className="min-w-0 truncate">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{title}</span>
          <span className="mt-0.5 block truncate normal-case">{summary}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
      </button>

      {open ? (
        <Modal title={`EO — ${title}`} onClose={closeWithoutApply} wide>
          <p className="mb-3 text-xs text-slate-600">
            Seleziona una o più voci. «NELLA NORMA» si deseleziona se scegli un&apos;alterazione. Chiudi con
            «Applica» per salvare.
          </p>
          <div
            className="max-h-[min(60vh,24rem)] overflow-y-auto rounded-md border border-slate-200"
            role="listbox"
            aria-multiselectable="true"
            aria-label={`Opzioni ${title}`}
          >
            {labels.map((label) => {
              const on = draftSet.has(label)
              const chipDisabled = nessunaEoOptionDisabled(disabled, draft, label)
              return (
                <button
                  key={`${tab}-${label}`}
                  type="button"
                  role="option"
                  aria-selected={on}
                  disabled={chipDisabled}
                  onClick={() =>
                    setDraft((prev) => toggleEoQuickColumnSelection(prev, label, labels))
                  }
                  className={`pma-theme-skip flex w-full items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left text-sm last:border-b-0 ${
                    on
                      ? 'bg-sky-600 font-medium text-white'
                      : 'bg-white text-slate-800 hover:bg-slate-50'
                  } disabled:opacity-50`}
                >
                  <span
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
                      on ? 'border-white bg-white text-slate-900' : 'border-slate-400 bg-white'
                    }`}
                    aria-hidden
                  >
                    {on ? '✓' : ''}
                  </span>
                  <span className="min-w-0 leading-snug">{label}</span>
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={closeWithoutApply}
            >
              Annulla
            </button>
            <button
              type="button"
              className={`${btnPrimary} disabled:opacity-50`}
              disabled={lock.isForeign}
              onClick={closeAndApply}
            >
              Applica
            </button>
          </div>
        </Modal>
      ) : null}
    </PmaFieldGuard>
  )
}
