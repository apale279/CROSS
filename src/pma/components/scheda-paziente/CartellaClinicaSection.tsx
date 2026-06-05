import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { Timestamp } from 'firebase/firestore'
import { orderedPrestazioniLabels } from '@pma/lib/prestazioniDisplay'
import { datetimeLocalToTimestamp, toDatetimeLocal } from '@pma/lib/schedaDatetimeLocal'
import { registerPmaFarmacoUsato } from '@pma/lib/registerPmaFarmacoUsato'
import { defaultFarmaciConsumatiCatalog } from '@pma/lib/farmaciCatalogoSeed'
import { FarmacoNomeDoseFields } from './FarmacoNomeDoseFields'
import { FarmacoNomeSuggestInput } from '../../../components/pazienti/FarmacoNomeSuggestInput'
import {
  findCatalogEntryByNome,
  type PmaFarmacoCatalogoEntry,
} from '@pma/types/farmaciCatalogo'
import { btnPrimary, btnSecondary } from '@pma/cross/uiTokens'
import { db } from '@pma/cross/firebase'
import { cloudinaryUnsignedUpload } from '@pma/lib/cloudinaryUnsignedUpload'
import { useManifestazioneListeCliniche } from '@pma/hooks/usePmaClinicaListe'
import { useInfermiereSmartphone } from '@pma/hooks/useInfermiereSmartphoneStub'
import { opToolbarBtnSm } from '@pma/cross/operativeTokens'
import {
  ALLERGIE_VERIFICA_LABEL,
  allergieVerificaDisplay,
  type AllergieVerificaStato,
  type Paziente,
} from '@pma/types/paziente'
import { EO_CLINICAL_TABS, type EoTabKey } from '@pma/lib/multilineList'
import {
  EO_PAZIENTE_FIRESTORE_FIELDS,
  firestoreFieldForEoTab,
  resolveEoColumnsForDisplay,
} from '@pma/lib/eoPazienteFields'
import { defaultEoLabelForColumn, eoColumnMergePatchPayload } from '@pma/lib/eoQuickSelection'
import { canInsertFarmaci, type UserRank } from '@pma/lib/rankMatrix'
import {
  appendPmaSchedaArrayRow,
  ensurePmaSchedaEoDefaultsIfEmpty,
} from '@pma/lib/pazientePmaPatch'
import type {
  FarmacoSomministrato,
  FarmacoVia,
  ParametroVitaleRilevazione,
  RivalutazioneVoce,
} from '@pma/types/cartellaClinica'
import { FARMACO_VIA_LABEL, FARMACO_VIE, isFarmacoVia } from '@pma/types/cartellaClinica'
import type { UserProfile } from '@pma/types/userProfile'
import { QuickExamField } from './QuickExamField'
import { LesioniBodyMap } from './LesioniBodyMap'
import { PmaFieldGuard } from '../PmaFieldGuard'
import { PmaCodiceColoreField } from './PmaCodiceColoreField'
import {
  PmaMobileSheet,
  PmaMobileSheetFooterActions,
  PmaMobileSheetHeader,
} from './PmaMobileSheet'
import { emptyParametroVitaleDraft } from '@pma/lib/emptyParametroVitale'
import { newLocalId } from '../../../lib/ids'
import { parseVitalNumericInput, vitalInputValue } from '../../../lib/vitalNumeric'

function allergieVerificaButtonClass(selected: boolean, k: AllergieVerificaStato): string {
  const base =
    'min-h-[44px] w-full rounded-lg border-2 px-2 py-2 text-xs font-bold uppercase shadow-sm transition-colors sm:text-sm'
  if (!selected) {
    return `${base} border-slate-400 bg-white text-slate-800 hover:border-slate-600 hover:bg-slate-50`
  }
  if (k === 'no') {
    return `${base} border-emerald-700 bg-emerald-100 text-emerald-950`
  }
  return `${base} border-red-700 bg-red-50 text-red-900`
}

export type CartellaClinicaSectionProps = {
  pazienteId: string
  p: Paziente
  canEdit: boolean
  write: (patch: Record<string, unknown>) => Promise<void>
  user: UserProfile | null
  /** Dentro tab: niente card esterna ridondante */
  embedded?: boolean
}

function sortPvChronoAsc(rows: ParametroVitaleRilevazione[]) {
  return [...rows].sort((a, b) => a.registrato_at.toMillis() - b.registrato_at.toMillis())
}

/** Dal più vecchio al più recente (cronologia somministrazioni). */
function sortFarmaciChronoAsc(rows: FarmacoSomministrato[]) {
  return [...rows].sort((a, b) => a.registrato_at.toMillis() - b.registrato_at.toMillis())
}

function emptyFarmacoDraft(operatoreNome: string): FarmacoSomministrato {
  return {
    id: newLocalId(),
    nome: '',
    dose: '',
    via: 'EV',
    registrato_at: Timestamp.now(),
    inserito_da_nome: operatoreNome.trim() || '—',
  }
}

function sortRivDesc(rows: RivalutazioneVoce[]) {
  return [...rows].sort((a, b) => b.creato_at.toMillis() - a.creato_at.toMillis())
}

const PV_INPUT =
  'pma-mobile-input mt-0.5 rounded-md border border-slate-300 px-2 py-1.5 font-medium disabled:bg-slate-100'

/** Input modali full-screen smartphone (16px = niente zoom iOS che «allarga» il layout). */
const PMA_MODAL_INPUT = 'pma-mobile-input rounded-md border border-slate-300 px-3 py-2 font-medium disabled:bg-slate-100'

/** Input compatto: riga unica parametri vitali (celle strette). */
const PV_IN_ROW =
  'box-border w-full min-w-0 rounded border border-slate-300 px-0.5 py-1 text-center text-sm font-semibold tabular-nums leading-none disabled:bg-slate-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

type PvTone = 'critical' | 'warn' | null

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

