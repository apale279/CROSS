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
  fillHeight?: boolean
  variant?: 'pma' | 'cross'
  /** Etichetta stato PMA Firestore (`statoPzPma`). */
  statoPmaLabel?: string | null
  /** Etichetta stato centrale (`stato` / missione). */
  statoCentraleLabel?: string | null
  /** Se true: badge «chiuso centrale» invece di confondere con apertura scheda PMA. */
  chiusoCentrale?: boolean
}

export function DettaglioPaziente({
  p,
  tabs,
  activeTab,
  onTabChange,
  saveError,
  panels,
  fillHeight = false,
  variant = 'pma',
  statoPmaLabel = null,
  statoCentraleLabel = null,
  chiusoCentrale = false,
}: DettaglioPazienteProps) {
  const cross = variant === 'cross'
  const haStatoPma = Boolean(statoPmaLabel)
  const haStatoCentrale = Boolean(statoCentraleLabel)

  return (
    <div
      className={
        fillHeight
          ? 'flex h-full min-h-0 w-full min-w-0 flex-col bg-white'
          : 'flex w-full min-w-0 flex-col bg-white'
      }
    >
      <div className="shrink-0 border-b border-slate-200 bg-white py-2">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`pma-bar__sdot ${SDOT[p.codice_colore]}`}
              aria-label={`Codice colore ${CODICE_COLORE_LABEL[p.codice_colore]}`}
            />
            <span className="text-sm font-medium text-slate-800">
              {CODICE_COLORE_LABEL[p.codice_colore]}
              {haStatoPma && (
                <>
                  {' '}
                  · PMA: <strong>{statoPmaLabel}</strong>
                </>
              )}
              {haStatoCentrale && (
                <>
                  {' '}
                  · Centrale: <strong>{statoCentraleLabel}</strong>
                </>
              )}
              {!haStatoPma && !haStatoCentrale && (
                <> · {PAZIENTE_STATO_LABEL[p.stato]}</>
              )}
            </span>
            {chiusoCentrale ? (
              <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                Chiuso centrale
              </span>
            ) : haStatoPma ? (
              <span
                className={
                  cross
                    ? `rounded px-2 py-0.5 text-xs font-semibold ${
                        p.aperto ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-slate-700'
                      }`
                    : `pma-bar__badge ${p.aperto ? 'pma-bar__badge--open' : 'pma-bar__badge--closed'}`
                }
              >
                {p.aperto ? (cross ? 'Scheda PMA attiva' : 'Aperta') : cross ? 'Scheda PMA chiusa' : 'Chiusa'}
              </span>
            ) : (
              <span
                className={
                  cross
                    ? `rounded px-2 py-0.5 text-xs font-semibold ${
                        p.aperto ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-slate-700'
                      }`
                    : `pma-bar__badge ${p.aperto ? 'pma-bar__badge--open' : 'pma-bar__badge--closed'}`
                }
              >
                {p.aperto ? (cross ? 'Scheda aperta' : 'Aperta') : cross ? 'Scheda chiusa' : 'Chiusa'}
              </span>
            )}
          </div>
          <code className="font-mono text-sm font-medium text-slate-700">{p.id_paziente_visibile}</code>
        </div>
      </div>

      <nav
        className={
          cross
            ? 'flex shrink-0 flex-wrap gap-1 border-b border-slate-200 bg-white px-3 sm:px-4'
            : 'pma-tabs shrink-0'
        }
        aria-label="Sezioni scheda paziente"
        role="tablist"
      >
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
              className={
                cross
                  ? `rounded-t-lg px-4 py-2 text-xs font-bold uppercase ${
                      selected
                        ? 'border-b-2 border-sky-600 text-sky-700'
                        : 'text-slate-600 hover:text-slate-900'
                    }`
                  : `pma-theme-skip pma-tab ${selected ? 'pma-tab--active' : ''}`
              }
            >
              {tab.label}
            </button>
          )
        })}
      </nav>

      <div
        className={
          fillHeight
            ? 'mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden pt-3'
            : 'mx-auto w-full max-w-5xl flex-1 pt-3'
        }
      >
        {saveError}
        <div className={fillHeight ? 'min-h-0 flex-1 overflow-y-auto px-3 pb-8 sm:px-4' : undefined}>
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
    </div>
  )
}
