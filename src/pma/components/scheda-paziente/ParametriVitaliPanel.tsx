import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Timestamp } from 'firebase/firestore'
import { datetimeLocalToTimestamp, toDatetimeLocal } from '@pma/lib/schedaDatetimeLocal'
import { btnPrimary } from '@pma/cross/uiTokens'
import { useInfermiereSmartphone } from '@pma/hooks/useInfermiereSmartphoneStub'
import type { ParametroVitaleRilevazione } from '@pma/types/cartellaClinica'
import type { UserProfile } from '@pma/types/userProfile'
import { appendPmaSchedaArrayRow } from '@pma/lib/pazientePmaPatch'
import { emptyParametroVitaleDraft } from '@pma/lib/emptyParametroVitale'
import { newLocalId } from '../../../lib/ids'
import { parseVitalNumericInput, vitalInputValue } from '../../../lib/vitalNumeric'
import { PmaFieldGuard } from '../PmaFieldGuard'
import {
  PmaMobileSheet,
  PmaMobileSheetFooterActions,
  PmaMobileSheetHeader,
} from './PmaMobileSheet'

const PMA_MODAL_INPUT =
  'pma-mobile-input rounded-md border border-slate-300 px-3 py-2 font-medium disabled:bg-slate-100'
const PV_IN_ROW =
  'pma-mobile-input box-border w-full min-w-0 rounded border border-slate-300 px-0.5 py-1 text-center text-base font-semibold tabular-nums leading-none disabled:bg-slate-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

type PvTone = 'critical' | 'warn' | null
type PmaSchedaPvField = 'parametri_vitali' | 'triage_parametri_vitali'

export type ParametriVitaliPanelProps = {
  pazienteId: string
  manifestationId: string
  rows: ParametroVitaleRilevazione[]
  arrayField: PmaSchedaPvField
  fieldGuardKey: string
  canEdit: boolean
  write: (patch: Record<string, unknown>) => Promise<void>
  user: UserProfile | null
  title?: string
  readonlyHint?: ReactNode
  /** Dopo salvataggio riuscito di una riga (blur campo o append). */
  onRowCommitted?: (row: ParametroVitaleRilevazione) => void
}

function sortPvChronoAsc(rows: ParametroVitaleRilevazione[]) {
  return [...rows].sort((a, b) => a.registrato_at.toMillis() - b.registrato_at.toMillis())
}

function worstSpo2(row: ParametroVitaleRilevazione): number | null {
  const a = row.spo2_aa
  const b = row.spo2_o2
  if (a == null && b == null) return null
  if (a == null) return b
  if (b == null) return a
  return Math.min(a, b)
}

function patchPvNumericBlur(
  raw: string,
  onPatch: (id: string, partial: Partial<ParametroVitaleRilevazione>) => void,
  id: string,
  field: keyof ParametroVitaleRilevazione,
  opts?: { min?: number; max?: number; integer?: boolean },
) {
  const parsed = parseVitalNumericInput(raw, opts)
  if (parsed === undefined) return
  onPatch(id, { [field]: parsed } as Partial<ParametroVitaleRilevazione>)
}

function pvTones(row: ParametroVitaleRilevazione): Record<string, PvTone> {
  const spo = worstSpo2(row)
  const tones: Record<string, PvTone> = {}
  if (row.gcs != null) {
    if (row.gcs <= 8) tones.gcs = 'critical'
    else if (row.gcs <= 12) tones.gcs = 'warn'
  }
  if (row.fr != null) {
    if (row.fr < 8 || row.fr > 32) tones.fr = 'critical'
    else if (row.fr < 10 || row.fr > 28) tones.fr = 'warn'
  }
  if (spo != null) {
    if (spo < 90) tones.spo2 = 'critical'
    else if (spo < 94) tones.spo2 = 'warn'
  }
  if (row.fc != null) {
    if (row.fc < 45 || row.fc > 140) tones.fc = 'critical'
    else if (row.fc < 55 || row.fc > 120) tones.fc = 'warn'
  }
  if (row.pa_sistolica != null) {
    if (row.pa_sistolica < 85 || row.pa_sistolica > 180) tones.pa_sys = 'critical'
    else if (row.pa_sistolica < 90 || row.pa_sistolica > 160) tones.pa_sys = 'warn'
  }
  if (row.pa_diastolica != null) {
    if (row.pa_diastolica < 45 || row.pa_diastolica > 110) tones.pa_dia = 'critical'
    else if (row.pa_diastolica < 55 || row.pa_diastolica > 100) tones.pa_dia = 'warn'
  }
  if (row.temperatura != null) {
    if (row.temperatura >= 39.5 || row.temperatura < 35) tones.temp = 'critical'
    else if (row.temperatura >= 38.5 || row.temperatura < 36) tones.temp = 'warn'
  }
  if (row.nrs != null) {
    if (row.nrs >= 8) tones.nrs = 'critical'
    else if (row.nrs >= 6) tones.nrs = 'warn'
  }
  return tones
}

