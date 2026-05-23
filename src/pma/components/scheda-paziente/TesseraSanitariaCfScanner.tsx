import { useEffect, useRef, useState } from 'react'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { BrowserCodeReader, BrowserMultiFormatReader } from '@zxing/browser'
import { extractCfFromBarcodeText } from '@pma/lib/codiceFiscaleIt'

type Props = {
  open: boolean
  onClose: () => void
  /** Chiamato con CF a 16 caratteri validato; poi chiudere con `onClose` dal genitore. */
  onCapture: (cf: string) => void
}

/**
 * Lettura CODE 128 dalla fotocamera (barra tessera sanitaria → 16 caratteri CF).
 * Nessun OCR: solo decodifica barcode.
 */
export function TesseraSanitariaCfScanner({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onCaptureRef = useRef(onCapture)
  const onCloseRef = useRef(onClose)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    onCaptureRef.current = onCapture
  }, [onCapture])
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) {
      setErr(null)
      return
    }

    const video = videoRef.current
    if (!video) return

    let stopped = false

    const hints = new Map<DecodeHintType, unknown>()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128])
    hints.set(DecodeHintType.TRY_HARDER, true)

    const reader = new BrowserMultiFormatReader(hints)
    let scanControls: { stop: () => void } | null = null

    void reader
      .decodeFromVideoDevice(undefined, video, (result, _decodeErr, ctrl) => {
        if (stopped || !result) return
        if (result.getBarcodeFormat() !== BarcodeFormat.CODE_128) return
        const cf = extractCfFromBarcodeText(result.getText())
        if (!cf) return
        stopped = true
        ctrl.stop()
        onCaptureRef.current(cf)
        onCloseRef.current()
      })
      .then((c) => {
        if (stopped) {
          c.stop()
          return
        }
        scanControls = c
      })
      .catch((e: unknown) => {
        if (stopped) return
        setErr(e instanceof Error ? e.message : 'Impossibile avviare la fotocamera.')
      })

    return () => {
      stopped = true
      scanControls?.stop()
      try {
        BrowserCodeReader.releaseAllStreams()
      } catch {
        /* ignore */
      }
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl"
        role="dialog"
        aria-modal
        aria-label="Scansione codice a barre tessera sanitaria"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <span className="text-sm font-bold text-slate-900">Codice a barre (CODE 128)</span>
          <button
            type="button"
            className="pma-theme-skip rounded-md px-3 py-1.5 text-sm font-semibold text-slate-700"
            onClick={() => onClose()}
          >
            Annulla
          </button>
        </div>
        <div className="space-y-2 px-3 py-3">
          <p className="text-xs text-slate-600">
            Inquadra il <strong>codice a barre</strong> della tessera sanitaria (non serve fotografare i dati in
            chiaro).
          </p>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-black">
            <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
          </div>
          {err ? (
            <p className="text-xs text-red-600" role="alert">
              {err}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