/** Soglie semplificate per evidenziare valori critici in monitoraggio. */
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
  /** In tabella l’header della colonna basta: niente etichetta ripetuta nella cella. */
  hideLabel = false,
  emphasizeLabel = false,
  labelInline = false,
}: {
  as?: 'div' | 'td'
  label: string
  tone: PvTone
  children: ReactNode
  /** Larghezza fissa cella (riga unica). */
  boxClassName?: string
  hideLabel?: boolean
  /** Etichette più leggibili (modale PV smartphone). */
  emphasizeLabel?: boolean
  /** Etichetta a sinistra, campo a destra (modale PV smartphone). */
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
}: {
  row: ParametroVitaleRilevazione
  canEdit: boolean
  onPatch: (id: string, partial: Partial<ParametroVitaleRilevazione>) => void
  onRemove?: (id: string) => void
  /** `stack`: etichetta sopra campo. `inline`: etichetta a sinistra (modale PV smartphone). */
  layout?: 'row' | 'stack' | 'inline'
  /** Riga tabellare (thead separato nel genitore). */
  variant?: 'block' | 'tableRow'
  emphasizeLabels?: boolean
}) {
  const cellAs = variant === 'tableRow' ? 'td' : 'div'
  const labelInline = layout === 'inline'
  const t = pvTones(row)
  const opNome = (row.operatore_nome ?? '').trim() || '—'
  const pvFieldInput = emphasizeLabels
    ? `${PV_IN_ROW} min-h-[2.75rem] text-base font-semibold`
    : PV_IN_ROW
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
        <MonitorCell as={cellAs} hideLabel={cellAs === 'td'} emphasizeLabel={emphasizeLabels} labelInline={labelInline} label="Data/ora" tone={null} boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'w-[11.5rem] shrink-0'}>
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
        <MonitorCell as={cellAs} hideLabel={cellAs === 'td'} emphasizeLabel={emphasizeLabels} labelInline={labelInline} label="GCS" tone={t.gcs ?? null} boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'w-[2.85rem] shrink-0'}>
          <input
            type="number"
            min={1}
            max={15}
            disabled={!canEdit}
            defaultValue={vitalInputValue(row.gcs)}
            onBlur={(e) =>
              patchPvNumericBlur(e.target.value, onPatch, row.id, 'gcs', {
                min: 1,
                max: 15,
                integer: true,
              })
            }
            className={pvFieldInput}
          />
        </MonitorCell>
        <MonitorCell as={cellAs} hideLabel={cellAs === 'td'} emphasizeLabel={emphasizeLabels} labelInline={labelInline} label="FR" tone={t.fr ?? null} boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'w-[3rem] shrink-0'}>
          <input
            type="number"
            min={0}
            disabled={!canEdit}
            defaultValue={vitalInputValue(row.fr)}
            onBlur={(e) =>
              patchPvNumericBlur(e.target.value, onPatch, row.id, 'fr', { min: 0, integer: true })
            }
            className={pvFieldInput}
          />
        </MonitorCell>
        <MonitorCell as={cellAs} hideLabel={cellAs === 'td'} emphasizeLabel={emphasizeLabels} labelInline={labelInline} label="SpO₂ aa" tone={t.spo2 ?? null} boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'w-[3rem] shrink-0'}>
          <input
            type="number"
            min={0}
            max={100}
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
        <MonitorCell as={cellAs} hideLabel={cellAs === 'td'} emphasizeLabel={emphasizeLabels} labelInline={labelInline} label="SpO₂ O₂" tone={t.spo2 ?? null} boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'w-[3rem] shrink-0'}>
          <input
            type="number"
            min={0}
            max={100}
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
        <MonitorCell as={cellAs} hideLabel={cellAs === 'td'} emphasizeLabel={emphasizeLabels} labelInline={labelInline} label="FC" tone={t.fc ?? null} boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'w-[3rem] shrink-0'}>
          <input
            type="number"
            min={0}
            disabled={!canEdit}
            defaultValue={vitalInputValue(row.fc)}
            onBlur={(e) =>
              patchPvNumericBlur(e.target.value, onPatch, row.id, 'fc', { min: 0, integer: true })
            }
            className={pvFieldInput}
          />
        </MonitorCell>
        <MonitorCell as={cellAs} hideLabel={cellAs === 'td'} emphasizeLabel={emphasizeLabels} labelInline={labelInline} label="PA sys" tone={t.pa_sys ?? null} boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'w-[3.1rem] shrink-0'}>
          <input
            type="number"
            min={0}
            max={999}
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
        <MonitorCell as={cellAs} hideLabel={cellAs === 'td'} emphasizeLabel={emphasizeLabels} labelInline={labelInline} label="PA dia" tone={t.pa_dia ?? null} boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'w-[3.1rem] shrink-0'}>
          <input
            type="number"
            min={0}
            max={999}
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
        <MonitorCell as={cellAs} hideLabel={cellAs === 'td'} emphasizeLabel={emphasizeLabels} labelInline={labelInline} label="T °C" tone={t.temp ?? null} boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'w-[3.25rem] shrink-0'}>
          <input
            type="number"
            step="0.1"
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
        <MonitorCell as={cellAs} hideLabel={cellAs === 'td'} emphasizeLabel={emphasizeLabels} labelInline={labelInline} label="NRS" tone={t.nrs ?? null} boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'w-[2.85rem] shrink-0'}>
          <input
            type="number"
            min={0}
            max={10}
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
        <MonitorCell as={cellAs} hideLabel={cellAs === 'td'} emphasizeLabel={emphasizeLabels} labelInline={labelInline} label="Operatore" tone={null} boxClassName={layout === 'stack' || labelInline ? 'w-full min-w-0' : 'min-w-[8.5rem] max-w-[18rem] shrink-0'}>
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

const FARM_CELL =
  'shrink-0 rounded-md border border-slate-200 bg-white px-1 py-0.5 min-w-0 shadow-[inset_0_0_0_0px_transparent]'

/** Stessa scala/stile degli input PV in riga: farmaco → dose → via → orario → utente. */
const FARM_IN_ROW = `${PV_IN_ROW} text-left text-sm font-semibold normal-case`
const FARM_DOSE_CUSTOM = '__custom__'

