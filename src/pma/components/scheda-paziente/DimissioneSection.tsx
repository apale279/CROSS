import { useEffect, useState } from 'react'
import { deleteField, serverTimestamp } from 'firebase/firestore'
import type { Paziente } from '@pma/types/paziente'
import type { UserProfile } from '@pma/types/userProfile'
import {
  DIMISSIONE_ESITO_LABEL,
  DIMISSIONE_ESITO_VALUES,
  type DimissioneEsito,
} from '@pma/types/dimissione'
import { SignatureCanvas } from './SignatureCanvas'
import { PmaFieldGuard } from '../PmaFieldGuard'
import { defaultPdfFilename } from '@pma/lib/pdf/pazientePdfHelpers'
import { buildPazientePdfBlob } from '@pma/lib/pdf/pazientePdfReport'
import { createPdfObjectUrl, printPdfBlob, revokePdfObjectUrl, tryOpenPdfInNewTab } from '@pma/lib/pdf/pdfBlobActions'
import { resolveMedicoFirmaPngSrc, resolveMedicoFirmaSrc } from '@pma/lib/medicoFirma'
import { rasterizeFirmaDataUrlToPng } from '@pma/lib/signatureSvg'
import { PdfPreviewModal } from './PdfPreviewModal'
import type { PresetDimissioneVoce } from '@pma/types/manifestazioneImpostazioni'
import { canChiudiDimissionePaziente, schedaTabDimissioneAllows } from '@pma/lib/rankMatrix'
import { validateDimissioneBeforeClose } from '@pma/lib/dimissioneValidate'
import { PmaAllergieSiAlert } from './PmaAllergieSiAlert'
import { staffSoftRefFromUser } from '@pma/lib/staffSoftRef'
import { btnDanger, btnPrimary, btnSecondary } from '@pma/cross/uiTokens'
import {
  parsePmaIpadQueueRequest,
  pushPmaIpadFirmaRequest,
  subscribePmaIpadFirmaQueue,
} from '../../../services/pmaIpadFirmaService'

export type PmaIpadFirmaSender = {
  manifestationId: string
  pmaId: string
  pazienteDocId: string
  operatorUid: string
  operatorNome: string
}

type Props = {
  p: Paziente
  user: UserProfile | null
  isMedico: boolean
  /** Matrice Rank.xlsx: Superadmin, Centrale, Medico con scheda aperta. */
  canEditDimissioneTab: boolean
  /** `p.aperto && user` — scheda modificabile a livello documento */
  canEditScheda: boolean
  write: (patch: Record<string, unknown>) => Promise<void>
  /** Intestazione PDF (manifestazione / PMA). */
  reportManifestazioneNome: string
  reportPmaNome: string
  /** Da impostazioni manifestazione (solo lettura in tab dimissione). */
  consensoGenericoCure?: string
  consensoPrivacy?: string
  rifiutoInvioPs?: string
  presetDimissione?: PresetDimissioneVoce[]
  /** Elenco prestazioni manifestazione: stesso ordine della cartella clinica nel PDF. */
  prestazioniManifestazioneLista?: string[]
  /** Ospedale destinazione centrale (se non ancora in `invio_ps_ospedale`). */
  ospedaleDestinazioneCentrale?: string | null
  /** Invio documento all'iPad PMA (coda condivisa, sostituisce richiesta precedente). */
  pmaIpadFirma?: PmaIpadFirmaSender | null
}

/**
 * Sezione 4 — Dimissione.
 * Modifica: Superadmin, Centrale, Medico. Infermiere e Soccorritore: sola lettura.
 * Chiusura definitiva (**Dimetti**): solo Medico (e Superadmin) con scheda aperta.
 */
