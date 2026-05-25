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
import { createPdfObjectUrl, printPdfBlob, revokePdfObjectUrl, tryOpenPdfInNewTab } from '@pma/lib/pdf/pdfBlobActions'
import { resolveMedicoFirmaPngSrc, resolveMedicoFirmaSrc } from '@pma/lib/medicoFirma'
import { rasterizeFirmaDataUrlToPng } from '@pma/lib/signatureSvg'
import { PdfPreviewModal } from './PdfPreviewModal'
import type { PresetDimissioneVoce } from '@pma/types/manifestazioneImpostazioni'
import { btnDanger, btnPrimary, btnSecondary } from '@pma/cross/uiTokens'

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
}

/**
 * Sezione 4 — Dimissione.
 * Modifica: Superadmin, Centrale, Medico. Infermiere e Soccorritore: sola lettura.
 * Chiusura definitiva (**Dimetti**): solo Medico con scheda aperta.
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
}: Props) {
  const dimissioneEdit = canEditDimissioneTab && canEditScheda
  const canChiudiDimetti = Boolean(canEditScheda && user && user.rank === 'Medico')
  const [noteDraft, setNoteDraft] = useState(p.dimissione_note)
  const [dimettiOpen, setDimettiOpen] = useState(false)
  const [dimettiBusy, setDimettiBusy] = useState(false)
  const [replaceFirma, setReplaceFirma] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfErr, setPdfErr] = useState<string | null>(null)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)
  const [pdfPreviewFilename, setPdfPreviewFilename] = useState<string | null>(null)
  const [pdfPreviewBlob, setPdfPreviewBlob] = useState<Blob | null>(null)

  useEffect(() => {
    return () => revokePdfObjectUrl(pdfPreviewUrl)
  }, [pdfPreviewUrl])

  useEffect(() => {
    setNoteDraft(p.dimissione_note)
  }, [p.id])
  useEffect(() => {
    if (!dimissioneEdit) setNoteDraft(p.dimissione_note)
  }, [dimissioneEdit, p.dimissione_note])

  const pdfManifestazioneTesti = {
    consensoGenericoCure: consensoGenericoCure.trim() || undefined,
    consensoPrivacy: consensoPrivacy.trim() || undefined,
    rifiutoInvioPsText: rifiutoInvioPs.trim() || undefined,
  }

  const firmaMedicoProfilo =
    isMedico && user ? resolveMedicoFirmaSrc(user) : null
  const firmaMedicoPreview = p.dimissione_firma_medico_base64 ?? firmaMedicoProfilo

  async function handleSaveFirmaPaziente(dataUrl: string) {
    await write({
      firma_paziente_base64: dataUrl,
      firma_paziente_url: deleteField(),
    })
    setReplaceFirma(false)
  }

  async function handleDimettiConfirm() {
    if (!canChiudiDimetti || !user || user.rank !== 'Medico') return
    setDimettiBusy(true)
    try {
      let snap = user.firma_medico_base64?.trim() || null
      const src = resolveMedicoFirmaSrc(user)
      if (!snap && src) {
        snap = await rasterizeFirmaDataUrlToPng(src)
      }
      await write({
        aperto: false,
        stato: 'dimesso',
        dimesso_at: serverTimestamp(),
        dimissione_firma_medico_base64: snap,
        dimissione_firma_medico_url: deleteField(),
      })
      setDimettiOpen(false)
    } finally {
      setDimettiBusy(false)
    }
  }

  async function buildCurrentPdfBlob() {
    const { buildPazientePdfBlob } = await import('../../lib/pdf/pazientePdfReport')
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

  const firmaPaz = p.firma_paziente_base64

  const showPresetMenuMedico = Boolean(isMedico && dimissioneEdit && presetDimissione.length > 0)

  function appendPresetTesto(testoPreset: string) {
    const t = testoPreset.trim()
    if (!t) return
    setNoteDraft((prev) => {
      const base = prev.trimEnd()
      const next = base ? `${base}\n\n${t}` : t
      void write({ dimissione_note: next })
      return next
    })
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
                  key={`afn-${p.id}-${p.affidatario_nome}`}
                  type="text"
                  disabled={!dimissioneEdit}
                  defaultValue={p.affidatario_nome}
                  onBlur={(e) => void write({ affidatario_nome: e.target.value })}
                />
              </label>
              <label className="pma-field">
                <span className="pma-field__label">Cognome</span>
                <input
                  key={`afc-${p.id}-${p.affidatario_cognome}`}
                  type="text"
                  disabled={!dimissioneEdit}
                  defaultValue={p.affidatario_cognome}
                  onBlur={(e) => void write({ affidatario_cognome: e.target.value })}
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
          {showPresetMenuMedico ? (
            <label className="mt-1 mb-2 block w-full max-w-3xl" htmlFor={`dim-preset-sel-${p.id}`}>
              <span className="sr-only">Preset dimissioni</span>
              <select
                id={`dim-preset-sel-${p.id}`}
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                defaultValue=""
                onChange={(e) => {
                  const raw = e.target.value
                  e.target.value = ''
                  if (raw === '') return
                  const idx = Number(raw)
                  const preset = presetDimissione[idx]
                  if (preset) appendPresetTesto(preset.testo)
                }}
              >
                <option value="">Preset dimissioni…</option>
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
            </label>
          ) : null}
          <textarea
            id={`dimissione-note-${p.id}`}
            disabled={!dimissioneEdit}
            rows={5}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={() => void write({ dimissione_note: noteDraft })}
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
          <div className="pma-section-hdr">Firma paziente</div>
          <div className="px-3 pb-3">
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
                  : 'Firma medico non disponibile (nessuna copia su scheda e profilo non applicabile a questa vista).'}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-8">
          {canChiudiDimetti ? (
            <div className="mb-6 flex w-full justify-center">
              <button
                type="button"
                onClick={() => setDimettiOpen(true)}
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
