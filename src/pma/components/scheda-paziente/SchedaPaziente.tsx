import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@pma/cross/stub/AuthContext'
import { db } from '@pma/lib/firebase'
import { calculateEtaAnni, patchEtaFromDataNascita } from '@pma/lib/calculateEtaAnni'
import {
  datetimeLocalToTimestamp,
  toDatetimeLocal,
  toYmd,
  ymdToTimestamp,
} from '@pma/lib/schedaDatetimeLocal'
import { updateSchedaPazienteGranular } from '@pma/lib/updateSchedaPaziente'
import { staffSoftRefFromUser } from '@pma/lib/staffSoftRef'
import { statiSelezionabiliPerRank } from '@pma/lib/pazienteStatoUi'
import {
  canWriteInvioPsFields,
  schedaStatoInArrivoAllows,
  schedaTabDimissioneAllows,
} from '@pma/lib/rankMatrix'
import { usePazienteDoc } from '../../hooks/usePazienteDoc'
import type { CodiceColorePaziente, PazienteStato, TipoPaziente } from '@pma/types/paziente'
import {
  CODICE_COLORE_LABEL,
  PAZIENTE_STATO_LABEL,
  TIPO_PAZIENTE_LABEL,
} from '@pma/types/paziente'
import { CartellaClinicaSection } from './CartellaClinicaSection'
import { DettaglioPaziente } from './DettaglioPaziente'
import { DimissioneSection } from './DimissioneSection'
import { InvioOspedaleSection } from './InvioOspedaleSection'
import { EtaPmaCountdown } from './EtaPmaCountdown'
import { schedaPazienteTabsFor, type SchedaPazienteTabId } from './schedaPazienteTabs'
import { useManifestazioneListeCliniche } from '@pma/hooks/usePmaClinicaListe'
import { useManifestazionePartecipantiElenco } from '../../hooks/useManifestazionePartecipantiElenco'
import { useManifestazioneDoc } from '../../hooks/useManifestazioneDoc'
import { usePmaDocSnapshot } from '../../hooks/usePmaDocNome'
import { usePmaListForManifestazione } from '../../hooks/usePmaListForManifestazione'
import { createPmaAlert } from '@pma/lib/createPmaAlert'
import { SchedaPazienteShell } from '../pma/SchedaPazienteShell'
import { findPartecipanteByPettorale } from '@pma/types/manifestazionePartecipanti'
import { TesseraSanitariaCfScanner } from './TesseraSanitariaCfScanner'
import { CrossDatiSchedaPanel } from './CrossDatiSchedaPanel'

type Props = {
  pazienteId: string
}

/** Ordine UI v4: Bianco → Verde → Giallo → Rosso */
const CODICI_UI: CodiceColorePaziente[] = ['bianco', 'verde', 'giallo', 'rosso']
const TIPI: TipoPaziente[] = ['trasportato', 'autopresentato']

function pillCodiceColore(c: CodiceColorePaziente, on: boolean): string {
  if (c === 'bianco') return `pma-pill ${on ? 'pma-pill--bianco-on' : 'pma-pill--bianco-off'}`
  if (c === 'verde') return `pma-pill ${on ? 'pma-pill--verde-on' : 'pma-pill--verde-off'}`
  if (c === 'giallo') return `pma-pill ${on ? 'pma-pill--giallo-on' : 'pma-pill--giallo-off'}`
  return `pma-pill ${on ? 'pma-pill--rosso-on' : 'pma-pill--rosso-off'}`
}

function pillStato(on: boolean): string {
  return `pma-pill ${on ? 'pma-pill--stato-on' : 'pma-pill--stato-off'}`
}

function emailTelLegacy(email: string, telefono: string): string {
  const e = email.trim()
  const t = telefono.trim()
  if (e && t) return `${e} · ${t}`
  return e || t
}

