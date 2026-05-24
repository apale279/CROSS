/**
 * Liste demo usate solo al seed iniziale su Firestore (`seedPmaClinicaImpostazioni`).
 * A runtime le liste arrivano da `impostazioni.pmaClinica`.
 */
export const PRESTAZIONI_LISTA_DEFAULT: string[] = [
  'ECG',
  'RX torace',
  'Puntura lombare',
  'Suture',
  'Immobilizzazione',
  'Ossigenoterapia',
  'Monitoraggio',
]

export const FARMACI_LISTA_DEFAULT: string[] = [
  'Paracetamolo',
  'Fentanil',
  'Midazolam',
  'Adrenalina',
  'Atropina',
  'Clorpromazina',
  'Salbutamolo',
  'Soluzione fisiologica',
]
