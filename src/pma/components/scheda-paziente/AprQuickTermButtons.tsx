import { useMemo } from 'react'
import {
  APR_QUICK_TERMS,
  parseAprContent,
  toggleAprQuickTerm,
  type AprQuickLabel,
} from '@pma/lib/aprQuickTerms'

function aprQuickButtonClass(selected: boolean): string {
  const base =
    'min-h-[40px] rounded-lg border-2 px-2.5 py-1.5 text-xs font-bold uppercase shadow-sm transition-colors sm:text-sm'
  if (!selected) {
    return `${base} border-slate-400 bg-white text-slate-800 hover:border-slate-600 hover:bg-slate-50`
  }
  return `${base} border-teal-700 bg-teal-50 text-teal-950`
}

type Props = {
  apr: string
  disabled?: boolean
  onAprChange: (next: string) => void
}

export function AprQuickTermButtons({ apr, disabled = false, onAprChange }: Props) {
  const selectedTerms = useMemo(() => new Set(parseAprContent(apr).terms), [apr])

  function toggle(label: AprQuickLabel) {
    if (disabled) return
    onAprChange(toggleAprQuickTerm(apr, label))
  }

  return (
    <div
      className="mb-2 flex flex-wrap gap-2"
      role="group"
      aria-label="Voci rapide APR"
    >
      {APR_QUICK_TERMS.map(({ label, emoji }) => {
        const selected = selectedTerms.has(label)
        return (
          <button
            key={label}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => toggle(label)}
            className={`pma-theme-skip ${aprQuickButtonClass(selected)}`}
          >
            <span aria-hidden>{emoji}</span> {label}
          </button>
        )
      })}
    </div>
  )
}
