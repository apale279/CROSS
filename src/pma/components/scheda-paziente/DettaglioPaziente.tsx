import type { ReactNode } from 'react'
import type { Paziente } from '@pma/types/paziente'
import { CODICE_COLORE_LABEL, PAZIENTE_STATO_LABEL } from '@pma/types/paziente'
import type { CodiceColorePaziente } from '@pma/types/paziente'
import type { SchedaPazienteTabId } from './schedaPazienteTabs'

const SDOT: Record<CodiceColorePaziente, string> = {
  bianco: 'pma-bar__sdot--bianco',
  verde: 'pma-bar__sdot--verde',
  giallo: 'pma-bar__sdot--giallo',
  rosso: 'pma-bar__sdot--rosso',
}

export type DettaglioPazienteProps = {
  p: Paziente
  tabs: { id: SchedaPazienteTabId; label: string }[]
  activeTab: SchedaPazienteTabId
  onTabChange: (tab: SchedaPazienteTabId) => void
  saveError: ReactNode
  panels: Record<SchedaPazienteTabId, ReactNode>
}

export function DettaglioPaziente({ p, tabs, activeTab, onTabChange, saveError, panels }: DettaglioPazienteProps) {
  return (
    <div className="flex w-full min-w-0 flex-col bg-white">
      <div className="border-b border-slate-200 bg-white py-2">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`pma-bar__sdot ${SDOT[p.codice_colore]}`}
              aria-label={`Codice colore ${CODICE_COLORE_LABEL[p.codice_colore]}`}
            />
            <span className="text-sm font-medium text-slate-800">
              {CODICE_COLORE_LABEL[p.codice_colore]} · {PAZIENTE_STATO_LABEL[p.stato]}
            </span>
            <span
              className={`pma-bar__badge ${p.aperto ? 'pma-bar__badge--open' : 'pma-bar__badge--closed'}`}
            >
              {p.aperto ? 'Aperta' : 'Chiusa'}
            </span>
          </div>
          <code className="font-mono text-sm font-medium text-slate-700">{p.id_paziente_visibile}</code>
        </div>
      </div>

      <nav className="pma-tabs" aria-label="Sezioni scheda paziente" role="tablist">
        {tabs.map((tab) => {
          const selected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`scheda-panel-${tab.id}`}
              id={`scheda-tab-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              className={`pma-theme-skip pma-tab ${selected ? 'pma-tab--active' : ''}`}
            >
              {tab.label}
            </button>
          )
        })}
      </nav>

      <div className="mx-auto w-full max-w-5xl flex-1 pt-3">
        {saveError}
        {tabs.map((tab) => {
          const visible = activeTab === tab.id
          return (
            <div
              key={tab.id}
              id={`scheda-panel-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`scheda-tab-${tab.id}`}
              hidden={!visible}
              className={visible ? 'block min-h-0' : 'hidden'}
            >
              {panels[tab.id]}
            </div>
          )
        })}
      </div>
    </div>
  )
}
