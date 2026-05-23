import { useEffect, useState } from 'react'
import type { Timestamp } from 'firebase/firestore'

type Props = {
  deadline: Timestamp | null | undefined
  /** Etichetta accessibile quando non c’è scadenza. */
  hiddenLabel?: string
}

/**
 * Countdown verso `eta_pma_deadline`. Dopo la scadenza: alert testuale rosso lampeggiante.
 */
export function EtaPmaCountdown({ deadline, hiddenLabel = 'Countdown ETA' }: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!deadline) return
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [deadline])

  if (!deadline || typeof deadline.toMillis !== 'function') {
    return null
  }

  const target = deadline.toMillis()
  const diff = target - nowMs
  const scaduto = diff <= 0

  const abs = Math.abs(diff)
  const m = Math.floor(abs / 60000)
  const s = Math.floor((abs % 60000) / 1000)

  const arrivoPrevisto = deadline.toDate().toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="pma-card mt-2 text-sm">
      <div className="pma-field__value font-medium">Arrivo previsto</div>
      <div className="text-xs pma-field__value--muted">{arrivoPrevisto}</div>
      <div
        className={
          scaduto
            ? 'mt-1 animate-pulse font-semibold text-red-600'
            : 'mt-1 font-medium pma-field__value'
        }
        aria-live="polite"
        aria-label={hiddenLabel}
      >
        {scaduto
          ? 'TEMPO SCADUTO — paziente atteso oltre l’ETA'
          : `Mancano ${m}m ${s}s`}
      </div>
    </div>
  )
}
