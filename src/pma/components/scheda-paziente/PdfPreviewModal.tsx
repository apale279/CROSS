import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, Printer, X } from 'lucide-react'
import { btnPrimary, btnSecondary } from '@pma/cross/uiTokens'

type Props = {
  url: string
  title?: string
  filename?: string
  onClose: () => void
  onPrint?: () => void
  onOpenNewTab?: () => void
}

/**
 * Anteprima PDF in-app (iframe). Utile in sviluppo per iterare sul layout senza scaricare.
 */
export function PdfPreviewModal({
  url,
  title = 'Anteprima PDF',
  filename,
  onClose,
  onPrint,
  onOpenNewTab,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[2100] flex flex-col bg-slate-900/60 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-preview-title"
    >
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 sm:px-4">
          <div className="min-w-0">
            <h2 id="pdf-preview-title" className="truncate text-sm font-bold text-slate-900 sm:text-base">
              {title}
            </h2>
            {filename ? (
              <p className="truncate text-xs text-slate-500" title={filename}>
                {filename}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onOpenNewTab ? (
              <button
                type="button"
                onClick={onOpenNewTab}
                className={btnSecondary}
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                Nuova scheda
              </button>
            ) : null}
            {onPrint ? (
              <button
                type="button"
                onClick={onPrint}
                className={btnSecondary}
              >
                <Printer className="h-4 w-4" aria-hidden />
                Stampa
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className={btnPrimary}
              aria-label="Chiudi anteprima"
            >
              <X className="h-4 w-4" aria-hidden />
              Chiudi
            </button>
          </div>
        </div>
        <iframe
          src={`${url}#view=FitH`}
          title={title}
          className="min-h-0 flex-1 w-full border-0 bg-slate-100"
        />
      </div>
    </div>,
    document.body,
  )
}