function MonitorCell({
  as = 'div',
  label,
  tone,
  children,
  boxClassName,
  hideLabel = false,
  emphasizeLabel = false,
  labelInline = false,
}: {
  as?: 'div' | 'td'
  label: string
  tone: PvTone
  children: ReactNode
  boxClassName?: string
  hideLabel?: boolean
  emphasizeLabel?: boolean
  labelInline?: boolean
}) {
  const shell =
    tone === 'critical'
      ? 'border-red-400 bg-red-50 shadow-[inset_0_0_0_1px_rgba(252,165,165,0.45)]'
      : tone === 'warn'
        ? 'border-amber-300 bg-amber-50'
        : 'border-slate-200 bg-white'
  const labelEl = (
    <div
      className={
        emphasizeLabel
          ? 'text-sm font-bold uppercase leading-snug tracking-wide text-slate-700'
          : 'text-[10px] font-semibold uppercase leading-tight tracking-wider text-slate-500'
      }
    >
      {label}
    </div>
  )
  const valEl = hideLabel ? (
    <div className="min-w-0">{children}</div>
  ) : (
    <div className="mt-0.5 min-w-0">{children}</div>
  )
  if (as === 'td') {
    return (
      <td
        className={`border border-slate-300 p-1 text-left ${hideLabel ? 'align-middle' : 'align-top'} ${shell} ${boxClassName ?? ''}`}
      >
        {!hideLabel ? labelEl : null}
        {valEl}
      </td>
    )
  }
  if (labelInline && !hideLabel) {
    return (
      <div
        className={`flex min-h-[2.75rem] w-full min-w-0 items-center gap-2 border-b border-slate-200 py-1 ${boxClassName ?? ''}`}
      >
        <div className="w-[38%] max-w-[9.5rem] shrink-0">{labelEl}</div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    )
  }
  return (
    <div className={`shrink-0 rounded-md border px-1 py-0.5 ${shell} ${boxClassName ?? ''}`}>
      {!hideLabel ? labelEl : null}
      {valEl}
    </div>
  )
}

