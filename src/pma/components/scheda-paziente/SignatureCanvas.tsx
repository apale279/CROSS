import { useCallback, useEffect, useRef, useState } from 'react'
import { btnPrimary, btnSecondary } from '@pma/cross/uiTokens'

type Props = {
  disabled?: boolean
  /** Data URL, Base64 o URL immagine già salvata (compat legacy). */
  savedImageSrc?: string | null
  /**
   * In modalità disegno: opzionale immagine da disegnare sul canvas dopo il layout
   * (firma esistente modificabile dal Medico prima della chiusura scheda).
   */
  preloadImageSrc?: string | null
  className?: string
  /** Area firma compatta (es. tab Dimissione). */
  variant?: 'default' | 'compact'
  onSaveDataUrl: (dataUrl: string) => Promise<void>
}

function clientPoint(canvas: HTMLCanvasElement, ev: { clientX: number; clientY: number }): {
  x: number
  y: number
} {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (ev.clientX - rect.left) * scaleX,
    y: (ev.clientY - rect.top) * scaleY,
  }
}

function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d')
  if (!ctx) return true
  const { width, height } = canvas
  if (width === 0 || height === 0) return true
  const step = 8
  const data = ctx.getImageData(0, 0, width, height).data
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4
      const r = data[i] ?? 255
      const g = data[i + 1] ?? 255
      const b = data[i + 2] ?? 255
      if (r < 248 || g < 248 || b < 248) return false
    }
  }
  return true
}

function drawDataUrlOnCanvas(canvas: HTMLCanvasElement, dataUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Canvas non disponibile.'))
      return
    }
    const img = new Image()
    img.onload = () => {
      const w = canvas.width
      const h = canvas.height
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      const sw = img.width
      const sh = img.height
      if (sw === 0 || sh === 0) {
        resolve()
        return
      }
      const scale = Math.min((w * 0.92) / sw, (h * 0.92) / sh, 2)
      const dw = sw * scale
      const dh = sh * scale
      const dx = (w - dw) / 2
      const dy = (h - dh) / 2
      ctx.drawImage(img, dx, dy, dw, dh)
      resolve()
    }
    img.onerror = () => reject(new Error('Immagine firma non caricabile.'))
    img.src = dataUrl
  })
}

/**
 * Area firma touch/mouse; esporta PNG come data URL e delega salvataggio Firestore al parent.
 * Con `disabled` mostra l’immagine salvata se presente.
 */
