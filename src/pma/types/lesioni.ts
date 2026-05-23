/** Vista omino lesioni (coordinate nello spazio viewBox SVG). */
export type LesioneVista = 'front' | 'back'

/** Marker lesione su scheda paziente (Sez. 3 Core v3). */
export interface LesioneMarker {
  /** Numero progressivo univoco sulla scheda (1, 2, 3…). */
  n: number
  vista: LesioneVista
  /** Coordinata X nel sistema del viewBox (es. 0–200). */
  x: number
  /** Coordinata Y nel sistema del viewBox (es. 0–500). */
  y: number
  descrizione: string
}