export function DimissioneSection({
  p,
  user,
  isMedico,
  canEditDimissioneTab,
  canEditScheda,
  write,
  reportManifestazioneNome,
  reportPmaNome,
  consensoGenericoCure = '',
  consensoPrivacy = '',
  rifiutoInvioPs = '',
  presetDimissione = [],
  prestazioniManifestazioneLista = [],
  pmaIpadFirma = null,
  ospedaleDestinazioneCentrale = null,
}: Props) {
  const dimissioneEdit = canEditDimissioneTab && canEditScheda
  const pazienteGiaDimesso = p.stato === 'dimesso'
  const canChiudiDimetti = Boolean(
    canEditScheda && user && canChiudiDimissionePaziente(user.rank) && !pazienteGiaDimesso,
  )
  const [noteDraft, setNoteDraft] = useState(p.dimissione_note)
  const [emailDraft, setEmailDraft] = useState(p.email)
  const [affidatarioNomeDraft, setAffidatarioNomeDraft] = useState(p.affidatario_nome ?? '')
  const [affidatarioCognomeDraft, setAffidatarioCognomeDraft] = useState(p.affidatario_cognome ?? '')
  const [dimettiOpen, setDimettiOpen] = useState(false)
  const [dimettiBusy, setDimettiBusy] = useState(false)
  const [dimettiErr, setDimettiErr] = useState<string | null>(null)
  const [replaceFirma, setReplaceFirma] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfErr, setPdfErr] = useState<string | null>(null)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)
  const [pdfPreviewFilename, setPdfPreviewFilename] = useState<string | null>(null)
  const [pdfPreviewBlob, setPdfPreviewBlob] = useState<Blob | null>(null)
  const [ipadBusy, setIpadBusy] = useState(false)
  const [ipadErr, setIpadErr] = useState<string | null>(null)
  const [ipadOk, setIpadOk] = useState(false)
  const [ipadQueueDoc, setIpadQueueDoc] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    return () => revokePdfObjectUrl(pdfPreviewUrl)
  }, [pdfPreviewUrl])

  useEffect(() => {
    setNoteDraft(p.dimissione_note)
    setEmailDraft(p.email)
    setAffidatarioNomeDraft(p.affidatario_nome ?? '')
    setAffidatarioCognomeDraft(p.affidatario_cognome ?? '')
  }, [p.id])
  useEffect(() => {
    if (!dimissioneEdit) {
      setNoteDraft(p.dimissione_note)
      setEmailDraft(p.email)
      setAffidatarioNomeDraft(p.affidatario_nome ?? '')
      setAffidatarioCognomeDraft(p.affidatario_cognome ?? '')
    }
  }, [
    dimissioneEdit,
    p.dimissione_note,
    p.email,
    p.affidatario_nome,
    p.affidatario_cognome,
  ])

  useEffect(() => {
    if (!pmaIpadFirma?.manifestationId || !pmaIpadFirma?.pmaId) return undefined
    return subscribePmaIpadFirmaQueue(
      pmaIpadFirma.manifestationId,
      pmaIpadFirma.pmaId,
      setIpadQueueDoc,
    )
  }, [pmaIpadFirma?.manifestationId, pmaIpadFirma?.pmaId])

  const ipadQueueRequest = parsePmaIpadQueueRequest(ipadQueueDoc)
  const ipadQueueForPatient =
    ipadQueueRequest &&
    ipadQueueRequest.pazienteDocId === pmaIpadFirma?.pazienteDocId
      ? ipadQueueRequest
      : null

  const pdfManifestazioneTesti = {
    consensoGenericoCure: consensoGenericoCure.trim() || undefined,
    consensoPrivacy: consensoPrivacy.trim() || undefined,
    rifiutoInvioPsText: rifiutoInvioPs.trim() || undefined,
  }

  const firmaMedicoProfilo = isMedico && user ? resolveMedicoFirmaSrc(user) : null
  const firmaMedicoPreview = p.dimissione_firma_medico_base64 ?? firmaMedicoProfilo

  async function handleSaveFirmaPaziente(dataUrl: string) {
    await write({
      firma_paziente_base64: dataUrl,
      firma_paziente_url: deleteField(),
    })
    setReplaceFirma(false)
  }

  async function handleInviaIpadFirma() {
    if (!pmaIpadFirma || !dimissioneEdit) return
    setIpadBusy(true)
    setIpadErr(null)
    setIpadOk(false)
    try {
      await pushPmaIpadFirmaRequest(pmaIpadFirma.manifestationId, pmaIpadFirma.pmaId, {
        pazienteDocId: pmaIpadFirma.pazienteDocId,
        idPaziente: p.id_paziente_visibile || p.id,
        pdfPreviewUrl: '',
        requestedByUid: pmaIpadFirma.operatorUid,
        requestedByNome: pmaIpadFirma.operatorNome,
      })
      setIpadOk(true)
      window.setTimeout(() => setIpadOk(false), 6000)
    } catch (e) {
      setIpadErr(e instanceof Error ? e.message : 'Invio a iPad non riuscito.')
    } finally {
      setIpadBusy(false)
    }
  }

  async function handleDimettiConfirm() {
    if (!canChiudiDimetti || !user || pazienteGiaDimesso) return
    const medicoRif = String(p.medico_rif ?? '').trim() || staffSoftRefFromUser(user) || ''
    const validationErrors = validateDimissioneBeforeClose({
      dimissione_esito: p.dimissione_esito,
      medico_rif: medicoRif,
    })
    if (validationErrors.length > 0) {
      setDimettiErr(validationErrors.join(' '))
      return
    }
    setDimettiBusy(true)
    setDimettiErr(null)
    try {
      let snap =
        p.dimissione_firma_medico_base64?.trim() || user.firma_medico_base64?.trim() || null
      if (!snap) {
        const src = resolveMedicoFirmaSrc(user)
        if (src) {
          try {
            snap = await rasterizeFirmaDataUrlToPng(src)
          } catch {
            snap = null
          }
        }
      }
      const patch: Record<string, unknown> = {
        aperto: false,
        stato: 'dimesso',
        dimesso_at: serverTimestamp(),
      }
      const medicoRif = String(p.medico_rif ?? '').trim() || staffSoftRefFromUser(user) || ''
      if (medicoRif && !String(p.medico_rif ?? '').trim()) {
        patch.medico_rif = medicoRif
      }
      if (snap) {
        patch.dimissione_firma_medico_base64 = snap
        patch.dimissione_firma_medico_url = deleteField()
      }
      await write(patch)
      setDimettiOpen(false)
    } catch (e) {
      setDimettiErr(e instanceof Error ? e.message : 'Dimissione non riuscita.')
    } finally {
      setDimettiBusy(false)
    }
  }

  async function buildCurrentPdfBlob() {
    return buildPazientePdfBlob(p, {
      manifestazioneNome: reportManifestazioneNome,
      pmaNome: reportPmaNome,
      firmaMedicoProfiloDataUrl: resolveMedicoFirmaPngSrc(user) ?? firmaMedicoProfilo,
      prestazioniManifestazioneLista,
      ...pdfManifestazioneTesti,
    })
  }

  function closePdfPreview() {
    revokePdfObjectUrl(pdfPreviewUrl)
    setPdfPreviewUrl(null)
    setPdfPreviewFilename(null)
    setPdfPreviewBlob(null)
  }

  async function handlePreviewPdf() {
    setPdfErr(null)
    setPdfBusy(true)
    try {
      closePdfPreview()
      const blob = await buildCurrentPdfBlob()
      const fname = defaultPdfFilename(p)
      const url = createPdfObjectUrl(blob)
      setPdfPreviewBlob(blob)
      setPdfPreviewFilename(fname)
      setPdfPreviewUrl(url)
    } catch (e) {
      setPdfErr(e instanceof Error ? e.message : 'Generazione PDF non riuscita.')
    } finally {
      setPdfBusy(false)
    }
  }

  async function handlePrintPdf() {
    setPdfErr(null)
    setPdfBusy(true)
    try {
      const blob = pdfPreviewBlob ?? (await buildCurrentPdfBlob())
      await printPdfBlob(blob)
    } catch (e) {
      setPdfErr(e instanceof Error ? e.message : 'Stampa PDF non riuscita.')
    } finally {
      setPdfBusy(false)
    }
  }

  function handleSendMail() {
    const to = String(emailDraft ?? '').trim()
    if (!to) {
      setPdfErr('Inserisci Email paziente per aprire un nuovo messaggio.')
      return
    }
    const subject = encodeURIComponent(`Referto dimissione ${p.id_paziente_visibile}`)
    const body = encodeURIComponent(
      'In allegato il PDF di dimissione.\n\nNota: se l\'allegato non compare automaticamente, aggiungilo manualmente dal file appena scaricato/aperto.',
    )
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`
  }

  const firmaPaz = p.firma_paziente_base64
  const notePersonaliMedico = String(user?.note_personali ?? '').trim()

  const showPresetDimissione = Boolean(dimissioneEdit && presetDimissione.length > 0)
  const [presetSel, setPresetSel] = useState<number[]>([])

  async function appendPresetTesti(testi: string[]) {
    const chunks = testi.map((t) => String(t ?? '').trim()).filter(Boolean)
    if (chunks.length === 0) return
    const base = noteDraft.trimEnd()
    const next = base ? `${base}\n\n${chunks.join('\n\n')}` : chunks.join('\n\n')
    setNoteDraft(next)
    try {
      await write({ dimissione_note: next })
    } catch {
      setNoteDraft(p.dimissione_note)
      throw new Error('Salvataggio preset dimissione non riuscito.')
    }
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {canEditScheda && !canEditDimissioneTab ? (
        <p className="border-b border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Dimissione in sola lettura per il tuo profilo operatore.
        </p>
      ) : null}
      <div className="flex flex-col gap-2 border-b border-slate-100 px-3 py-2 sm:flex-row sm:items-start sm:justify-end">
        {p.dimesso_at ? (
          <p className="shrink-0 text-xs text-slate-500">
            Chiusura:{' '}
            <span className="font-medium text-slate-800">
              {p.dimesso_at.toDate().toLocaleString('it-IT')}
            </span>
          </p>
        ) : null}
      </div>

      <div className="space-y-0">
        <PmaAllergieSiAlert
          allergieVerifica={p.allergie_verifica}
          allergie={p.allergie}
          className="mx-3 mt-3"
        />
        {isMedico ? (
          <div className="border-b border-sky-100 bg-sky-50/90 px-3 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-sky-900">
              Note personali (promemoria)
            </p>
            <p className="mt-1 text-xs text-sky-800/90">
              Solo lettura qui — promemoria privati, non sono firme e non compaiono nel PDF. Imposta
              o modifica da{' '}
              <a href="/account" className="font-semibold underline hover:text-sky-950">
                Account
              </a>
              .
            </p>
            {notePersonaliMedico ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                {notePersonaliMedico}
              </p>
            ) : (
              <p className="mt-2 text-sm italic text-slate-600">
                Nessuna nota salvata. Apri Account per aggiungere promemoria da consultare in
                dimissione.
              </p>
            )}
          </div>
        ) : null}
        <PmaFieldGuard fieldKey="dimissione_esito" className="pma-row block">
          <label className="pma-field max-w-xl">
            <span className="pma-field__label">Esito</span>
            <select
              disabled={!dimissioneEdit}
              value={p.dimissione_esito ?? ''}
              onChange={(e) => {
                const v = e.target.value
                void write({
                  dimissione_esito: v === '' ? null : (v as DimissioneEsito),
                })
              }}
            >
              <option value="">— Seleziona —</option>
              {DIMISSIONE_ESITO_VALUES.map((id) => (
                <option key={id} value={id}>
                  {DIMISSIONE_ESITO_LABEL[id]}
                </option>
              ))}
            </select>
          </label>
        </PmaFieldGuard>

        {p.dimissione_esito === 'riaffidato' ? (
          <PmaFieldGuard fieldKey="affidatario" className="border-b border-slate-100 block">
          <div>
            <div className="pma-section-hdr">Dati affidatario</div>
            <div className="pma-row pma-row--2">
              <label className="pma-field pma-field--br">
                <span className="pma-field__label">Nome</span>
                <input
                  type="text"
                  disabled={!dimissioneEdit}
                  value={affidatarioNomeDraft}
                  onChange={(e) => setAffidatarioNomeDraft(e.target.value)}
                  onBlur={() => void write({ affidatario_nome: affidatarioNomeDraft })}
                />
              </label>
              <label className="pma-field">
                <span className="pma-field__label">Cognome</span>
                <input
                  type="text"
                  disabled={!dimissioneEdit}
                  value={affidatarioCognomeDraft}
                  onChange={(e) => setAffidatarioCognomeDraft(e.target.value)}
                  onBlur={() => void write({ affidatario_cognome: affidatarioCognomeDraft })}
                />
              </label>
            </div>
            <div className="pma-row">
              <label className="pma-field">
                <span className="pma-field__label">Legame</span>
                <input
                  key={`afl-${p.id}-${p.affidatario_legame}`}
                  type="text"
                  disabled={!dimissioneEdit}
                  defaultValue={p.affidatario_legame}
                  onBlur={(e) => void write({ affidatario_legame: e.target.value })}
                  placeholder="es. Genitore, accompagnatore…"
                />
              </label>
            </div>
          </div>
          </PmaFieldGuard>
        ) : null}

        <PmaFieldGuard fieldKey="dimissione_note" className="pma-field max-w-3xl block">
          <label htmlFor={`dimissione-note-${p.id}`} className="pma-field__label">
            Note di dimissione
          </label>
          {showPresetDimissione ? (
            <div className="mt-1 mb-2 block w-full max-w-3xl space-y-2">
              <label htmlFor={`dim-preset-sel-${p.id}`} className="text-xs font-medium text-slate-600">
                Preset dimissioni (selezione multipla)
              </label>
              <select
                id={`dim-preset-sel-${p.id}`}
                multiple
                size={Math.min(5, presetDimissione.length)}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                value={presetSel.map(String)}
                onChange={(e) => {
                  const next = Array.from(e.target.selectedOptions).map((o) => Number(o.value))
                  setPresetSel(next.filter((n) => Number.isFinite(n)))
                }}
              >
                {presetDimissione.map((preset, idx) => {
                  const tit = preset.titolo.trim() || `Preset ${idx + 1}`
                  const preview = preset.testo.trim()
                  const optLabel =
                    preview.length > 0
                      ? `${tit} — ${preview.length > 120 ? `${preview.slice(0, 120)}…` : preview}`
                      : tit
                  return (
                    <option key={idx} value={String(idx)} title={optLabel}>
                      {optLabel}
                    </option>
                  )
                })}
              </select>
              <button
                type="button"
                className={btnSecondary}
                disabled={presetSel.length === 0}
                onClick={() => {
                  const testi = presetSel
                    .map((idx) => presetDimissione[idx]?.testo ?? '')
                    .filter((t) => String(t).trim())
                  void appendPresetTesti(testi).then(() => setPresetSel([]))
                }}
              >
                Inserisci preset selezionati nelle note
              </button>
            </div>
          ) : null}
          <textarea
            id={`dimissione-note-${p.id}`}
            disabled={!dimissioneEdit}
            rows={5}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={() => void write({ dimissione_note: noteDraft })}
          />
          <label htmlFor={`dimissione-email-${p.id}`} className="mt-3 block pma-field__label">
            Email paziente
          </label>
          <input
            id={`dimissione-email-${p.id}`}
            type="email"
            disabled={!dimissioneEdit}
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            onBlur={() => void write({ email: emailDraft.trim() })}
            placeholder="nome@esempio.it"
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </PmaFieldGuard>

        {consensoGenericoCure.trim() ? (
          <div className="pma-card max-w-3xl">
            <div className="pma-card__hdr">Consenso generico alle cure</div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {consensoGenericoCure.trim()}
            </p>
          </div>
        ) : null}
        {consensoPrivacy.trim() ? (
          <div className="pma-card max-w-3xl">
            <div className="pma-card__hdr">Consenso privacy</div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {consensoPrivacy.trim()}
            </p>
          </div>
        ) : null}
        {p.dimissione_esito === 'rifiuta_invio_ps' && rifiutoInvioPs.trim() ? (
          <div className="pma-card max-w-3xl">
            <div className="pma-card__hdr">Rifiuto invio in PS</div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {rifiutoInvioPs.trim()}
            </p>
          </div>
        ) : null}

        <div>
          <div className="pma-section-hdr">Firma paziente (opzionale)</div>
          <div className="px-3 pb-3">
            {dimissioneEdit && pmaIpadFirma ? (
              <div className="mb-3 space-y-2 rounded-lg border border-violet-200 bg-violet-50/80 px-3 py-2.5">
                <p className="text-xs text-violet-950">
                  <strong>iPad PMA:</strong> apre sul tablet lo spazio firma paziente (come in
                  dimissione). Il paziente firma e la firma torna qui in scheda. Resta valida solo
                  l&apos;ultima richiesta inviata.
                </p>
                <button
                  type="button"
                  disabled={ipadBusy}
                  onClick={() => void handleInviaIpadFirma()}
                  className={`${btnPrimary} uppercase tracking-wide disabled:opacity-50`}
                >
                  {ipadBusy ? 'Invio…' : 'Apri firma su iPad'}
                </button>
                {ipadOk ? (
                  <p className="text-xs font-medium text-emerald-800" role="status">
                    Firma aperta sull&apos;iPad — in attesa del paziente…
                  </p>
                ) : null}
                {ipadErr ? (
                  <p className="text-xs text-red-800" role="alert">
                    {ipadErr}
                  </p>
                ) : null}
                {ipadQueueForPatient?.status === 'pending' ? (
                  <p className="text-xs text-amber-900" role="status">
                    In attesa firma su iPad…
                  </p>
                ) : null}
                {ipadQueueForPatient?.status === 'signed' ? (
                  <p className="text-xs font-medium text-emerald-800" role="status">
                    Firma ricevuta dall&apos;iPad.
                  </p>
                ) : null}
              </div>
            ) : null}
            {dimissioneEdit ? (
              <div className="space-y-3">
                {firmaPaz ? (
                  <div className="flex flex-wrap gap-2">
                    {!replaceFirma ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setReplaceFirma(true)}
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                        >
                          Sostituisci firma
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void write({
                              firma_paziente_base64: deleteField(),
                              firma_paziente_url: deleteField(),
                            })
                          }
                          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900 hover:bg-red-100"
                        >
                          Rimuovi firma
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReplaceFirma(false)}
                        className="text-sm font-medium text-slate-600 underline hover:text-slate-900"
                      >
                        Annulla sostituzione
                      </button>
                    )}
                  </div>
                ) : null}
                <SignatureCanvas
                  key={`firma-${p.id}-${replaceFirma}`}
                  variant="compact"
                  preloadImageSrc={!replaceFirma ? firmaPaz : null}
                  onSaveDataUrl={handleSaveFirmaPaziente}
                />
              </div>
            ) : (
              <SignatureCanvas
                disabled
                variant="compact"
                savedImageSrc={firmaPaz}
                onSaveDataUrl={handleSaveFirmaPaziente}
              />
            )}
          </div>
        </div>

        <div>
          <div className="pma-section-hdr">Firma medico</div>
          <div className="px-3 pb-3">
            {firmaMedicoPreview ? (
              <div className="inline-block max-w-full rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
                <img
                  src={firmaMedicoPreview}
                  alt="Firma medico"
                  className="max-h-28 max-w-full object-contain sm:max-h-32"
                />
              </div>
            ) : (
              <div
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
                role="status"
              >
                {isMedico
                  ? 'Firma non configurata — apri Account in alto a sinistra per caricarla.'
                  : 'Firma medico non ancora su scheda. Il medico che dimette la vede da Account fino alla chiusura.'}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-8">
          {pazienteGiaDimesso ? (
            <p className="mb-6 text-center text-sm font-medium text-slate-600" role="status">
              Paziente già dimesso — scheda chiusa.
            </p>
          ) : canChiudiDimetti ? (
            <div className="mb-6 flex w-full justify-center">
              <button
                type="button"
                onClick={() => {
                  setDimettiErr(null)
                  setDimettiOpen(true)
                }}
                className={`${btnDanger} w-full max-w-lg`}
              >
                Dimetti paziente
              </button>
            </div>
          ) : null}

          {pdfErr ? (
            <p className="mb-4 text-center text-sm text-red-700" role="alert">
              {pdfErr}
            </p>
          ) : null}

          <div className="mx-auto flex max-w-2xl flex-col items-stretch justify-center gap-3 sm:flex-row">
            <button
              type="button"
              disabled={pdfBusy}
              onClick={() => void handlePreviewPdf()}
              className={`${btnSecondary} flex-1`}
            >
              {pdfBusy ? 'Generazione…' : 'Apri PDF'}
            </button>
            <button
              type="button"
              disabled={pdfBusy}
              onClick={handleSendMail}
              className={`${btnSecondary} flex-1`}
            >
              Invia via mail
            </button>
            <button
              type="button"
              disabled={pdfBusy}
              onClick={() => void handlePrintPdf()}
              className={`${btnPrimary} flex-1`}
            >
              {pdfBusy ? 'Generazione…' : 'Stampa PDF'}
            </button>
          </div>

          {pdfBusy ? (
            <p className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500">
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
                aria-hidden
              />
              Elaborazione PDF…
            </p>
          ) : null}
        </div>
      </div>

      {pdfPreviewUrl ? (
        <PdfPreviewModal
          url={pdfPreviewUrl}
          filename={pdfPreviewFilename ?? undefined}
          title={`Referto — ${p.id_paziente_visibile}`}
          onClose={closePdfPreview}
          onPrint={() => void handlePrintPdf()}
          onOpenNewTab={() => {
            if (pdfPreviewUrl && !tryOpenPdfInNewTab(pdfPreviewUrl)) {
              setPdfErr('Popup bloccato: consenti le finestre per questo sito oppure usa l’anteprima integrata.')
            }
          }}
        />
      ) : null}

      {dimettiOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dimetti-title"
        >
          <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 id="dimetti-title" className="text-lg font-bold text-slate-900">
              Conferma dimissione
            </h3>
            <p className="mt-3 text-sm text-slate-600">
              Sei sicuro? Una volta dimesso, il paziente verrà chiuso e non sarà più possibile modificare i
              dati. Resti sulla scheda in sola lettura.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Prima di confermare servono: esito dimissione e medico di riferimento. Ospedale PS,
              dati affidatario e firme possono essere completati dopo (scheda sbloccabile).
            </p>
            {dimettiErr ? (
              <p className="mt-3 text-sm text-red-700" role="alert">
                {dimettiErr}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-slate-500">
              La firma medico non è obbligatoria: se non configurata in Account, la dimissione procede
              comunque.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={dimettiBusy}
                onClick={() => setDimettiOpen(false)}
                className={btnSecondary}
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={dimettiBusy}
                onClick={() => void handleDimettiConfirm()}
                className={btnDanger}
              >
                {dimettiBusy ? 'Chiusura…' : 'Conferma dimissione'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