function FarmacoDoseField({
  catalog,
  row,
  nome,
  dose,
  canEdit,
  onPatch,
  className,
}: {
  catalog: PmaFarmacoCatalogoEntry[]
  row: FarmacoSomministrato
  nome: string
  dose: string
  canEdit: boolean
  onPatch: (id: string, next: FarmacoSomministrato) => void
  className: string
}) {
  const matched = useMemo(() => findCatalogEntryByNome(catalog, nome), [catalog, nome])
  const doseOptions = matched?.dosaggi ?? []
  const doseSelectValue =
    dose && doseOptions.includes(dose) ? dose : doseOptions.length > 0 ? FARM_DOSE_CUSTOM : FARM_DOSE_CUSTOM

  if (!canEdit) {
    return (
      <div className={`${className} flex min-h-[2rem] items-center px-0.5`} title={dose}>
        {dose || '—'}
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-1">
      {doseOptions.length > 0 ? (
        <select
          value={doseSelectValue}
          onChange={(e) => {
            const v = e.target.value
            if (v === FARM_DOSE_CUSTOM) {
              if (doseOptions.includes(dose)) onPatch(row.id, { ...row, dose: '' })
              return
            }
            onPatch(row.id, { ...row, dose: v })
          }}
          className={`${className} px-0`}
        >
          <option value={FARM_DOSE_CUSTOM}>— Altro —</option>
          {doseOptions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      ) : null}
      {doseOptions.length === 0 || doseSelectValue === FARM_DOSE_CUSTOM ? (
        <input
          type="text"
          value={dose}
          onChange={(e) => onPatch(row.id, { ...row, dose: e.target.value })}
          className={className}
          placeholder="Dose…"
        />
      ) : null}
    </div>
  )
}

function FarmacoRow({
  row,
  catalog,
  canEditFarmaci,
  onPatch,
  onRemove,
  layout = 'row',
  variant = 'block',
}: {
  row: FarmacoSomministrato
  catalog: PmaFarmacoCatalogoEntry[]
  canEditFarmaci: boolean
  onPatch: (id: string, next: FarmacoSomministrato) => void
  onRemove: (id: string) => void
  /** Smartphone infermiere: campi in colonna. */
  layout?: 'row' | 'stack'
  variant?: 'block' | 'tableRow'
}) {
  const [nomeDraft, setNomeDraft] = useState(row.nome)
  const [doseDraft, setDoseDraft] = useState(row.dose)

  useEffect(() => {
    setNomeDraft(row.nome)
    setDoseDraft(row.dose)
  }, [row.id, row.nome, row.dose])

  const commitNomeDraft = useCallback(() => {
    const n = nomeDraft.trim()
    if (!n) return
    if (n !== row.nome || doseDraft !== row.dose) {
      onPatch(row.id, { ...row, nome: n, dose: doseDraft })
    }
  }, [nomeDraft, doseDraft, row, onPatch])

  const onNomeDraftChange = useCallback(
    (value: string) => {
      setNomeDraft(value)
      const entry = findCatalogEntryByNome(catalog, value)
      if (!entry) return
      const nextDose = entry.dosaggi.length === 1 ? entry.dosaggi[0] : doseDraft
      if (entry.dosaggi.length === 1) setDoseDraft(entry.dosaggi[0])
      onPatch(row.id, { ...row, nome: entry.nome, dose: nextDose })
    },
    [catalog, doseDraft, row, onPatch],
  )

  const utente = (row.inserito_da_nome ?? '').trim() || '—'
  const rowWrap =
    layout === 'stack'
      ? 'flex min-w-0 flex-col gap-1.5'
      : 'flex min-w-0 flex-nowrap items-end gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]'
  const nomeBox = layout === 'stack' ? 'w-full min-w-0' : 'min-w-[5.5rem] max-w-[14rem] shrink-0'
  const doseBox = layout === 'stack' ? 'w-full min-w-0' : 'w-[4.25rem] shrink-0'
  const viaBox = layout === 'stack' ? 'w-full min-w-0' : 'w-[4.5rem] shrink-0'
  const orarioBox = layout === 'stack' ? 'w-full min-w-0' : 'w-[11.5rem] shrink-0'
  const userBox = layout === 'stack' ? 'w-full min-w-0' : 'min-w-[4.5rem] max-w-[10rem] shrink-0'

  if (variant === 'tableRow') {
    return (
      <tr className="border-b border-slate-200 odd:bg-white even:bg-slate-50/70">
        <td className="border border-slate-200 p-1 align-middle">
          <div className="min-w-0">
            {canEditFarmaci ? (
              <FarmacoNomeSuggestInput
                catalog={catalog}
                value={nomeDraft}
                onChange={onNomeDraftChange}
                onBlur={commitNomeDraft}
                inputClassName={FARM_IN_ROW}
              />
            ) : (
              <div className={`${FARM_IN_ROW} flex min-h-[2rem] items-center px-0.5`} title={row.nome}>
                {row.nome}
              </div>
            )}
          </div>
        </td>
        <td className="border border-slate-200 p-1 align-middle">
          <div className="min-w-0">
            <FarmacoDoseField
              catalog={catalog}
              row={row}
              nome={nomeDraft}
              dose={doseDraft}
              canEdit={canEditFarmaci}
              onPatch={(id, next) => {
                setDoseDraft(next.dose)
                onPatch(id, next)
              }}
              className={FARM_IN_ROW}
            />
          </div>
        </td>
        <td className="border border-slate-200 p-1 align-middle">
          <div className="min-w-0">
            <select
              disabled={!canEditFarmaci}
              value={row.via}
              onChange={(e) => {
                const v = e.target.value
                if (isFarmacoVia(v)) onPatch(row.id, { ...row, via: v })
              }}
              className={`${FARM_IN_ROW} px-0`}
            >
              {FARMACO_VIE.map((via) => (
                <option key={via} value={via}>
                  {FARMACO_VIA_LABEL[via]}
                </option>
              ))}
            </select>
          </div>
        </td>
        <td className="border border-slate-200 p-1 align-middle">
          <div className="min-w-0">
            <input
              type="datetime-local"
              disabled={!canEditFarmaci}
              defaultValue={toDatetimeLocal(row.registrato_at)}
              onBlur={(e) => {
                const ts = datetimeLocalToTimestamp(e.target.value)
                if (ts) onPatch(row.id, { ...row, registrato_at: ts })
              }}
              className={FARM_IN_ROW}
            />
          </div>
        </td>
        <td className="border border-slate-200 p-1 align-middle">
          <div className={`${FARM_IN_ROW} flex min-h-[2rem] items-center px-0.5`} title={utente}>
            {utente}
          </div>
        </td>
        {canEditFarmaci ? (
          <td className="border border-slate-200 p-1 align-middle text-center">
            <button
              type="button"
              title="Rimuovi farmaco"
              aria-label="Rimuovi farmaco"
              onClick={() => onRemove(row.id)}
              className="pma-theme-skip inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
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
          </td>
        ) : null}
      </tr>
    )
  }

  return (
    <div className="rounded-md border border-slate-300 bg-slate-200/40 p-1.5 shadow-sm">
      <div className={rowWrap}>
        <div className={`${FARM_CELL} ${nomeBox}`}>
          {canEditFarmaci ? (
            <FarmacoNomeSuggestInput
              catalog={catalog}
              value={nomeDraft}
              onChange={onNomeDraftChange}
              onBlur={commitNomeDraft}
              inputClassName={FARM_IN_ROW}
            />
          ) : (
            <div className={`${FARM_IN_ROW} flex min-h-[2rem] items-center px-0.5`} title={row.nome}>
              {row.nome}
            </div>
          )}
        </div>
        <div className={`${FARM_CELL} ${doseBox}`}>
          <FarmacoDoseField
            catalog={catalog}
            row={row}
            nome={nomeDraft}
            dose={doseDraft}
            canEdit={canEditFarmaci}
            onPatch={(id, next) => {
              setDoseDraft(next.dose)
              onPatch(id, next)
            }}
            className={FARM_IN_ROW}
          />
        </div>
        <div className={`${FARM_CELL} ${viaBox}`}>
          <select
            disabled={!canEditFarmaci}
            value={row.via}
            onChange={(e) => {
              const v = e.target.value
              if (isFarmacoVia(v)) onPatch(row.id, { ...row, via: v })
            }}
            className={`${FARM_IN_ROW} px-0`}
          >
            {FARMACO_VIE.map((via) => (
              <option key={via} value={via}>
                {FARMACO_VIA_LABEL[via]}
              </option>
            ))}
          </select>
        </div>
        <div className={`${FARM_CELL} ${orarioBox}`}>
          <input
            type="datetime-local"
            disabled={!canEditFarmaci}
            defaultValue={toDatetimeLocal(row.registrato_at)}
            onBlur={(e) => {
              const ts = datetimeLocalToTimestamp(e.target.value)
              if (ts) onPatch(row.id, { ...row, registrato_at: ts })
            }}
            className={FARM_IN_ROW}
          />
        </div>
        <div className={`${FARM_CELL} ${userBox}`}>
          <div className={`${FARM_IN_ROW} flex min-h-[2rem] items-center px-0.5`} title={utente}>
            {utente}
          </div>
        </div>
        {canEditFarmaci ? (
          <button
            type="button"
            title="Rimuovi farmaco"
            aria-label="Rimuovi farmaco"
            onClick={() => onRemove(row.id)}
            className={`pma-theme-skip inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 ${layout === 'stack' ? 'self-end' : 'mb-px self-end'}`}
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
        ) : null}
      </div>
    </div>
  )
}

export function CartellaClinicaSection({
  pazienteId,
  p,
  canEdit,
  write,
  user,
  embedded = false,
}: CartellaClinicaSectionProps) {
  const {
    prestazioni: prestazioniLista,
    farmaciCatalogo: farmaciCatalogoRaw,
    eoQuickGroups,
    eoQuickDefaultLabel,
    presetFarmaci: presetFarmaciPacks,
    loading: manifestListeLoading,
  } = useManifestazioneListeCliniche(p.id_manifestazione)

  const farmaciCatalogo = useMemo(() => {
    if (farmaciCatalogoRaw.length > 0) return farmaciCatalogoRaw
    return defaultFarmaciConsumatiCatalog()
  }, [farmaciCatalogoRaw])

  const registerFarmacoInImpostazioni = useCallback(
    async (nome: string, dose: string, via: FarmacoVia) => {
      try {
        if (db && p.id_manifestazione) {
          await registerPmaFarmacoUsato(db, p.id_manifestazione, { nome, dose, via })
        }
      } catch {
        /* best-effort catalogo consumati */
      }
    },
    [p.id_manifestazione],
  )

  const gruppiEoUi = useMemo(
    () => eoQuickGroups.map((g) => ({ title: g.title, labels: g.labels as readonly string[] })),
    [eoQuickGroups],
  )

  const hideClinicalBlocks = user?.rank === 'Triage'

  const pmaMobile = useInfermiereSmartphone(user)

  const eoResolved = useMemo(() => resolveEoColumnsForDisplay(p, eoQuickGroups), [p, eoQuickGroups])

  const eoSelectedByTab = useMemo((): Record<EoTabKey, string[]> => {
    const o = {} as Record<EoTabKey, string[]>
    for (let i = 0; i < EO_CLINICAL_TABS.length; i++) {
      const tab = EO_CLINICAL_TABS[i]
      const field = EO_PAZIENTE_FIRESTORE_FIELDS[i]
      const group = eoQuickGroups.find((g) => g.title === tab)
      const allowed = new Set(group?.labels ?? [])
      const raw = [...(eoResolved[field] ?? [])]
      o[tab] = raw.filter((x) => allowed.has(x))
    }
    return o
  }, [eoResolved, eoQuickGroups])

  /** Colonna EO vuota in UI → default «NELLA NORMA» solo se ancora vuota sul server (multi-operatore). */
  useEffect(() => {
    if (!canEdit || hideClinicalBlocks) return
    if (manifestListeLoading) return

    const entries: { field: string; defLabel: string }[] = []
    for (const tab of EO_CLINICAL_TABS) {
      const field = firestoreFieldForEoTab(tab)
      const col = eoSelectedByTab[tab] ?? []
      const group = eoQuickGroups.find((g) => g.title === tab)
      const labels = (group?.labels ?? []).map((x) => x.trim()).filter(Boolean)
      if (labels.length === 0 || col.length > 0) continue
      const defLabel = defaultEoLabelForColumn(labels)
      if (!defLabel) continue
      entries.push({ field, defLabel })
    }
    if (entries.length === 0) return
    void ensurePmaSchedaEoDefaultsIfEmpty(p.id_manifestazione, pazienteId, entries)
  }, [
    canEdit,
    hideClinicalBlocks,
    manifestListeLoading,
    eoQuickGroups,
    eoSelectedByTab,
    p.id_manifestazione,
    pazienteId,
  ])

  const patchEoColumn = useCallback(
    (tab: EoTabKey, baseAtOpen: string[], draft: string[]) => {
      const field = firestoreFieldForEoTab(tab)
      const group = eoQuickGroups.find((g) => g.title === tab)
      const labels = group?.labels ?? []
      void write({
        [field]: eoColumnMergePatchPayload(baseAtOpen, draft, labels),
      } as Record<string, unknown>)
    },
    [write, eoQuickGroups],
  )

  const userRank = (user?.rank ?? null) as UserRank | null
  const canEditFarmaciRank = Boolean(userRank && canInsertFarmaci(userRank))
  const canEditFarmaci = Boolean(canEdit && canEditFarmaciRank)

  const bloccoVerificaAllergie = Boolean(canEdit && !p.allergie_verifica)
  const schedaClinicalEdit = Boolean(canEdit && !bloccoVerificaAllergie)
  const farmaciEdit = Boolean(canEditFarmaci && schedaClinicalEdit)

  const farmaciRankBlocked = Boolean(canEdit && schedaClinicalEdit && user && !canEditFarmaciRank)
  const schedaReadonlyHint = Boolean(
    canEdit === false && user,
  )

  const canEditRivalutazioniEsistenti = Boolean(canEdit && user?.rank === 'Medico')

  const pvSorted = useMemo(() => sortPvChronoAsc(p.parametri_vitali), [p.parametri_vitali])
  const farmaciSorted = useMemo(() => sortFarmaciChronoAsc(p.farmaci), [p.farmaci])
  const rivSorted = useMemo(() => sortRivDesc(p.rivalutazioni), [p.rivalutazioni])

  const patchPv = useCallback(
    (id: string, partial: Partial<ParametroVitaleRilevazione>) => {
      const row = p.parametri_vitali.find((r) => r.id === id)
      if (!row) return
      const next: ParametroVitaleRilevazione = { ...row, ...partial }
      void write({ parametri_vitali: [next] })
    },
    [p.parametri_vitali, write],
  )

  const removePv = useCallback(
    (id: string) => {
      void write({ _pmaArrayRemove: { parametri_vitali: [id] } })
    },
    [write],
  )

  const patchFarmaco = useCallback(
    (id: string, next: FarmacoSomministrato) => {
      void write({ farmaci: [next] })
      const nome = next.nome.trim()
      if (nome) {
        void registerFarmacoInImpostazioni(nome, next.dose.trim(), next.via)
      }
    },
    [write, registerFarmacoInImpostazioni],
  )

  const removeFarmaco = useCallback(
    (id: string) => {
      void write({ _pmaArrayRemove: { farmaci: [id] } })
    },
    [write],
  )

  const togglePrestazione = useCallback(
    (label: string) => {
      const set = new Set(p.prestazioni_sel)
      const removing = set.has(label)
      if (removing) set.delete(label)
      else set.add(label)
      void write({
        prestazioni_sel: Array.from(set),
        ...(removing ? { _pmaArrayRemove: { prestazioni_sel: [label] } } : {}),
      })
    },
    [p.prestazioni_sel, write],
  )

  const [rivDraft, setRivDraft] = useState('')
  const [ecgUploadBusy, setEcgUploadBusy] = useState(false)
  const [ecgUploadErr, setEcgUploadErr] = useState<string | null>(null)
  const ecgFileInputRef = useRef<HTMLInputElement>(null)
  const [pvModalOpen, setPvModalOpen] = useState(false)
  const [pvDraft, setPvDraft] = useState<ParametroVitaleRilevazione | null>(null)
  const [prestModalOpen, setPrestModalOpen] = useState(false)
  const [farmModalOpen, setFarmModalOpen] = useState(false)
  const [farmModalNome, setFarmModalNome] = useState('')
  const [farmModalDose, setFarmModalDose] = useState('')
  const [farmModalVia, setFarmModalVia] = useState<FarmacoVia>('EV')
  const [farmModalTs, setFarmModalTs] = useState(() => toDatetimeLocal(Timestamp.now()))

  const closePvModal = useCallback(() => {
    setPvModalOpen(false)
    setPvDraft(null)
  }, [])

  const openPvModal = useCallback(() => {
    if (!schedaClinicalEdit) return
    setPvDraft({
      ...emptyParametroVitaleDraft((user?.nome ?? '').trim() || '—'),
      id: `pv-local-${newLocalId()}`,
    })
    setPvModalOpen(true)
  }, [schedaClinicalEdit, user?.nome])

  const savePvDraft = useCallback(async () => {
    if (!schedaClinicalEdit || !pvDraft) return
    const nuovo: ParametroVitaleRilevazione = {
      ...pvDraft,
      id: newLocalId(),
    }
    await appendPmaSchedaArrayRow(p.id_manifestazione, pazienteId, 'parametri_vitali', nuovo)
    closePvModal()
  }, [schedaClinicalEdit, pvDraft, p.id_manifestazione, pazienteId, closePvModal])

  async function salvaFarmacoModal() {
    if (!canEditFarmaci) return
    const nome = farmModalNome.trim()
    if (!nome) return
    const ts = datetimeLocalToTimestamp(farmModalTs) ?? Timestamp.now()
    const ins = (user?.nome ?? '').trim() || '—'
    const nuovo: FarmacoSomministrato = {
      id: newLocalId(),
      nome,
      dose: farmModalDose.trim(),
      via: farmModalVia,
      registrato_at: ts,
      inserito_da_nome: ins,
    }
    await appendPmaSchedaArrayRow(p.id_manifestazione, pazienteId, 'farmaci', nuovo)
    await registerFarmacoInImpostazioni(nome, farmModalDose.trim(), farmModalVia)
    setFarmModalOpen(false)
    setFarmModalDose('')
    setFarmModalNome('')
    setFarmModalVia('EV')
    setFarmModalTs(toDatetimeLocal(Timestamp.now()))
  }

  const openFarmModal = useCallback(() => {
    setFarmModalNome('')
    setFarmModalDose('')
    setFarmModalVia('EV')
    setFarmModalTs(toDatetimeLocal(Timestamp.now()))
    setFarmModalOpen(true)
  }, [])

  async function aggiungiFarmaco() {
    if (!farmaciEdit || !p.id_manifestazione || !pazienteId) return
    const nuovo = emptyFarmacoDraft((user?.nome ?? '').trim() || '—')
    try {
      await appendPmaSchedaArrayRow(p.id_manifestazione, pazienteId, 'farmaci', nuovo)
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : 'Impossibile aggiungere il farmaco. Riprova.',
      )
    }
  }

  async function aggiungiPv() {
    if (!schedaClinicalEdit || !p.id_manifestazione || !pazienteId) return
    const nuovo = emptyParametroVitaleDraft((user?.nome ?? '').trim() || '—')
    try {
      await appendPmaSchedaArrayRow(p.id_manifestazione, pazienteId, 'parametri_vitali', nuovo)
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : 'Impossibile aggiungere i parametri vitali. Riprova.',
      )
    }
  }

  async function importaPresetFarmaciPack(packIdx: number) {
    if (!canEditFarmaci) return
    const pack = presetFarmaciPacks[packIdx]
    if (!pack) return
    const ts = Timestamp.now()
    const ins = (user?.nome ?? '').trim() || '—'
    const nuovi: FarmacoSomministrato[] = []
    for (const row of pack.farmaci) {
      const nome = row.nome.trim()
      if (!nome) continue
      nuovi.push({
        id: newLocalId(),
        nome,
        dose: row.dose.trim(),
        via: row.via,
        registrato_at: ts,
        inserito_da_nome: ins,
      })
    }
    if (nuovi.length === 0) return
    for (const row of nuovi) {
      await appendPmaSchedaArrayRow(p.id_manifestazione, pazienteId, 'farmaci', row)
    }
    for (const n of nuovi) {
      await registerFarmacoInImpostazioni(n.nome, n.dose, n.via)
    }
  }

  async function aggiungiRivalutazione() {
    if (!canEdit || !user) return
    const t = rivDraft.trim()
    if (!t) return
    await appendPmaSchedaArrayRow(p.id_manifestazione, pazienteId, 'rivalutazioni', {
      id: newLocalId(),
      testo: t,
      creato_at: Timestamp.now(),
      firma_uid: user.uid,
      firma_nome: user.nome,
    })
    setRivDraft('')
  }

  const patchRivalutazioneTesto = useCallback(
    (id: string, testo: string) => {
      const row = p.rivalutazioni.find((r) => r.id === id)
      if (!row) return
      void write({ rivalutazioni: [{ ...row, testo }] })
    },
    [p.rivalutazioni, write],
  )

  async function onEcgFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !canEdit) return
    if (!file.type.startsWith('image/')) {
      setEcgUploadErr('Seleziona un file immagine (foto ECG).')
      return
    }
    setEcgUploadErr(null)
    setEcgUploadBusy(true)
    try {
      const { secure_url } = await cloudinaryUnsignedUpload(file)
      await write({ ecg_cloudinary_url: secure_url })
    } catch (err) {
      setEcgUploadErr(err instanceof Error ? err.message : 'Upload ECG non riuscito.')
    } finally {
      setEcgUploadBusy(false)
    }
  }

  const selPrest = new Set(p.prestazioni_sel)
  const prestazioniOrdinate = useMemo(
    () => orderedPrestazioniLabels(prestazioniLista, p.prestazioni_sel ?? []),
    [prestazioniLista, p.prestazioni_sel],
  )

  return (
    <section
      className={
        embedded
          ? 'min-w-0 space-y-0'
          : 'min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white'
      }
    >
      {!embedded ? <div className="pma-section-hdr">Sezione 3 — Cartella clinica</div> : null}

      <div className={embedded ? 'mt-3 space-y-0' : 'mt-3 space-y-0 border-t border-slate-100 pt-3'}>
        {embedded ? (
          <div className="mb-4 space-y-3 border-b border-slate-200 pb-4">
            <PmaFieldGuard fieldKey="codice_colore">
              <PmaCodiceColoreField
                compact
                value={p.codice_colore}
                canEdit={schedaClinicalEdit}
                onChange={(c) => void write({ codice_colore: c })}
              />
            </PmaFieldGuard>
          </div>
        ) : null}
        <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-bold text-slate-900 sm:px-3">
          Valutazione e anamnesi
        </div>
        <div className="space-y-0">
            <PmaFieldGuard
              fieldKey="allergie_verifica"
              className={`pma-allergie-verifica block ${bloccoVerificaAllergie ? 'pma-allergie-verifica--pending' : ''}`}
            >
              <span className="pma-field__label">Domanda allergie</span>
              <p className="mt-1 text-sm leading-snug text-slate-700">
                Il paziente ha allergie farmacologiche o di altro tipo da segnalare?
              </p>
              {bloccoVerificaAllergie && canEdit ? (
                <p className="mt-1 text-xs font-semibold text-red-700">
                  Seleziona SI, NO o NON NOTO per sbloccare la cartella sottostante.
                </p>
              ) : null}
              {canEdit ? (
                <div
                  className="pma-allergie-verifica__actions pb-0.5"
                  role="group"
                  aria-label={
                    bloccoVerificaAllergie
                      ? 'Risposta obbligatoria domanda allergie'
                      : 'Risposta domanda allergie'
                  }
                >
                  {(['si', 'no', 'non_noto'] as const satisfies readonly AllergieVerificaStato[]).map((k) => {
                    const selected = p.allergie_verifica === k
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => void write({ allergie_verifica: k })}
                        className={allergieVerificaButtonClass(selected, k)}
                      >
                        {ALLERGIE_VERIFICA_LABEL[k]}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="mt-4 pb-0.5 text-sm font-semibold tabular-nums text-slate-900">
                  {allergieVerificaDisplay(p.allergie_verifica)}
                </div>
              )}
            </PmaFieldGuard>
            <PmaFieldGuard fieldKey="allergie" className="block">
            <label className="pma-field">
              <span className="pma-field__label">Allergie</span>
              <textarea
                key={`all-${pazienteId}-${p.allergie}`}
                disabled={!schedaClinicalEdit}
                rows={2}
                defaultValue={p.allergie}
                onBlur={(e) => void write({ allergie: e.target.value })}
              />
            </label>
            </PmaFieldGuard>
            <PmaFieldGuard fieldKey="apr" className="block">
            <label className="pma-field">
              <span className="pma-field__label">APR (anamnesi patologica remota)</span>
              <textarea
                key={`apr-${pazienteId}-${p.apr}`}
                disabled={!schedaClinicalEdit}
                rows={3}
                defaultValue={p.apr}
                onBlur={(e) => void write({ apr: e.target.value })}
              />
            </label>
            </PmaFieldGuard>
            <PmaFieldGuard fieldKey="app" className="block">
            <label className="pma-field">
              <span className="pma-field__label">APP (anamnesi patologica prossima)</span>
              <textarea
                key={`app-${pazienteId}-${p.app}`}
                disabled={!schedaClinicalEdit}
                rows={3}
                defaultValue={p.app}
                onBlur={(e) => void write({ app: e.target.value })}
              />
            </label>
            </PmaFieldGuard>
            {!hideClinicalBlocks ? (
              <>
                <PmaFieldGuard fieldKey="eo_note" className="pma-card mt-3 overflow-hidden">
                  <div className="pma-card__hdr">Esame obiettivo (EO)</div>
                  <div className="border-t border-slate-100 bg-slate-50/80 p-2">
                    <QuickExamField
                      key={`qe-${pazienteId}`}
                      note={p.eo_note}
                      disabled={!schedaClinicalEdit}
                      gruppiRapidi={gruppiEoUi}
                      selectedByTab={eoSelectedByTab}
                      onColumnSelectionChange={patchEoColumn}
                      onNoteBlur={(text) => void write({ eo_note: text })}
                    />
                  </div>
                </PmaFieldGuard>
                <PmaFieldGuard fieldKey="lesioni" className="pma-card mt-3 overflow-hidden">
                  <div className="pma-card__hdr">Lesioni</div>
                  <div className="border-t border-slate-100 bg-slate-50/80 p-2">
                    <LesioniBodyMap
                      lesioni={p.lesioni}
                      disabled={!schedaClinicalEdit}
                      onLesioniChange={(next, meta) => {
                        if (meta?.removeLesioneN != null) {
                          void write({ _pmaArrayRemove: { lesioni: [meta.removeLesioneN] } })
                          return
                        }
                        const added = next.find((l) => !p.lesioni.some((prev) => prev.n === l.n))
                        if (added) {
                          void write({ lesioni: [added] })
                          return
                        }
                        const changed = next.find((l) => {
                          const prev = p.lesioni.find((x) => x.n === l.n)
                          return prev && prev.descrizione !== l.descrizione
                        })
                        if (changed) void write({ lesioni: [changed] })
                      }}
                    />
                  </div>
                </PmaFieldGuard>
              </>
            ) : null}
        </div>

        {!hideClinicalBlocks ? (
          <>
            <PmaFieldGuard fieldKey="parametri_vitali">
            <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-bold text-slate-900 sm:px-3">
              Parametri vitali
            </div>
            <div className="space-y-0">
          {schedaReadonlyHint && bloccoVerificaAllergie ? null : schedaReadonlyHint ? (
            <p className="mx-auto mt-2 max-w-md text-center text-xs font-semibold text-amber-800">
              Scheda in sola lettura per il tuo account. Verifica: paziente <strong>in carico</strong> al
              PMA, accesso da tenda (/pma) o sblocco scheda in centrale.
            </p>
          ) : null}
          {schedaClinicalEdit ? (
            <button
              type="button"
              onClick={() => (pmaMobile ? openPvModal() : void aggiungiPv())}
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
                    canEdit={schedaClinicalEdit}
                    onPatch={patchPv}
                    onRemove={schedaClinicalEdit ? removePv : undefined}
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
                    {schedaClinicalEdit ? (
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
                      canEdit={schedaClinicalEdit}
                      onPatch={patchPv}
                      onRemove={schedaClinicalEdit ? removePv : undefined}
                      layout="row"
                      variant="tableRow"
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
            </PmaFieldGuard>

            <PmaFieldGuard fieldKey="prestazioni_sel">
            <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-bold text-slate-900 sm:px-3">
              Terapie e prestazioni
            </div>
            <div className="space-y-0">
          <div className="mt-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0 flex-1 max-w-xl">
                <span className="pma-field__label">Prestazioni</span>
              </div>
              <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
                <input
                  ref={ecgFileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  aria-hidden
                  tabIndex={-1}
                  onChange={(e) => void onEcgFileChange(e)}
                />
                <button
                  type="button"
                  disabled={!schedaClinicalEdit || ecgUploadBusy}
                  title="Carica foto ECG su Cloudinary e collega alla scheda"
                  onClick={() => ecgFileInputRef.current?.click()}
                  className={`${btnSecondary} inline-flex h-10 min-w-0 items-center justify-center gap-1.5 px-3 sm:h-9 disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <svg width="18" height="14" viewBox="0 0 24 18" fill="none" aria-hidden className="shrink-0 text-red-600">
                    <path
                      d="M1 9h2l2-6 3 12 3-8 2 5h2l2-3h3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {ecgUploadBusy ? '…' : 'ALLEGA ECG'}
                </button>
                {p.ecg_cloudinary_url ? (
                  <a
                    href={p.ecg_cloudinary_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
                  >
                    Apri ECG
                  </a>
                ) : null}
              </div>
            </div>
            {ecgUploadErr ? (
              <p className="mt-1 text-right text-xs text-red-600" role="alert">
                {ecgUploadErr}
              </p>
            ) : null}
            {pmaMobile ? (
              <button
                type="button"
                disabled={!schedaClinicalEdit}
                onClick={() => setPrestModalOpen(true)}
                className="mt-2 flex w-full max-w-xl items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  {selPrest.size === 0
                    ? 'Scegli prestazioni…'
                    : selPrest.size === 1
                      ? '1 prestazione selezionata — tocca per modificare'
                      : `${selPrest.size} prestazioni selezionate — tocca per modificare`}
                </span>
                <span className="shrink-0 text-slate-400" aria-hidden>
                  ▼
                </span>
              </button>
            ) : (
              <details className="mt-2 max-w-xl rounded-lg border border-slate-300 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50">
                  <span>
                    {selPrest.size === 0
                      ? 'Nessuna selezione — clicca per aprire e scegliere'
                      : selPrest.size === 1
                        ? '1 prestazione selezionata'
                        : `${selPrest.size} prestazioni selezionate`}
                  </span>
                  <span className="shrink-0 text-slate-400" aria-hidden>
                    ▼
                  </span>
                </summary>
                <div className="max-h-60 overflow-y-auto border-t border-slate-200 p-2">
                  {prestazioniLista.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-slate-500">
                      Nessuna prestazione configurata sulla manifestazione.
                    </p>
                  ) : (
                    prestazioniLista.map((label) => (
                      <label
                        key={label}
                        className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                          checked={selPrest.has(label)}
                          disabled={!schedaClinicalEdit}
                          onChange={() => togglePrestazione(label)}
                        />
                        <span className="min-w-0 leading-snug text-slate-800">{label}</span>
                      </label>
                    ))
                  )}
                </div>
              </details>
            )}
            <div className="mt-3">
              <span className="pma-field__label">Prestazioni selezionate</span>
              {prestazioniOrdinate.length === 0 ? (
                <p className="mt-1 text-xs text-slate-500">Nessuna prestazione selezionata.</p>
              ) : (
                <ul
                  className="pma-prest-grid mt-2 grid list-none grid-cols-4 gap-2 p-0"
                  aria-label="Elenco prestazioni selezionate"
                >
                  {prestazioniOrdinate.map((label) => (
                    <li
                      key={label}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium leading-snug text-slate-800"
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
            </div>
            </PmaFieldGuard>

          <PmaFieldGuard fieldKey="farmaci">
            <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-bold text-slate-900 sm:px-3">
              Farmaci
            </div>
            <div className="space-y-0">
            {farmaciRankBlocked ? (
              <p className="mx-auto mt-2 max-w-md text-center text-xs font-semibold text-amber-800">
                Il tuo account ({userRank ?? 'ruolo non configurato'}) non può inserire farmaci.
                Serve ruolo Medico o Infermiere in Impostazioni → Account utenti (campo pmaRank).
              </p>
            ) : null}
            {farmaciEdit ? (
              <button
                type="button"
                onClick={() => (pmaMobile ? openFarmModal() : void aggiungiFarmaco())}
                className={`${btnPrimary} mx-auto mt-2 flex h-10 w-full max-w-md items-center justify-center`}
              >
                Aggiungi farmaco
              </button>
            ) : null}
            <div className="mt-2 overflow-x-auto rounded border border-slate-200 [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                    <th className="border border-slate-200 p-1">Farmaco</th>
                    <th className="border border-slate-200 p-1">Dose</th>
                    <th className="border border-slate-200 p-1">Via</th>
                    <th className="border border-slate-200 p-1">Orario</th>
                    <th className="border border-slate-200 p-1">Operatore</th>
                    {farmaciEdit ? (
                      <th className="border border-slate-200 p-1 text-center" scope="col">
                        <span className="sr-only">Elimina</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {farmaciSorted.length === 0 ? (
                    <tr>
                      <td
                        colSpan={farmaciEdit ? 6 : 5}
                        className="border border-slate-200 p-3 text-sm text-slate-500"
                      >
                        Nessun farmaco registrato.
                      </td>
                    </tr>
                  ) : (
                    farmaciSorted.map((row) => (
                      <FarmacoRow
                        key={row.id}
                        variant="tableRow"
                        row={row}
                        catalog={farmaciCatalogo}
                        canEditFarmaci={farmaciEdit}
                        onPatch={patchFarmaco}
                        onRemove={removeFarmaco}
                        layout="row"
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {presetFarmaciPacks.length > 0 && farmaciEdit ? (
              <div className="mt-4 flex max-w-xl min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <span className="pma-field__label !mb-0 shrink-0 sm:whitespace-nowrap">PRESET FARMACI</span>
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Importa preset farmaci</span>
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm font-medium text-slate-900 shadow-sm"
                    aria-label="Importa preset farmaci"
                    defaultValue=""
                    onChange={(e) => {
                      const v = e.target.value
                      e.target.value = ''
                      if (v === '') return
                      const idx = Number(v)
                      if (!Number.isFinite(idx)) return
                      void importaPresetFarmaciPack(idx)
                    }}
                  >
                    <option value="">—</option>
                    {presetFarmaciPacks.map((pack, idx) => (
                      <option key={`${pack.nome}-${idx}`} value={idx}>
                        {pack.nome.trim() || `Preset ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            </div>
          </PmaFieldGuard>
          </>
        ) : null}

        {!hideClinicalBlocks && pmaMobile && pvModalOpen && pvDraft ? (
          <PmaMobileSheet
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
                confirmDisabled={!schedaClinicalEdit}
                confirmClassName={btnPrimary}
              />
            }
          >
            <div className="[&_input]:pma-mobile-input [&_input]:min-h-[2.75rem]">
              <ParametriVitaliBlock
                key={pvDraft.id}
                row={pvDraft}
                canEdit={schedaClinicalEdit}
                onPatch={(_id, partial) => {
                  setPvDraft((d) => (d ? { ...d, ...partial } : d))
                }}
                layout="inline"
                emphasizeLabels
              />
            </div>
          </PmaMobileSheet>
        ) : null}

        {!hideClinicalBlocks && pmaMobile && prestModalOpen ? (
          <PmaMobileSheet
            ariaLabel="Selezione prestazioni"
            onBackdropClick={() => setPrestModalOpen(false)}
            header={
              <PmaMobileSheetHeader
                title="Prestazioni"
                onClose={() => setPrestModalOpen(false)}
              />
            }
          >
            <div className="max-h-[min(70vh,24rem)] overflow-y-auto overflow-x-hidden">
              {prestazioniLista.length === 0 ? (
                <p className="py-2 text-sm text-slate-500">
                  Nessuna prestazione configurata sulla manifestazione.
                </p>
              ) : (
                prestazioniLista.map((label) => (
                  <label
                    key={label}
                    className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-1 py-2 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                      checked={selPrest.has(label)}
                      disabled={!schedaClinicalEdit}
                      onChange={() => togglePrestazione(label)}
                    />
                    <span className="min-w-0 break-words leading-snug text-slate-800">{label}</span>
                  </label>
                ))
              )}
            </div>
          </PmaMobileSheet>
        ) : null}

        {!hideClinicalBlocks && pmaMobile && farmModalOpen && farmaciEdit ? (
          <PmaMobileSheet
            ariaLabel="Aggiungi farmaco"
            onBackdropClick={() => setFarmModalOpen(false)}
            header={
              <PmaMobileSheetHeader
                title="Nuovo farmaco"
                onClose={() => setFarmModalOpen(false)}
              />
            }
            footer={
              <PmaMobileSheetFooterActions
                onCancel={() => setFarmModalOpen(false)}
                onConfirm={() => void salvaFarmacoModal()}
                confirmLabel="Aggiungi"
                confirmDisabled={!farmModalNome.trim()}
                confirmClassName={btnPrimary}
              />
            }
          >
            <FarmacoNomeDoseFields
              catalog={farmaciCatalogo}
              nome={farmModalNome}
              dose={farmModalDose}
              onNomeChange={setFarmModalNome}
              onDoseChange={setFarmModalDose}
              inputClassName={PMA_MODAL_INPUT}
            />
            <label className="pma-sheet-field-row min-w-0 text-xs">
              <span className="pma-sheet-field-row__label font-semibold uppercase tracking-wider text-slate-500">Via</span>
              <select
                value={farmModalVia}
                onChange={(e) => {
                  const v = e.target.value
                  if (isFarmacoVia(v)) setFarmModalVia(v)
                }}
                className={`${PMA_MODAL_INPUT} min-h-[2.75rem]`}
              >
                {FARMACO_VIE.map((via) => (
                  <option key={via} value={via}>
                    {FARMACO_VIA_LABEL[via]}
                  </option>
                ))}
              </select>
            </label>
            <label className="pma-sheet-field-row min-w-0 text-xs">
              <span className="pma-sheet-field-row__label font-semibold uppercase tracking-wider text-slate-500">Orario</span>
              <input
                type="datetime-local"
                value={farmModalTs}
                onChange={(e) => setFarmModalTs(e.target.value)}
                className={`${PMA_MODAL_INPUT} min-h-[2.75rem]`}
              />
            </label>
          </PmaMobileSheet>
        ) : null}

        <PmaFieldGuard fieldKey="rivalutazioni">
        <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-bold text-slate-900 sm:px-3">
          Rivalutazione
        </div>
        <div className="space-y-0">
          <div className="mt-4 space-y-3">
            {rivSorted.map((r) => (
              <div key={r.id} className="pma-card text-sm">
                <div className="text-xs pma-field__value--muted">
                  {r.creato_at.toDate().toLocaleString('it-IT')} · {r.firma_nome}
                </div>
                {canEditRivalutazioniEsistenti && schedaClinicalEdit ? (
                  <label className="mt-2 block">
                    <span className="sr-only">Testo rivalutazione</span>
                    <textarea
                      key={`riv-edit-${r.id}-${r.testo.slice(0, 40)}`}
                      defaultValue={r.testo}
                      rows={4}
                      onBlur={(e) => {
                        const v = e.target.value
                        if (v !== r.testo) patchRivalutazioneTesto(r.id, v)
                      }}
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                ) : (
                  <p className="mt-1 whitespace-pre-wrap pma-field__value">{r.testo}</p>
                )}
              </div>
            ))}
            {rivSorted.length === 0 ? (
              <p className="text-sm pma-field__value--muted">Nessuna rivalutazione.</p>
            ) : null}
          </div>
          {schedaClinicalEdit ? (
            <div className="pma-card mt-4">
              <label className="block">
                <span className="pma-field__label">Nuova nota</span>
                <textarea
                  value={rivDraft}
                  onChange={(e) => setRivDraft(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <button
                type="button"
                disabled={!rivDraft.trim()}
                onClick={() => void aggiungiRivalutazione()}
                className={`${btnPrimary} mt-3 disabled:opacity-40`}
              >
                Aggiungi rivalutazione
              </button>
            </div>
          ) : null}
        </div>
        </PmaFieldGuard>
      </div>
    </section>
  )
}
