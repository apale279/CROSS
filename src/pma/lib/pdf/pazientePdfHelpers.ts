import type { Timestamp } from 'firebase/firestore'
import type { Paziente } from '@pma/types/paziente'

export function sanitizeFilePart(s: string): string {
  const t = s.trim().replace(/[^a-zA-Z0-9._\s-]+/g, '_').replace(/\s+/g, '_')
  return t.slice(0, 72) || 'PMA'
}

/**
 * Prefisso ordinabile per cartella: data/ora **apertura scheda** (campo documento).
 * `YYYYMMDD_HH-mm` (due punti sostituiti da `-` per compatibilità nomi file su Windows).
 */
export function formatAperturaSchedaForFilename(apertura: Timestamp): string {
  const d = apertura.toDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = d.getFullYear()
  const mo = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const h = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${y}${mo}${day}_${h}-${mi}`
}

export function defaultPdfFilename(p: Paziente): string {
  const prefix = formatAperturaSchedaForFilename(p.apertura_scheda)
  const nome = sanitizeFilePart(p.nome || 'Nome')
  const cognome = sanitizeFilePart(p.cognome || 'Cognome')
  const idProg = sanitizeFilePart(p.id_paziente_visibile || p.id)
  return `${prefix}_${nome}_${cognome}_${idProg}.pdf`
}

export function buildMailtoReportPaziente(params: {
  toEmail: string
  pazienteIdVisibile: string
  pdfFilename: string
}): string {
  const subject = `Scheda visita PMA — ${params.pazienteIdVisibile}`
  const body = `Gentile Collega,

di seguito le istruzioni per l'invio della scheda visita PMA.

1) Il report PDF è stato scaricato automaticamente sul dispositivo con nome:
   ${params.pdfFilename}

2) Poiché il programma di posta non consente allegati automatici da questa applicazione, allega manualmente il file PDF al presente messaggio prima dell'invio.

3) Verifica che l'indirizzo del destinatario sia corretto.

Cordiali saluti`
  return `mailto:${encodeURIComponent(params.toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
