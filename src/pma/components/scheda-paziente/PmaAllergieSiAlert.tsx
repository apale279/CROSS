import type { AllergieVerificaStato } from '@pma/types/paziente'

type Props = {
  allergieVerifica?: AllergieVerificaStato | null
  allergie?: string
  className?: string
}

/** Promemoria obbligatorio se domanda allergie = SI (farmaci / dimissione). */
export function PmaAllergieSiAlert({ allergieVerifica, allergie, className = '' }: Props) {
  if (allergieVerifica !== 'si') return null
  const dettaglio = String(allergie ?? '').trim()
  return (
    <div
      role="alert"
      className={`rounded-lg border-2 border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-950 ${className}`.trim()}
    >
      <p className="font-bold uppercase tracking-wide">Allergie segnalate (SI)</p>
      <p className="mt-1 leading-snug">
        Prima di somministrare farmaci in cartella o prescrivere in dimissione, verifica le allergie
        del paziente.
      </p>
      {dettaglio ? (
        <p className="mt-2 whitespace-pre-wrap font-semibold leading-snug">
          Dettaglio allergie: {dettaglio}
        </p>
      ) : null}
    </div>
  )
}
