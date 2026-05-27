import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function Modal({
  title,
  onClose,
  children,
  wide = false,
  extraWide = false,
  /** Su smartphone/tablet PMA: limita larghezza al viewport senza forzare full-screen su desktop. */
  fitViewport = false,
  /**
   * Schede operative centrale (evento / missione / paziente): stessa larghezza e altezza
   * minima così il pannello non si ridimensiona al cambio tab o contenuto.
   */
  scheda = false,
}) {
  const widthClass = scheda
    ? 'w-full max-w-3xl'
    : fitViewport
      ? 'max-w-[calc(100vw-1rem)]'
      : extraWide
        ? 'max-w-6xl'
        : wide
          ? 'max-w-3xl'
          : 'max-w-lg';

  const panelClass = scheda
    ? 'flex max-h-[min(90dvh,960px)] min-h-[min(72dvh,700px)] w-full flex-col overflow-hidden'
    : 'max-h-[min(90vh,100dvh)] overflow-x-hidden overflow-y-auto';

  const bodyClass = scheda
    ? 'min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-5'
    : 'p-5';

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`rounded-xl border border-slate-200 bg-white shadow-xl sm:w-auto ${panelClass} ${widthClass}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 id="modal-title" className="text-lg font-bold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Chiudi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className={bodyClass}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