export function SignatureCanvas({
  disabled,
  savedImageSrc,
  preloadImageSrc,
  className = '',
  variant = 'default',
  onSaveDataUrl,
}: Props) {
  const compact = variant === 'compact'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const fitCanvasForce = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    const w = Math.floor(parent.clientWidth * dpr)
    const h = Math.floor(parent.clientHeight * dpr)
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = Math.max(2, 2 * dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const start = useCallback(
    (ev: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      drawing.current = true
      const pt =
        'touches' in ev && ev.touches[0]
          ? clientPoint(canvas, ev.touches[0])
          : clientPoint(canvas, ev as React.MouseEvent)
      ctx.beginPath()
      ctx.moveTo(pt.x, pt.y)
    },
    [disabled],
  )

  const move = useCallback(
    (ev: React.MouseEvent | React.TouchEvent) => {
      if (!drawing.current || disabled) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      if (!('touches' in ev)) {
        ;(ev as React.MouseEvent).preventDefault?.()
      }
      const pt =
        'touches' in ev && ev.touches[0]
          ? clientPoint(canvas, ev.touches[0])
          : clientPoint(canvas, ev as React.MouseEvent)
      ctx.lineTo(pt.x, pt.y)
      ctx.stroke()
    },
    [disabled],
  )

  const end = useCallback(() => {
    drawing.current = false
  }, [])

  useEffect(() => {
    if (disabled) return
    let cancelled = false

    const applyLayout = async () => {
      fitCanvasForce()
      const src = preloadImageSrc?.trim()
      if (!src) return
      const canvas = canvasRef.current
      if (!canvas || cancelled) return
      try {
        await drawDataUrlOnCanvas(canvas, src)
      } catch {
        /* firma precedente non decodificabile */
      }
    }

    void applyLayout()

    const ro = new ResizeObserver(() => {
      void applyLayout()
    })
    const parent = canvasRef.current?.parentElement
    if (parent) ro.observe(parent)

    const onOrientation = () => {
      void applyLayout()
    }
    window.addEventListener('orientationchange', onOrientation)

    return () => {
      cancelled = true
      ro.disconnect()
      window.removeEventListener('orientationchange', onOrientation)
    }
  }, [disabled, preloadImageSrc, fitCanvasForce])

  useEffect(() => {
    if (disabled) return
    const canvas = canvasRef.current
    if (!canvas) return
    const opts: AddEventListenerOptions = { passive: false }
    const touchStart = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault()
      if (!e.touches[0]) return
      const syn = {
        touches: e.touches,
        clientX: e.touches[0].clientX,
        clientY: e.touches[0].clientY,
      } as unknown as React.TouchEvent
      start(syn)
    }
    const touchMove = (e: TouchEvent) => {
      if (!drawing.current) return
      if (e.cancelable) e.preventDefault()
      if (!e.touches[0]) return
      const syn = {
        touches: e.touches,
        clientX: e.touches[0].clientX,
        clientY: e.touches[0].clientY,
      } as unknown as React.TouchEvent
      move(syn)
    }
    const touchEnd = () => end()

    canvas.addEventListener('touchstart', touchStart, opts)
    canvas.addEventListener('touchmove', touchMove, opts)
    canvas.addEventListener('touchend', touchEnd)
    canvas.addEventListener('touchcancel', touchEnd)
    return () => {
      canvas.removeEventListener('touchstart', touchStart)
      canvas.removeEventListener('touchmove', touchMove)
      canvas.removeEventListener('touchend', touchEnd)
      canvas.removeEventListener('touchcancel', touchEnd)
    }
  }, [disabled, start, move, end])

  function clear() {
    setLocalError(null)
    const src = preloadImageSrc?.trim()
    fitCanvasForce()
    if (src) {
      const canvas = canvasRef.current
      if (canvas) void drawDataUrlOnCanvas(canvas, src)
    }
  }

  async function save() {
    const canvas = canvasRef.current
    if (!canvas || disabled) return
    setLocalError(null)
    if (isCanvasBlank(canvas)) {
      setLocalError('Traccia una firma prima di salvare.')
      return
    }
    setBusy(true)
    try {
      const dataUrl = canvas.toDataURL('image/png', 0.92)
      await onSaveDataUrl(dataUrl)
      fitCanvasForce()
      await drawDataUrlOnCanvas(canvas, dataUrl)
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Salvataggio firma non riuscito.')
    } finally {
      setBusy(false)
    }
  }

  if (disabled && savedImageSrc) {
    return (
      <div className={`overflow-hidden rounded-lg border border-slate-200 bg-white ${className}`}>
        <img
          src={savedImageSrc}
          alt="Firma paziente acquisita"
          className={
            compact
              ? 'max-h-36 w-full object-contain sm:max-h-40'
              : 'max-h-72 w-full object-contain sm:max-h-80 md:max-h-96'
          }
        />
      </div>
    )
  }

  if (disabled && !savedImageSrc) {
    return (
      <div
        className={
          compact
            ? `flex min-h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 sm:min-h-36 ${className}`
            : `flex min-h-56 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 md:min-h-64 ${className}`
        }
      >
        Nessuna firma paziente registrata.
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div
        className={
          compact
            ? 'relative h-36 w-full max-w-md rounded-lg border-2 border-slate-300 bg-white shadow-inner sm:h-40'
            : 'relative h-64 w-full max-w-4xl rounded-lg border-2 border-slate-300 bg-white shadow-inner sm:h-72 md:h-80 lg:h-96'
        }
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => clear()}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancella
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className={`${btnPrimary} disabled:opacity-50`}
        >
          {busy ? 'Salvataggio…' : 'Salva firma'}
        </button>
      </div>
      {localError ? (
        <p className="text-sm text-red-700" role="alert">
          {localError}
        </p>
      ) : null}
    </div>
  )
}