function ParametriVitaliBlock({
  row,
  canEdit,
  onPatch,
  onRemove,
  layout = 'row',
  variant = 'block',
  emphasizeLabels = false,
  mobileSheet = false,
}: {
  row: ParametroVitaleRilevazione
  canEdit: boolean
  onPatch: (id: string, partial: Partial<ParametroVitaleRilevazione>) => void
  onRemove?: (id: string) => void
  layout?: 'row' | 'stack' | 'inline'
  variant?: 'block' | 'tableRow'
  emphasizeLabels?: boolean
  mobileSheet?: boolean
}) {
  const cellAs = variant === 'tableRow' ? 'td' : 'div'
  const labelInline = layout === 'inline'
  const t = pvTones(row)
  const opNome = (row.operatore_nome ?? '').trim() || '—'
  const pvFieldInput = mobileSheet
    ? `${PMA_MODAL_INPUT} min-h-[2.75rem] text-left tabular-nums`
    : emphasizeLabels
      ? `${PV_IN_ROW} min-h-[2.75rem] text-base font-semibold`
      : PV_IN_ROW
  const pvNumType = (decimal = false) =>
    mobileSheet
      ? ({
          type: 'text' as const,
          inputMode: decimal ? ('decimal' as const) : ('numeric' as const),
          autoComplete: 'off' as const,
        })
      : ({ type: 'number' as const })
  const removeButton =
    canEdit && onRemove ? (
      <button
        type="button"
        title="Elimina rilevazione"
        aria-label="Elimina rilevazione parametri vitali"
        onClick={() => onRemove(row.id)}
        className="pma-theme-skip inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M9 3h6M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    ) : null
  const inner = (
    <>
      <MonitorCell
        as={cellAs}
        hideLabel={cellAs === 'td'}
        emphasizeLabel={emphasizeLabels}
        labelInline={labelInline}
        label="Data/ora"
        tone={null}
        boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'w-[11.5rem] shrink-0'}
      >
        <input
          type="datetime-local"
          disabled={!canEdit}
          defaultValue={toDatetimeLocal(row.registrato_at)}
          onBlur={(e) => {
            const ts = datetimeLocalToTimestamp(e.target.value)
            if (ts) onPatch(row.id, { registrato_at: ts })
          }}
          className={`${pvFieldInput} text-left`}
        />
      </MonitorCell>
      <MonitorCell
        as={cellAs}
        hideLabel={cellAs === 'td'}
        emphasizeLabel={emphasizeLabels}
        labelInline={labelInline}
        label="GCS"
        tone={t.gcs ?? null}
        boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'w-[2.85rem] shrink-0'}
      >
        <input
          {...pvNumType()}
          min={mobileSheet ? undefined : 3}
          max={mobileSheet ? undefined : 15}
          disabled={!canEdit}
          defaultValue={vitalInputValue(row.gcs)}
          onBlur={(e) =>
            patchPvNumericBlur(e.target.value, onPatch, row.id, 'gcs', {
              min: 3,
              max: 15,
              integer: true,
            })
          }
          className={pvFieldInput}
        />
      </MonitorCell>
      <MonitorCell
        as={cellAs}
        hideLabel={cellAs === 'td'}
        emphasizeLabel={emphasizeLabels}
        labelInline={labelInline}
        label="FR"
        tone={t.fr ?? null}
        boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'w-[3rem] shrink-0'}
      >
        <input
          {...pvNumType()}
          min={mobileSheet ? undefined : 0}
          disabled={!canEdit}
          defaultValue={vitalInputValue(row.fr)}
          onBlur={(e) =>
            patchPvNumericBlur(e.target.value, onPatch, row.id, 'fr', { min: 0, integer: true })
          }
          className={pvFieldInput}
        />
      </MonitorCell>
      <MonitorCell
        as={cellAs}
        hideLabel={cellAs === 'td'}
        emphasizeLabel={emphasizeLabels}
        labelInline={labelInline}
        label="SpO₂ aa"
        tone={t.spo2 ?? null}
        boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'w-[3rem] shrink-0'}
      >
        <input
          {...pvNumType()}
          min={mobileSheet ? undefined : 0}
          max={mobileSheet ? undefined : 100}
          disabled={!canEdit}
          defaultValue={vitalInputValue(row.spo2_aa)}
          onBlur={(e) => {
            const parsed = parseVitalNumericInput(e.target.value, {
              min: 0,
              max: 100,
              integer: true,
            })
            if (parsed === undefined) return
            onPatch(row.id, { spo2_aa: parsed })
          }}
          className={pvFieldInput}
        />
      </MonitorCell>
      <MonitorCell
        as={cellAs}
        hideLabel={cellAs === 'td'}
        emphasizeLabel={emphasizeLabels}
        labelInline={labelInline}
        label="SpO₂ O₂"
        tone={t.spo2 ?? null}
        boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'w-[3rem] shrink-0'}
      >
        <input
          {...pvNumType()}
          min={mobileSheet ? undefined : 0}
          max={mobileSheet ? undefined : 100}
          disabled={!canEdit}
          defaultValue={vitalInputValue(row.spo2_o2)}
          onBlur={(e) => {
            const parsed = parseVitalNumericInput(e.target.value, {
              min: 0,
              max: 100,
              integer: true,
            })
            if (parsed === undefined) return
            onPatch(row.id, { spo2_o2: parsed })
          }}
          className={pvFieldInput}
        />
      </MonitorCell>
      <MonitorCell
        as={cellAs}
        hideLabel={cellAs === 'td'}
        emphasizeLabel={emphasizeLabels}
        labelInline={labelInline}
        label="FC"
        tone={t.fc ?? null}
        boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'w-[3rem] shrink-0'}
      >
        <input
          {...pvNumType()}
          min={mobileSheet ? undefined : 0}
          disabled={!canEdit}
          defaultValue={vitalInputValue(row.fc)}
          onBlur={(e) =>
            patchPvNumericBlur(e.target.value, onPatch, row.id, 'fc', { min: 0, integer: true })
          }
          className={pvFieldInput}
        />
      </MonitorCell>
      <MonitorCell
        as={cellAs}
        hideLabel={cellAs === 'td'}
        emphasizeLabel={emphasizeLabels}
        labelInline={labelInline}
        label="PA sys"
        tone={t.pa_sys ?? null}
        boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'w-[3.1rem] shrink-0'}
      >
        <input
          {...pvNumType()}
          min={mobileSheet ? undefined : 0}
          max={mobileSheet ? undefined : 999}
          disabled={!canEdit}
          defaultValue={vitalInputValue(row.pa_sistolica)}
          onBlur={(e) =>
            patchPvNumericBlur(e.target.value, onPatch, row.id, 'pa_sistolica', {
              min: 0,
              max: 999,
              integer: true,
            })
          }
          className={pvFieldInput}
        />
      </MonitorCell>
      <MonitorCell
        as={cellAs}
        hideLabel={cellAs === 'td'}
        emphasizeLabel={emphasizeLabels}
        labelInline={labelInline}
        label="PA dia"
        tone={t.pa_dia ?? null}
        boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'w-[3.1rem] shrink-0'}
      >
        <input
          {...pvNumType()}
          min={mobileSheet ? undefined : 0}
          max={mobileSheet ? undefined : 999}
          disabled={!canEdit}
          defaultValue={vitalInputValue(row.pa_diastolica)}
          onBlur={(e) =>
            patchPvNumericBlur(e.target.value, onPatch, row.id, 'pa_diastolica', {
              min: 0,
              max: 999,
              integer: true,
            })
          }
          className={pvFieldInput}
        />
      </MonitorCell>
      <MonitorCell
        as={cellAs}
        hideLabel={cellAs === 'td'}
        emphasizeLabel={emphasizeLabels}
        labelInline={labelInline}
        label="T °C"
        tone={t.temp ?? null}
        boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'w-[3.25rem] shrink-0'}
      >
        <input
          {...pvNumType(true)}
          step={mobileSheet ? undefined : 0.1}
          disabled={!canEdit}
          defaultValue={vitalInputValue(row.temperatura)}
          onBlur={(e) => {
            const parsed = parseVitalNumericInput(e.target.value, { min: 30, max: 45 })
            if (parsed === undefined) return
            onPatch(row.id, { temperatura: parsed })
          }}
          className={pvFieldInput}
        />
      </MonitorCell>
      <MonitorCell
        as={cellAs}
        hideLabel={cellAs === 'td'}
        emphasizeLabel={emphasizeLabels}
        labelInline={labelInline}
        label="NRS"
        tone={t.nrs ?? null}
        boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'w-[2.85rem] shrink-0'}
      >
        <input
          {...pvNumType()}
          min={mobileSheet ? undefined : 0}
          max={mobileSheet ? undefined : 10}
          disabled={!canEdit}
          defaultValue={vitalInputValue(row.nrs)}
          onBlur={(e) => {
            const parsed = parseVitalNumericInput(e.target.value, {
              min: 0,
              max: 10,
              integer: true,
            })
            if (parsed === undefined) return
            onPatch(row.id, { nrs: parsed })
          }}
          className={PV_IN_ROW}
        />
      </MonitorCell>
      <MonitorCell
        as={cellAs}
        hideLabel={cellAs === 'td'}
        emphasizeLabel={emphasizeLabels}
        labelInline={labelInline}
        label="Operatore"
        tone={null}
        boxClassName={
          layout === 'stack' || labelInline ? 'w-full min-w-0' : 'min-w-[8.5rem] max-w-[18rem] shrink-0'
        }
      >
        {canEdit ? (
          <input
            type="text"
            defaultValue={row.operatore_nome}
            onBlur={(e) => onPatch(row.id, { operatore_nome: e.target.value.trim() || '—' })}
            className={`${pvFieldInput} text-left normal-case`}
          />
        ) : (
          <div
            className={
              layout === 'stack' || layout === 'inline'
                ? 'break-words px-0.5 text-xs font-medium leading-tight text-slate-900'
                : 'max-w-full overflow-x-auto whitespace-nowrap px-0.5 text-xs font-medium leading-tight text-slate-900'
            }
            title={opNome}
          >
            {opNome}
          </div>
        )}
      </MonitorCell>
    </>
  )

  if (variant === 'tableRow') {
    return (
      <tr className="border-b border-slate-200 odd:bg-white even:bg-slate-50/70">
        {inner}
        {removeButton ? (
          <td className="border border-slate-200 p-1 text-center align-middle">{removeButton}</td>
        ) : null}
      </tr>
    )
  }

  return (
    <div
      className={
        layout === 'inline'
          ? 'min-w-0'
          : 'rounded-md border border-slate-300 bg-slate-200/40 p-1.5 shadow-sm'
      }
    >
      {(layout === 'stack' || layout === 'inline') && removeButton ? (
        <div className="mb-1 flex justify-end">{removeButton}</div>
      ) : null}
      <div
        className={
          layout === 'stack'
            ? 'flex flex-col gap-2'
            : layout === 'inline'
              ? 'flex flex-col gap-0'
              : 'flex min-w-0 flex-wrap items-end gap-1.5 pb-0.5'
        }
      >
        {inner}
        {layout !== 'stack' && layout !== 'inline' ? removeButton : null}
      </div>
    </div>
  )
}