export function SchedaPaziente({ pazienteId }: Props) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { id: pmaRouteId } = useParams<{ id: string }>()
  const { data: p, loading, error, exists } = usePazienteDoc(pazienteId)
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrlApplied = useRef<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SchedaPazienteTabId>('generale')
  const [dataNascitaDraft, setDataNascitaDraft] = useState('')
  const [contact, setContact] = useState({ email: '', telefono: '' })
  const [allertaBusy, setAllertaBusy] = useState(false)
  const [allertaErr, setAllertaErr] = useState<string | null>(null)
  const [partLookupMsg, setPartLookupMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [cfScannerOpen, setCfScannerOpen] = useState(false)
  const pettoraleInputRef = useRef<HTMLInputElement>(null)

  const isCentrale = user?.rank === 'Centrale'
  const isMedico = user?.rank === 'Medico'
  const canEdit = Boolean(p?.aperto && user)
  /** Centrale con paziente in carico: scheda in sola lettura salvo tab Invio PS. */
  const schedaEditBlockedCentraleInCarico = Boolean(isCentrale && p?.stato === 'in_carico')
  const canEditBody = Boolean(canEdit && !schedaEditBlockedCentraleInCarico)
  const showCentraleFields = isCentrale
  const showEtaPma = isCentrale && p?.tipo_paziente === 'trasportato'

  const write = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!db || !p?.aperto) return
      if (isCentrale && p?.stato === 'in_carico') return
      const prevColore = p.codice_colore
      setSaveError(null)
      try {
        await updateSchedaPazienteGranular(db, pazienteId, patch)
        if (
          user &&
          user.rank !== 'Centrale' &&
          patch.codice_colore === 'rosso' &&
          prevColore !== 'rosso'
        ) {
          const idPma = (p.id_pma ?? '').trim()
          const idMan = (p.id_manifestazione ?? '').trim()
          if (idPma && idMan) {
            const nomeLine = [p.cognome, p.nome].filter(Boolean).join(' ').trim()
            void createPmaAlert(db, {
              idPma,
              idManifestazione: idMan,
              pazienteId: p.id,
              idPazienteVisibile: p.id_paziente_visibile,
              messaggio: `Codice ROSSO: ${p.id_paziente_visibile}${nomeLine ? ` (${nomeLine})` : ''} — triage da ${user.rank}.`,
              creatoDaUid: user.uid,
            }).catch(() => {
              /* best-effort */
            })
          }
        }
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Salvataggio non riuscito.')
      }
    },
    [pazienteId, p, isCentrale, user],
  )

  const etaCalcolata = useMemo(() => calculateEtaAnni(p?.data_nascita ?? undefined), [p?.data_nascita])

  const manifestCore = useManifestazioneListeCliniche(p?.id_manifestazione)
  const partecipantiElenco = useManifestazionePartecipantiElenco(p?.id_manifestazione?.trim() || undefined)
  const { items: pmaDestList, loading: pmaDestLoading } = usePmaListForManifestazione(
    p?.id_manifestazione?.trim() || undefined,
  )

  const applicaPartecipanteDaElenco = useCallback(() => {
    if (!db) {
      setPartLookupMsg({ tone: 'err', text: 'Database non disponibile.' })
      return
    }
    if (!p?.aperto || schedaEditBlockedCentraleInCarico) {
      setPartLookupMsg({
        tone: 'err',
        text: schedaEditBlockedCentraleInCarico
          ? 'Con paziente in carico la scheda è in sola lettura (solo tab Invio PS modificabile).'
          : 'La scheda non è modificabile (chiusa o senza accesso).',
      })
      return
    }
    const raw = pettoraleInputRef.current?.value?.trim() ?? ''
    if (raw === '') {
      setPartLookupMsg({ tone: 'err', text: 'Inserisci il numero di pettorale nel campo.' })
      return
    }
    const n = Number(raw.replace(',', '.'))
    if (!Number.isFinite(n)) {
      setPartLookupMsg({ tone: 'err', text: 'Numero pettorale non valido.' })
      return
    }
    const pet = Math.floor(n)
    const rows = partecipantiElenco.rows
    if (rows.length === 0) {
      setPartLookupMsg({
        tone: 'err',
        text: 'Nessun elenco partecipanti per questa manifestazione. Un amministratore può caricare l’Excel in Impostazioni manifestazione.',
      })
      return
    }
    const hit = findPartecipanteByPettorale(rows, pet)
    if (!hit) {
      setPartLookupMsg({ tone: 'err', text: `Nessun partecipante con pettorale ${pet} nell’elenco.` })
      return
    }
    const emailCur = contact.email.trim() || p.email?.trim() || ''
    const tel = hit.telefono.trim()
    const patch: Record<string, unknown> = {
      pettorale: pet,
      nome: hit.nome,
      cognome: hit.cognome,
      telefono: tel,
      email: emailCur,
      email_tel: emailTelLegacy(emailCur, tel),
    }
    if (hit.data_nascita_ymd) {
      const ts = ymdToTimestamp(hit.data_nascita_ymd)
      if (ts) {
        patch.data_nascita = ts
        Object.assign(patch, patchEtaFromDataNascita(ts))
      }
    }
    void write(patch)
      .then(() => {
        setContact((c) => ({ email: c.email, telefono: tel }))
        if (hit.data_nascita_ymd) setDataNascitaDraft(hit.data_nascita_ymd)
        setPartLookupMsg({ tone: 'ok', text: 'Dati anagrafici compilati dall’elenco manifestazione.' })
      })
      .catch(() => {
        setPartLookupMsg({ tone: 'err', text: 'Salvataggio non riuscito.' })
      })
  }, [db, p, contact.email, partecipantiElenco.rows, write, schedaEditBlockedCentraleInCarico])

  const inviaAllertaPma = useCallback(async () => {
    if (!db || !user || user.rank !== 'Centrale' || !p) return
    if (schedaEditBlockedCentraleInCarico) return
    const idPma = (p.id_pma ?? '').trim()
    if (!idPma) {
      setAllertaErr('Seleziona il PMA destinazione.')
      return
    }
    setAllertaBusy(true)
    setAllertaErr(null)
    try {
      const nomeLine = [p.cognome, p.nome].filter(Boolean).join(' ').trim()
      await createPmaAlert(db, {
        idPma,
        idManifestazione: p.id_manifestazione,
        pazienteId: p.id,
        idPazienteVisibile: p.id_paziente_visibile,
        messaggio: `Allerta Centrale — ${p.id_paziente_visibile}${nomeLine ? ` (${nomeLine})` : ''}`,
        creatoDaUid: user.uid,
      })
    } catch (e) {
      setAllertaErr(e instanceof Error ? e.message : 'Invio allerta non riuscito.')
    } finally {
      setAllertaBusy(false)
    }
  }, [user, p, schedaEditBlockedCentraleInCarico])

  /** Allinea ai primi valori delle liste manifestazione (stesso ordine salvato in IMP). */
  useEffect(() => {
    if (!db || !p?.aperto || !canEditBody) return
    if (manifestCore.loading) return
    const tipi = manifestCore.tipoEventoList
    if (tipi.length === 0) return

    const tipoDb = p.tipo_evento?.trim() ?? ''
    const detDb = p.dettaglio_evento?.trim() ?? ''

    if (!tipoDb) {
      const t0 = tipi[0]
      const det0 = (manifestCore.dettaglioEventoPerTipo[t0] ?? [])[0] ?? ''
      void write({ tipo_evento: t0, dettaglio_evento: det0 })
      return
    }

    if (!tipi.includes(tipoDb)) return

    const opts = manifestCore.dettaglioEventoPerTipo[tipoDb] ?? []
    if (opts.length === 0) return

    if (detDb) {
      if (!opts.includes(detDb)) {
        void write({ dettaglio_evento: opts[0] })
      }
      return
    }

    void write({ dettaglio_evento: opts[0] })
  }, [
    db,
    p?.aperto,
    p?.id,
    p?.tipo_evento,
    p?.dettaglio_evento,
    canEditBody,
    manifestCore.loading,
    manifestCore.tipoEventoList,
    manifestCore.dettaglioEventoPerTipo,
    write,
  ])

  useEffect(() => {
    if (!db || !p?.aperto || !canEditBody || !isCentrale || pmaDestLoading) return
    if (pmaDestList.length !== 1) return
    if ((p.id_pma ?? '').trim() !== '') return
    void write({ id_pma: pmaDestList[0].id })
  }, [db, p?.aperto, p?.id, p?.id_pma, canEditBody, isCentrale, pmaDestLoading, pmaDestList, write])

  const manReport = useManifestazioneDoc(p?.id_manifestazione || undefined)
  const pmaIdForReport =
    (p?.id_pma && p.id_pma.trim() !== '' ? p.id_pma : pmaRouteId ? decodeURIComponent(pmaRouteId) : '') ||
    undefined
  const pmaReport = usePmaDocSnapshot(pmaIdForReport)

  const rankForTabs = user?.rank ?? 'Soccorritore'

  const tabs = useMemo(() => {
    if (!p) return schedaPazienteTabsFor({ dimissione_esito: null }, rankForTabs)
    return schedaPazienteTabsFor(p, rankForTabs)
  }, [p, rankForTabs])

  const writeInvioPs = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!db || !p || p.dimissione_esito !== 'invio_ps' || !user) return
      if (!canWriteInvioPsFields(user.rank, p.aperto)) return
      setSaveError(null)
      try {
        await updateSchedaPazienteGranular(db, pazienteId, patch)
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Salvataggio non riuscito.')
      }
    },
    [pazienteId, p, user],
  )

  useEffect(() => {
    if (!p) return
    if (activeTab === 'invio_ps' && p.dimissione_esito !== 'invio_ps') {
      setActiveTab('dimissione')
    }
  }, [p, activeTab])

  useEffect(() => {
    if (tabs.some((t) => t.id === activeTab)) return
    setActiveTab(tabs[0]?.id ?? 'generale')
  }, [tabs, activeTab])

  useEffect(() => {
    tabFromUrlApplied.current = null
  }, [pazienteId])

  useEffect(() => {
    if (!p) return
    if (tabFromUrlApplied.current === p.id) return
    const raw = searchParams.get('tab')?.trim().toLowerCase()
    if (!raw) return
    const allowed: SchedaPazienteTabId[] = ['generale', 'anagrafica', 'cartella', 'dimissione', 'invio_ps']
    if (!allowed.includes(raw as SchedaPazienteTabId)) return
    const nextTab = raw as SchedaPazienteTabId
    if (nextTab === 'invio_ps' && p.dimissione_esito !== 'invio_ps') {
      tabFromUrlApplied.current = p.id
      const next = new URLSearchParams(searchParams)
      next.delete('tab')
      setSearchParams(next, { replace: true })
      return
    }
    setActiveTab(nextTab)
    tabFromUrlApplied.current = p.id
    const next = new URLSearchParams(searchParams)
    next.delete('tab')
    setSearchParams(next, { replace: true })
  }, [p, pazienteId, searchParams, setSearchParams])

  useEffect(() => {
    if (!p) return
    setDataNascitaDraft(toYmd(p.data_nascita))
    setContact({ email: p.email, telefono: p.telefono })
  }, [p?.id, p?.data_nascita?.toMillis?.(), p?.email, p?.telefono])

  useEffect(() => {
    if (!partLookupMsg) return
    const t = window.setTimeout(() => setPartLookupMsg(null), 6000)
    return () => window.clearTimeout(t)
  }, [partLookupMsg])

  const isInfermiere = user?.rank === 'Infermiere'
  const isMedicoRank = user?.rank === 'Medico'

  useEffect(() => {
    if (!db || p?.stato !== 'in_carico' || !user) return
    if (user.rank !== 'Infermiere' && user.rank !== 'Medico') return
    const ref = staffSoftRefFromUser(user)
    if (!ref) return
    const patch: Record<string, unknown> = {}
    if (isInfermiere && !p.infermiere_rif.trim()) patch.infermiere_rif = ref
    if (isMedicoRank && !p.medico_rif.trim()) patch.medico_rif = ref
    if (Object.keys(patch).length === 0) return

    let cancelled = false
    void (async () => {
      try {
        await updateSchedaPazienteGranular(db, pazienteId, patch)
      } catch (e) {
        if (!cancelled) {
          setSaveError(e instanceof Error ? e.message : 'Aggiornamento riferimento non riuscito.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    pazienteId,
    p?.id,
    p?.stato,
    p?.infermiere_rif,
    p?.medico_rif,
    user,
    isInfermiere,
    isMedicoRank,
  ])

  if (!user) {
    return null
  }

  const pmaShellId = pmaRouteId ? decodeURIComponent(pmaRouteId) : user.id_pma?.trim() ?? ''
  const manShellId = p?.id_manifestazione?.trim() ?? user.id_manifestazione?.trim() ?? ''
  const visShell = p?.id_paziente_visibile ?? pazienteId

  if (loading) {
    return (
      <SchedaPazienteShell
        user={user}
        logout={logout}
        pmaId={pmaShellId || '—'}
        manifestazioneId={manShellId}
        pazienteIdVisibile={pazienteId}
      >
        <div className="flex items-center gap-3 px-8 py-20 text-sm text-slate-600">
          <span
            className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#111827]"
            aria-hidden
          />
          Caricamento scheda paziente…
        </div>
      </SchedaPazienteShell>
    )
  }

  if (error) {
    return (
      <SchedaPazienteShell
        user={user}
        logout={logout}
        pmaId={pmaShellId || '—'}
        manifestazioneId={manShellId}
        pazienteIdVisibile={pazienteId}
      >
        <div className="border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-800" role="alert">
          {error}
        </div>
      </SchedaPazienteShell>
    )
  }

  if (!exists || !p) {
    return (
      <SchedaPazienteShell
        user={user}
        logout={logout}
        pmaId={pmaShellId || '—'}
        manifestazioneId={manShellId}
        pazienteIdVisibile={pazienteId}
      >
        <div className="border border-slate-200 bg-white px-6 py-4 text-sm text-slate-700">
          Paziente non trovato.
        </div>
      </SchedaPazienteShell>
    )
  }

  async function onStatoChange(next: PazienteStato) {
    if (!user) return
    if (next === 'dimesso') return
    if (next === 'in_arrivo' && !schedaStatoInArrivoAllows(user.rank)) return
    await write({ stato: next })
  }

  async function onTipoChange(next: TipoPaziente) {
    if (next === 'autopresentato') {
      await write({
        tipo_paziente: next,
        eta_pma_minuti: null,
        eta_pma_deadline: null,
      })
      return
    }
    await write({ tipo_paziente: next })
  }

  const pmaIdForShell = p.id_pma?.trim() || pmaShellId || '—'
  const manIdForShell = p.id_manifestazione?.trim() || manShellId || ''

  const canEditDimissioneTab = schedaTabDimissioneAllows(user.rank, 'UPDATE')
  const canSetStatoInArrivo = schedaStatoInArrivoAllows(user.rank)
  const schedaModificabileInvioPs = Boolean(p?.aperto)
  const invioPsReadOnly = !canWriteInvioPsFields(user.rank, schedaModificabileInvioPs)

  return (
    <SchedaPazienteShell
      user={user}
      logout={logout}
      pmaId={pmaIdForShell}
      manifestazioneId={manIdForShell}
      pazienteIdVisibile={visShell}
    >
      <div className="w-full min-w-0 px-3 pb-6 pt-3 sm:px-5">
        <DettaglioPaziente
        p={p}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        saveError={
          saveError ? (
            <div className="mb-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {saveError}
            </div>
          ) : null
        }
        panels={{
          generale: (
            <div className="space-y-4">
              {!p.aperto ? (
                <p className="text-sm text-slate-600">Scheda in sola lettura (chiusa).</p>
              ) : null}

              <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="pma-row pma-row--2 border-b border-slate-200">
                  <div className="pma-field pma-field--br">
                    <span className="pma-field__label">Infermiere di riferimento</span>
                    <span
                      className={`pma-field__value${!p.infermiere_rif.trim() ? ' pma-field__value--muted' : ''}`}
                    >
                      {p.infermiere_rif.trim() || '—'}
                    </span>
                  </div>
                  <div className="pma-field">
                    <span className="pma-field__label">Medico di riferimento</span>
                    <span className={`pma-field__value${!p.medico_rif.trim() ? ' pma-field__value--muted' : ''}`}>
                      {p.medico_rif.trim() || '—'}
                    </span>
                  </div>
                </div>
                {p.ripreso_in_carico_at && typeof p.ripreso_in_carico_at.toDate === 'function' ? (
                  <div className="pma-row border-b border-slate-200">
                    <div className="pma-field">
                      <span className="pma-field__label">Ripreso in carico</span>
                      <span className="pma-field__value">
                        {p.ripreso_in_carico_at.toDate().toLocaleString('it-IT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ) : null}
                <div className="pma-row">
                  <label className="pma-field">
                    <span className="pma-field__label">Apertura scheda</span>
                    <input
                      type="datetime-local"
                      disabled={!canEditBody}
                      value={toDatetimeLocal(p.apertura_scheda)}
                      onChange={(e) => {
                        const ts = datetimeLocalToTimestamp(e.target.value)
                        if (ts) void write({ apertura_scheda: ts })
                      }}
                    />
                  </label>
                </div>
                <div className="pma-row">
                  <label className="pma-field">
                    <span className="pma-field__label">Tipo paziente</span>
                    <select
                      disabled={!canEditBody}
                      value={p.tipo_paziente}
                      onChange={(e) => void onTipoChange(e.target.value as TipoPaziente)}
                    >
                      {TIPI.map((t) => (
                        <option key={t} value={t}>
                          {TIPO_PAZIENTE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="pma-row">
                    <div className="pma-field">
                      <span className="pma-field__label">Codice colore</span>
                      <div className="pma-pills pma-pills--grid" role="group" aria-label="Codice colore">
                      {CODICI_UI.map((c) => {
                        const selected = p.codice_colore === c
                        return (
                          <button
                            key={c}
                            type="button"
                            disabled={!canEditBody}
                            aria-pressed={selected}
                            onClick={() => void write({ codice_colore: c })}
                            className={`${pillCodiceColore(c, selected)} ${!canEditBody ? 'opacity-40' : ''}`}
                          >
                            {CODICE_COLORE_LABEL[c]}
                          </button>
                        )
                      })}
                    </div>
                    </div>
                  </div>

                  {manifestCore.tipoEventoList.length > 0 ? (
                    <div className="pma-row pma-row--1-1-2">
                      <label className="pma-field pma-field--br">
                        <span className="pma-field__label">Tipo evento</span>
                        <select
                          disabled={!canEditBody}
                          value={p.tipo_evento}
                          onChange={(e) => {
                            const v = e.target.value
                            const opts = manifestCore.dettaglioEventoPerTipo[v] ?? []
                            void write({ tipo_evento: v, dettaglio_evento: opts[0] ?? '' })
                          }}
                        >
                          <option value="">— Seleziona —</option>
                          {manifestCore.tipoEventoList.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="pma-field">
                        <span className="pma-field__label">Dettaglio evento</span>
                        <select
                          disabled={!canEditBody}
                          value={p.dettaglio_evento}
                          onChange={(e) => void write({ dettaglio_evento: e.target.value })}
                        >
                          <option value="">— Seleziona —</option>
                          {(manifestCore.dettaglioEventoPerTipo[p.tipo_evento] ?? []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : (
                    <div className="pma-row pma-row--1-1-2">
                      <label className="pma-field pma-field--br">
                        <span className="pma-field__label">Tipo evento</span>
                        <input
                          key={`te-${p.id}-${p.tipo_evento}`}
                          type="text"
                          disabled={!canEditBody}
                          defaultValue={p.tipo_evento}
                          onBlur={(e) => void write({ tipo_evento: e.target.value })}
                        />
                      </label>
                      <label className="pma-field">
                        <span className="pma-field__label">Dettaglio evento</span>
                        <input
                          key={`de-${p.id}-${p.dettaglio_evento}`}
                          type="text"
                          disabled={!canEditBody}
                          defaultValue={p.dettaglio_evento}
                          onBlur={(e) => void write({ dettaglio_evento: e.target.value })}
                        />
                      </label>
                    </div>
                  )}

                  <div className="pma-row">
                    <label className="pma-field">
                      <span className="pma-field__label">Breve descrizione</span>
                      <textarea
                        key={`breve-${p.id}-${p.breve_descrizione}`}
                        disabled={!canEditBody}
                        rows={4}
                        defaultValue={p.breve_descrizione}
                        onBlur={(e) => void write({ breve_descrizione: e.target.value })}
                      />
                    </label>
                  </div>

                  <CrossDatiSchedaPanel p={p} />

                  {showCentraleFields ? (
                    <>
                      <div className="pma-row">
                        <label className="pma-field">
                          <span className="pma-field__label">Trasportato da</span>
                          <input
                            key={`tda-${p.id}-${p.trasportato_da ?? ''}`}
                            type="text"
                            disabled={!canEditBody}
                            defaultValue={p.trasportato_da ?? ''}
                            onBlur={(e) =>
                              void write({
                                trasportato_da:
                                  e.target.value.trim() === '' ? null : e.target.value.trim(),
                              })
                            }
                          />
                        </label>
                      </div>
                      <div className="pma-row">
                        <label className="pma-field">
                          <span className="pma-field__label">Note centrale</span>
                          <input
                            key={`nc-${p.id}-${p.note_centrale ?? ''}`}
                            type="text"
                            disabled={!canEditBody}
                            defaultValue={p.note_centrale ?? ''}
                            onBlur={(e) =>
                              void write({
                                note_centrale:
                                  e.target.value.trim() === '' ? null : e.target.value.trim(),
                              })
                            }
                          />
                        </label>
                      </div>
                      <div className="pma-row">
                        <label className="pma-field">
                          <span className="pma-field__label">PMA destinazione</span>
                          <select
                            disabled={!canEditBody || pmaDestLoading || pmaDestList.length === 0}
                            value={(p.id_pma ?? '').trim()}
                            onChange={(e) => {
                              const v = e.target.value.trim()
                              void (async () => {
                                await write({ id_pma: v })
                                const routePma = pmaRouteId ? decodeURIComponent(pmaRouteId).trim() : ''
                                if (routePma && v && v !== routePma) {
                                  navigate(
                                    `/pma/${encodeURIComponent(v)}/paziente/${encodeURIComponent(pazienteId)}?tab=generale`,
                                    { replace: true },
                                  )
                                }
                              })()
                            }}
                          >
                          {pmaDestList.length > 1 && !(p.id_pma ?? '').trim() ? (
                            <option value="">— Seleziona PMA —</option>
                          ) : null}
                          {pmaDestList.length === 0 ? (
                            <option value="">— Nessun PMA —</option>
                          ) : (
                            pmaDestList.map((pm) => (
                              <option key={pm.id} value={pm.id}>
                                {pm.nome}
                              </option>
                            ))
                          )}
                        </select>
                        </label>
                      </div>
                    </>
                  ) : null}

                  {showEtaPma ? (
                    <div className="pma-row">
                      <label className="pma-field">
                        <span className="pma-field__label">ETA PMA (minuti da ora)</span>
                        <input
                          key={`eta-${p.id}-${p.eta_pma_minuti ?? 'x'}-${p.eta_pma_deadline?.toMillis?.() ?? 0}`}
                          type="number"
                          min={0}
                          step={1}
                          disabled={!canEditBody}
                          defaultValue={p.eta_pma_minuti ?? ''}
                          onBlur={(e) => {
                            const raw = e.target.value.trim()
                            if (raw === '') {
                              void write({ eta_pma_minuti: null, eta_pma_deadline: null })
                              return
                            }
                            const n = Number(raw)
                            if (!Number.isFinite(n) || n < 0) return
                            const deadline = Timestamp.fromMillis(Date.now() + n * 60_000)
                            void write({ eta_pma_minuti: Math.floor(n), eta_pma_deadline: deadline })
                          }}
                        />
                        <EtaPmaCountdown deadline={p.eta_pma_deadline} />
                      </label>
                    </div>
                  ) : null}

                  <div className="pma-row">
                    <div className="pma-field">
                    <span className="pma-field__label">Stato</span>
                    {p.stato === 'dimesso' ? (
                      <div className="mt-3">
                        <span className="pma-pill pma-pill--stato-off pointer-events-none text-sm font-bold uppercase tracking-wide">
                          {PAZIENTE_STATO_LABEL.dimesso}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="pma-pills mt-3" role="group" aria-label="Stato paziente">
                          {statiSelezionabiliPerRank(user?.rank ?? 'Soccorritore', canSetStatoInArrivo, p.stato).map(
                            (s) => {
                            const selected = p.stato === s
                            const disabled = !canEditBody
                            return (
                              <button
                                key={s}
                                type="button"
                                disabled={disabled}
                                aria-pressed={selected}
                                onClick={() => void onStatoChange(s)}
                                className={`${pillStato(selected)} ${!canEditBody || disabled ? 'opacity-40' : ''}`}
                              >
                                {PAZIENTE_STATO_LABEL[s]}
                              </button>
                            )
                          },
                          )}
                        </div>
                        {isCentrale && p.aperto ? (
                          <div className="mt-4 border-t border-slate-100 pt-4">
                            <button
                              type="button"
                              disabled={!db || allertaBusy || !(p.id_pma ?? '').trim() || schedaEditBlockedCentraleInCarico}
                              onClick={() => void inviaAllertaPma()}
                              className="inline-flex h-10 w-full max-w-md items-center justify-center rounded-lg border border-amber-400 bg-amber-100 px-4 text-sm font-bold uppercase text-amber-950 shadow-sm hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {allertaBusy ? 'Invio…' : 'Allerta PMA'}
                            </button>
                            {allertaErr ? (
                              <p className="mt-2 text-xs text-red-600" role="alert">
                                {allertaErr}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    )}
                    </div>
                  </div>
              </section>
            </div>
          ),
          anagrafica: (
            <>
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="pma-row pma-row--2">
                <label className="pma-field pma-field--br">
                  <span className="pma-field__label">Pettorale</span>
                  <div className="mt-0.5 flex min-w-0 items-center gap-2">
                    <input
                      ref={pettoraleInputRef}
                      key={`pet-${p.id}-${p.pettorale ?? 'x'}`}
                      className="min-w-0 flex-1"
                      type="number"
                      min={0}
                      disabled={!canEditBody}
                      defaultValue={p.pettorale ?? ''}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        if (v === '') {
                          void write({ pettorale: null })
                          return
                        }
                        const n = Number(v)
                        if (Number.isFinite(n)) void write({ pettorale: Math.floor(n) })
                      }}
                    />
                    <button
                      type="button"
                      title="Compila anagrafica dall’elenco partecipanti (Excel manifestazione)"
                      aria-label="Cerca pettorale nell’elenco manifestazione e compila anagrafica"
                      disabled={
                        !canEditBody ||
                        partecipantiElenco.loading ||
                        partecipantiElenco.rows.length === 0
                      }
                      onClick={() => applicaPartecipanteDaElenco()}
                      className="pma-theme-skip inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.75" />
                        <path
                          d="M15.2 15.2 20 20"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                  {partLookupMsg ? (
                    <p
                      className={`mt-1.5 text-xs leading-snug ${partLookupMsg.tone === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}
                      role="status"
                    >
                      {partLookupMsg.text}
                    </p>
                  ) : null}
                </label>
                <div className="pma-field">
                  <span className="pma-field__label">Età</span>
                  <span
                    className={
                      etaCalcolata !== null || (p.eta !== null && p.eta !== undefined)
                        ? 'pma-field__value'
                        : 'pma-field__value pma-field__value--muted'
                    }
                  >
                    {etaCalcolata !== null
                      ? `${etaCalcolata} anni`
                      : p.eta !== null && p.eta !== undefined
                        ? `${p.eta} anni`
                        : '—'}
                  </span>
                </div>
                <label className="pma-field pma-field--br">
                  <span className="pma-field__label">Nome</span>
                  <input
                    key={`nome-${p.id}-${p.nome}`}
                    type="text"
                    disabled={!canEditBody}
                    defaultValue={p.nome}
                    onBlur={(e) => void write({ nome: e.target.value })}
                  />
                </label>
                <label className="pma-field">
                  <span className="pma-field__label">Cognome</span>
                  <input
                    key={`cog-${p.id}-${p.cognome}`}
                    type="text"
                    disabled={!canEditBody}
                    defaultValue={p.cognome}
                    onBlur={(e) => void write({ cognome: e.target.value })}
                  />
                </label>
              </div>
              <div className="pma-row">
                <label className="pma-field">
                  <span className="pma-field__label">Data di nascita</span>
                  <input
                    type="date"
                    disabled={!canEditBody}
                    value={dataNascitaDraft}
                    onChange={(e) => setDataNascitaDraft(e.target.value)}
                    onBlur={() => {
                      const v = dataNascitaDraft.trim()
                      if (!v) {
                        void write({ data_nascita: null, eta: null })
                        return
                      }
                      const ts = ymdToTimestamp(v)
                      if (!ts) {
                        setDataNascitaDraft(toYmd(p.data_nascita))
                        return
                      }
                      void write({ data_nascita: ts, ...patchEtaFromDataNascita(ts) })
                    }}
                  />
                </label>
              </div>
              <div className="pma-row">
                <label className="pma-field">
                  <span className="pma-field__label flex flex-wrap items-center gap-2">
                    <span>CF (codice fiscale)</span>
                    <button
                      type="button"
                      disabled={!canEditBody}
                      title="Scansiona il codice a barre CODE 128 sulla tessera sanitaria (16 caratteri CF)"
                      aria-label="Scansiona codice a barre tessera sanitaria"
                      onClick={() => setCfScannerOpen(true)}
                      className="pma-theme-skip inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <svg
                        width="18"
                        height="14"
                        viewBox="0 0 20 14"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden
                        className="text-slate-800"
                      >
                        <path fill="currentColor" d="M0 1h1.2v12H0V1zm2.5 0h.8v12h-.8V1zm2 0h1.5v12H4.5V1zm2.2 0h.7v12h-.7V1zm1.8 0h1.2v12H8.5V1zm2 0h.8v12h-.8V1zm2.2 0h1.4v12h-1.4V1zm2.3 0h.7v12h-.7V1zm1.8 0h1.2v12h-1.2V1zm2.1 0h.9v12h-.9V1z" />
                      </svg>
                    </button>
                  </span>
                  <input
                    key={`cf-${p.id}-${p.codice_fiscale}`}
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    maxLength={16}
                    disabled={!canEditBody}
                    defaultValue={p.codice_fiscale}
                    onBlur={(e) =>
                      void write({
                        codice_fiscale: e.target.value
                          .trim()
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, '')
                          .slice(0, 16),
                      })
                    }
                    className="font-mono uppercase tracking-wide"
                    spellCheck={false}
                  />
                </label>
              </div>
              <div className="pma-row">
                <label className="pma-field">
                  <span className="pma-field__label">Email</span>
                  <input
                    type="email"
                    disabled={!canEditBody}
                    value={contact.email}
                    onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                    onBlur={() =>
                      void write({
                        email: contact.email.trim(),
                        telefono: contact.telefono.trim(),
                        email_tel: emailTelLegacy(contact.email, contact.telefono),
                      })
                    }
                    autoComplete="email"
                  />
                </label>
              </div>
              <div className="pma-row">
                <label className="pma-field">
                  <span className="pma-field__label">Telefono</span>
                  <input
                    type="tel"
                    disabled={!canEditBody}
                    value={contact.telefono}
                    onChange={(e) => setContact((c) => ({ ...c, telefono: e.target.value }))}
                    onBlur={() =>
                      void write({
                        email: contact.email.trim(),
                        telefono: contact.telefono.trim(),
                        email_tel: emailTelLegacy(contact.email, contact.telefono),
                      })
                    }
                    autoComplete="tel"
                    placeholder="+39 …"
                  />
                </label>
              </div>
            </section>
            {cfScannerOpen ? (
              <TesseraSanitariaCfScanner
                open={cfScannerOpen}
                onClose={() => setCfScannerOpen(false)}
                onCapture={(cf) => void write({ codice_fiscale: cf })}
              />
            ) : null}
          </>
          ),
          cartella: (
            <CartellaClinicaSection
              embedded
              pazienteId={pazienteId}
              p={p}
              canEdit={Boolean(canEditBody)}
              write={write}
              user={user}
            />
          ),
          dimissione: (
            <DimissioneSection
              p={p}
              user={user}
              isMedico={isMedico}
              canEditDimissioneTab={canEditDimissioneTab}
              canEditScheda={Boolean(canEditBody)}
              write={write}
              reportManifestazioneNome={manReport.data?.nome ?? ''}
              reportPmaNome={pmaReport.nome ?? ''}
              consensoGenericoCure={manReport.data?.consensoGenericoCure}
              consensoPrivacy={manReport.data?.consensoPrivacy}
              rifiutoInvioPs={manReport.data?.rifiutoInvioPs}
              presetDimissione={manReport.data?.presetDimissione}
              prestazioniManifestazioneLista={manifestCore.prestazioni}
            />
          ),
          invio_ps: (
            <InvioOspedaleSection
              p={p}
              readOnly={invioPsReadOnly}
              writeInvio={writeInvioPs}
            />
          ),
        }}
        />
      </div>
    </SchedaPazienteShell>
  )
}
