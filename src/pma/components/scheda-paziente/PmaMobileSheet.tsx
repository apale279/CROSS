import type { ReactNode } from 'react'

type HeaderProps = {
  title: string
  onClose: () => void
  closeLabel?: string
}

/** Intestazione modale mobile: titolo + azione centrata (evita taglio a destra). */
export function PmaMobileSheetHeader({ title, onClose, closeLabel = 'Chiudi' }: HeaderProps) {
  return (
    <div className="shrink-0 border-b border-slate-200 px-3 py-3">
      <h2 className="text-center text-sm font-bold leading-snug text-slate-900">{title}</h2>
      <div className="mt-2 flex justify-center">
        <button
          type="button"
          className="pma-theme-skip min-h-[44px] min-w-[8rem] rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm"
          onClick={onClose}
        >
          {closeLabel}
        </button>
      </div>
    </div>
  )
}

type SheetProps = {
  ariaLabel: string
  onBackdropClick: () => void
  header: ReactNode
  children: ReactNode
  footer?: ReactNode
}

/** Bottom sheet PMA: larghezza viewport, niente overflow orizzontale. */
export function PmaMobileSheet({ ariaLabel, onBackdropClick, header, children, footer }: SheetProps) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onBackdropClick}
    >
      <div
        className="pma-mobile-sheet flex max-h-[92vh] w-full flex-col sm:max-w-lg sm:rounded-2xl"
        role="dialog"
        aria-modal
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
      >
        {header}
        <div className="pma-mobile-sheet__body min-h-0 flex-1 space-y-3 px-3 py-3">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-slate-200 p-3">{footer}</div>
        ) : null}
      </div>
    </div>
  )
}

type FooterActionsProps = {
  onCancel: () => void
  cancelLabel?: string
  onConfirm: () => void
  confirmLabel: string
  confirmDisabled?: boolean
  confirmClassName?: string
}

export function PmaMobileSheetFooterActions({
  onCancel,
  cancelLabel = 'Annulla',
  onConfirm,
  confirmLabel,
  confirmDisabled,
  confirmClassName = '',
}: FooterActionsProps) {
  return (
    <div className="flex flex-col items-stretch justify-center gap-2 sm:flex-row">
      <button
        type="button"
        className="pma-theme-skip min-h-[44px] flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800"
        onClick={onCancel}
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        disabled={confirmDisabled}
        onClick={onConfirm}
        className={`min-h-[44px] flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-40 ${confirmClassName}`}
      >
        {confirmLabel}
      </button>
    </div>
  )
}