export function ParametriVitaliPanel({
  pazienteId,
  manifestationId,
  rows,
  arrayField,
  fieldGuardKey,
  canEdit,
  write,
  user,
  title = 'Parametri vitali',
  readonlyHint = null,
  onRowCommitted,
}: ParametriVitaliPanelProps) {
  const pmaMobile = useInfermiereSmartphone(user)
  const [pvModalOpen, setPvModalOpen] = useState(false)
  const [pvDraft, setPvDraft] = useState<ParametroVitaleRilevazione | null>(null)
  const pvSorted = useMemo(() => sortPvChronoAsc(rows ?? []), [rows])

  const commitPvRow = useCallback(
    (next: ParametroVitaleRilevazione) => {
      void (async () => {
        try {
          await write({ [arrayField]: [next] })
          onRowCommitted?.(next)
        } catch {
          /* errori già gestiti dal write() del genitore */
        }
      })()
    },
    [write, arrayField, onRowCommitted],
  )

  const patchPv = useCallback(
    (id: string, partial: Partial<ParametroVitaleRilevazione>) => {
      const row = rows.find((r) => r.id === id)
      if (!row) return
      commitPvRow({ ...row, ...partial })
    },
    [rows, commitPvRow],
  )

  const removePv = useCallback(
    (id: string) => {
      void write({ _pmaArrayRemove: { [arrayField]: [id] } })
    },
    [write, arrayField],
  )

  const closePvModal = useCallback(() => {
    setPvModalOpen(false)
    setPvDraft(null)
  }, [])

  const openPvModal = useCallback(() => {
    if (!canEdit) return
    setPvDraft({
      ...emptyParametroVitaleDraft((user?.nome ?? '').trim() || '—'),
      id: `pv-local-${newLocalId()}`,
    })
    setPvModalOpen(true)
  }, [canEdit, user?.nome])

  const savePvDraft = useCallback(async () => {
    if (!canEdit || !pvDraft) return
    const nuovo: ParametroVitaleRilevazione = {
      ...pvDraft,
      id: newLocalId(),
    }
    await appendPmaSchedaArrayRow(manifestationId, pazienteId, arrayField, nuovo)
    onRowCommitted?.(nuovo)
    closePvModal()
  }, [canEdit, pvDraft, manifestationId, pazienteId, arrayField, closePvModal, onRowCommitted])

  async function aggiungiPv() {
    if (!canEdit || !manifestationId || !pazienteId) return
    const nuovo = emptyParametroVitaleDraft((user?.nome ?? '').trim() || '—')
    try {
      await appendPmaSchedaArrayRow(manifestationId, pazienteId, arrayField, nuovo)
      onRowCommitted?.(nuovo)
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : 'Impossibile aggiungere i parametri vitali. Riprova.',
      )
    }
  }

  return (
    <PmaFieldGuard fieldKey={fieldGuardKey}>
      <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-bold text-slate-900 sm:px-3">
        {title}
      </div>
      <div className="space-y-0">
        {readonlyHint}
        {canEdit ? (
          <button
            type="button"
            onClick={() => openPvModal()}
            className={`${btnPrimary} mx-auto mt-2 flex h-10 w-full max-w-md items-center justify-center`}
          >
            Aggiungi parametri
          </button>
        ) : null}
        {pmaMobile ? (
          <div className="pma-pv-stack mt-2">
            {pvSorted.length === 0 ? (
              <p className="text-sm text-slate-500">Nessuna rilevazione registrata.</p>
            ) : (
              pvSorted.map((row) => (
                <ParametriVitaliBlock
                  key={row.id}
                  row={row}
                  canEdit={canEdit}
                  onPatch={patchPv}
                  onRemove={canEdit ? removePv : undefined}
                  layout="stack"
                  variant="block"
                />
              ))
            )}
          </div>
        ) : (
          <div className="mt-2 overflow-x-auto rounded border border-slate-200 [-webkit-overflow-scrolling:touch]">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  <th className="border border-slate-200 p-1">Data/ora</th>
                  <th className="border border-slate-200 p-1">GCS</th>
                  <th className="border border-slate-200 p-1">FR</th>
                  <th className="border border-slate-200 p-1">SpO₂ aa</th>
                  <th className="border border-slate-200 p-1">SpO₂ O₂</th>
                  <th className="border border-slate-200 p-1">FC</th>
                  <th className="border border-slate-200 p-1">PA sys</th>
                  <th className="border border-slate-200 p-1">PA dia</th>
                  <th className="border border-slate-200 p-1">T °C</th>
                  <th className="border border-slate-200 p-1">NRS</th>
                  <th className="border border-slate-200 p-1">Operatore</th>
                  {canEdit ? (
                    <th className="border border-slate-200 p-1 text-center" scope="col">
                      <span className="sr-only">Elimina</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {pvSorted.map((row) => (
                  <ParametriVitaliBlock
                    key={row.id}
                    row={row}
                    canEdit={canEdit}
                    onPatch={patchPv}
                    onRemove={canEdit ? removePv : undefined}
                    layout="row"
                    variant="tableRow"
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pvModalOpen && pvDraft ? (
        <PmaMobileSheet
          fullScreen={pmaMobile}
          ariaLabel="Nuova rilevazione parametri vitali"
          onBackdropClick={closePvModal}
          header={
            <PmaMobileSheetHeader title="Nuova rilevazione" onClose={closePvModal} closeLabel="Annulla" />
          }
          footer={
            <PmaMobileSheetFooterActions
              onCancel={closePvModal}
              onConfirm={() => void savePvDraft()}
              confirmLabel="Salva rilevazione"
              confirmDisabled={!canEdit}
              confirmClassName={btnPrimary}
            />
          }
        >
          <div className="pma-pv-mobile-sheet">
            <ParametriVitaliBlock
              key={pvDraft.id}
              row={pvDraft}
              canEdit={canEdit}
              onPatch={(_id, partial) => {
                setPvDraft((d) => (d ? { ...d, ...partial } : d))
              }}
              layout="inline"
              emphasizeLabels
              mobileSheet
            />
          </div>
        </PmaMobileSheet>
      ) : null}
    </PmaFieldGuard>
  )
}
