import type { Paziente } from '@pma/types/paziente'
import type { UserRank } from '@pma/types/userProfile'
import { schedaTabCartellaAllows, schedaTabDimissioneAllows, schedaTabInvioPsAllows } from '@pma/lib/rankMatrix'

export type SchedaPazienteTabId =
  | 'generale'
  | 'anagrafica'
  | 'dati_centrale'
  | 'cartella'
  | 'dimissione'
  | 'invio_ps'

/** Tab vista PMA a schermo intero (dashboard tenda). */
export const PMA_SHELL_TABS: { id: SchedaPazienteTabId; label: string }[] = [
  { id: 'anagrafica', label: 'Anagrafica' },
  { id: 'dati_centrale', label: 'Dati centrale' },
  { id: 'cartella', label: 'Cartella clinica' },
  { id: 'dimissione', label: 'Dimissioni' },
]

/** Solo cartella + dimissione (vista centrale, sezione PMA collassabile). */
export const PMA_CLINICAL_SHELL_TABS: { id: SchedaPazienteTabId; label: string }[] = [
  { id: 'cartella', label: 'Cartella clinica' },
  { id: 'dimissione', label: 'Dimissioni' },
]

/** Autopresentati: nessun dato da centrale → tab nascosto. */
export function pmaShellTabsFor(isAutopresentato: boolean) {
  if (isAutopresentato) {
    return PMA_SHELL_TABS.filter((t) => t.id !== 'dati_centrale')
  }
  return PMA_SHELL_TABS
}

/** Tab shell PMA filtrate per rank (READ su cartella/dimissione). */
export function filterPmaShellTabsByRank(
  tabs: { id: SchedaPazienteTabId; label: string }[],
  rank: UserRank,
) {
  return tabs.filter((t) => {
    if (t.id === 'cartella') return schedaTabCartellaAllows(rank, 'READ')
    if (t.id === 'dimissione') return schedaTabDimissioneAllows(rank, 'READ')
    return true
  })
}

const BASE_TABS: { id: SchedaPazienteTabId; label: string }[] = [
  { id: 'generale', label: 'Generale' },
  { id: 'anagrafica', label: 'Anagrafica' },
  { id: 'cartella', label: 'Cartella clinica' },
  { id: 'dimissione', label: 'Dimissione' },
]

/**
 * Tab visibili sulla scheda: la sezione Invio PS compare solo con esito `invio_ps`.
 * Esclude tab in base al rank (matrice `rankMatrix`).
 * Dimissione: Infermiere/Soccorritore in sola lettura. Invio PS: Centrale/Medico.
 */
export function schedaPazienteTabsFor(
  p: Pick<Paziente, 'dimissione_esito'>,
  rank: UserRank,
): {
  id: SchedaPazienteTabId
  label: string
}[] {
  let tabs: { id: SchedaPazienteTabId; label: string }[] = [...BASE_TABS]
  if (p.dimissione_esito === 'invio_ps') {
    tabs = [...tabs, { id: 'invio_ps', label: 'Invio PS' }]
  }
  tabs = tabs.filter((t) => {
    if (t.id === 'cartella') return schedaTabCartellaAllows(rank, 'READ')
    if (t.id === 'dimissione') return schedaTabDimissioneAllows(rank, 'READ')
    if (t.id === 'invio_ps') return schedaTabInvioPsAllows(rank, 'READ')
    return true
  })
  return tabs
}
