import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Timestamp } from 'firebase/firestore'
import type { Paziente } from '@pma/types/paziente'
import {
  allergieVerificaDisplay,
  CODICE_COLORE_LABEL,
  PAZIENTE_STATO_LABEL,
  TIPO_PAZIENTE_LABEL,
} from '@pma/types/paziente'
import { DIMISSIONE_ESITO_LABEL } from '@pma/types/dimissione'
import { FARMACO_VIA_LABEL } from '@pma/types/cartellaClinica'
import { buildLesioniPngDataUrl } from './lesioniFigurePng'
import { rasterizeFirmaDataUrlToPng, svgMarkupToDataUrl } from '../signatureSvg'
import { resolveEoColumnsForDisplay, formatEoColumnsForPdf } from '../eoPazienteFields'
import { defaultEoQuickGroupRows } from '../eoQuickDefaults'
import { orderedPrestazioniLabels, prestazioniRowsOfFour } from '../prestazioniDisplay'

export type PazientePdfContext = {
  manifestazioneNome: string
  pmaNome: string
  /** Per ordinare le prestazioni come in cartella clinica (stesso elenco manifestazione). */
  prestazioniManifestazioneLista?: string[]
  /**
   * Firma medico da profilo (data URL / Base64 / URL) se non ancora salvata in
   * `dimissione_firma_medico_base64` sul documento paziente.
   */
  firmaMedicoProfiloDataUrl?: string | null
  /** Da `impostazioni` manifestazione: inclusi nel PDF se valorizzati. */
  consensoGenericoCure?: string | null
  consensoPrivacy?: string | null
  /** Incluso se esito dimissione = rifiuta invio in PS e il testo è valorizzato. */
  rifiutoInvioPsText?: string | null
}

function tsIt(ts: Timestamp | null | undefined): string {
  if (!ts || typeof ts.toDate !== 'function') return '—'
  try {
    return ts.toDate().toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function tsItDate(ts: Timestamp | null | undefined): string {
  if (!ts || typeof ts.toDate !== 'function') return '—'
  try {
    return ts.toDate().toLocaleDateString('it-IT')
  } catch {
    return '—'
  }
}

async function normalizeImageSrcForPdf(src: string): Promise<string | null> {
  const s = src.trim()
  if (!s) return null
  if (s.startsWith('data:image/svg+xml') || s.startsWith('<svg')) {
    try {
      const dataUrl = s.startsWith('<svg') ? svgMarkupToDataUrl(s) : s
      return await rasterizeFirmaDataUrlToPng(dataUrl)
    } catch {
      return null
    }
  }
  if (s.startsWith('data:image')) {
    const comma = s.indexOf(',')
    if (comma === -1) return null
    const meta = s.slice(0, comma)
    const b64 = s.slice(comma + 1).replace(/\s/g, '')
    if (!b64) return null
    return `${meta},${b64}`
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(s) && s.length > 80) {
    return `data:image/png;base64,${s.replace(/\s/g, '')}`
  }
  if (s.startsWith('http://') || s.startsWith('https://')) {
    try {
      const res = await fetch(s, { mode: 'cors' })
      if (!res.ok) return null
      const blob = await res.blob()
      return await new Promise<string | null>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(typeof r.result === 'string' ? r.result : null)
        r.onerror = () => reject(new Error('Lettura immagine fallita.'))
        r.readAsDataURL(blob)
      })
    } catch {
      return null
    }
  }
  return null
}

/** Dimensioni immagine scalata come in `addImageDataUrl` (senza disegnare). */
async function getScaledImageDimensions(
  dataUrl: string,
  maxW: number,
  maxH: number,
): Promise<{ w: number; h: number; fmt: 'PNG' | 'JPEG' }> {
  const lower = dataUrl.toLowerCase()
  const fmt: 'PNG' | 'JPEG' =
    lower.includes('image/jpeg') || lower.includes('image/jpg') ? 'JPEG' : 'PNG'
  const img = new Image()
  await new Promise<void>((res, rej) => {
    img.onload = () => res()
    img.onerror = () => rej(new Error('Immagine firma non decodificabile.'))
    img.src = dataUrl
  })
  const iw = img.naturalWidth || 1
  const ih = img.naturalHeight || 1
  let w = maxW
  let h = (ih / iw) * w
  if (h > maxH) {
    h = maxH
    w = (iw / ih) * h
  }
  return { w, h, fmt }
}

async function addImageDataUrl(
  doc: jsPDF,
  dataUrl: string,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
): Promise<number> {
  const { w, h, fmt } = await getScaledImageDimensions(dataUrl, maxW, maxH)
  try {
    doc.addImage(dataUrl, fmt, x, y, w, h)
  } catch {
    doc.addImage(dataUrl, 'PNG', x, y, w, h)
  }
  return h
}

type DocWithAuto = jsPDF & { lastAutoTable?: { finalY: number } }

function afterAutoTableY(doc: jsPDF, fallback: number): number {
  const d = doc as DocWithAuto
  return (d.lastAutoTable?.finalY ?? fallback) + 5
}

/**
 * Genera PDF A4 compatto (9–10 pt) della scheda paziente.
 */
export async function buildPazientePdfBlob(p: Paziente, ctx: PazientePdfContext): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const M = 10
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const textW = W - 2 * M
  let y = M

  const setSmall = () => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
  }

  const newPage = () => {
    doc.addPage()
    y = M
  }

  const pageInnerH = H - 2 * M

  const ensure = (h: number) => {
    if (y + h > H - M) newPage()
  }

  /**
   * Evita di spezzare un blocco con l’interruzione di pagina: se non entra nello spazio residuo,
   * inizia il blocco in cima a una nuova pagina. Se il blocco è più alto di una pagina intera,
   * almeno inizia in alto (nuova pagina se siamo troppo in basso per un chunk sensato).
   */
  const ensureBlockHeight = (blockMm: number) => {
    if (blockMm <= 0) return
    if (blockMm <= pageInnerH) {
      if (y + blockMm > H - M) newPage()
    } else {
      const chunk = Math.min(blockMm, pageInnerH)
      if (y + chunk > H - M) newPage()
    }
  }

  /** Evita che tabelle vengano spezzate tra pagine quando possibile (jspdf-autotable). */
  const TABLE_KEEP_ON_PAGE = { pageBreak: 'avoid' as const, rowPageBreak: 'avoid' as const }

  /** Se il blocco stimato (≤ un foglio) non sta nel residuo, inizia in cima a una nuova pagina. */
  const ensureSectionFits = (estimatedMm: number) => {
    const need = Math.min(Math.max(estimatedMm, 0), pageInnerH)
    if (need > 0 && y + need > H - M) newPage()
  }

  const titleLineHeightMm = (size: number) => size * 0.45 + 2

  /** Titolo di sezione: non resta “appiccicato” in fondo pagina senza spazio per il contenuto. */
  const writeTitle = (t: string, size = 10, minFollowingMm = 12) => {
    const th = titleLineHeightMm(size)
    ensureBlockHeight(th + minFollowingMm)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(size)
    doc.text(t, M, y)
    y += th
    setSmall()
  }

  const bodyLineH = 3.6
  const paragraphTitleGap = 4

  type ParagraphOpts = { compact?: boolean }

  /**
   * Titolo + testo: se l’intero blocco entra in una pagina, non viene spezzato (salto pagina prima se serve).
   * Se il testo è più alto di un foglio, il titolo resta con le prime righe possibili e il resto continua.
   * `compact`: ~50% della scala standard (consensi in PDF, risparmio spazio; stampa B/N).
   */
  const writeParagraph = (title: string, body: string, opts?: ParagraphOpts) => {
    const compact = opts?.compact ?? false
    const titleSz = compact ? 4.5 : 9
    const bodySz = compact ? 4.5 : 9
    const lineH = compact ? 2.05 : bodyLineH
    const titleGap = compact ? 2.8 : paragraphTitleGap
    const bodyText = (body || '').trim() || '—'
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(bodySz)
    const lines = doc.splitTextToSize(bodyText, textW)
    const titleH = titleGap
    const bodyH = lines.length * lineH
    const tail = 1.5
    const total = titleH + bodyH + tail

    if (total <= pageInnerH) {
      if (y + total > H - M) newPage()
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(titleSz)
      doc.setTextColor(0, 0, 0)
      doc.text(title, M, y)
      y += titleH
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(bodySz)
      for (const line of lines) {
        doc.text(line, M, y)
        y += lineH
      }
      y += tail
      return
    }

    if (y + titleH + lineH > H - M) newPage()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(titleSz)
    doc.setTextColor(0, 0, 0)
    doc.text(title, M, y)
    y += titleH
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(bodySz)
    for (const line of lines) {
      if (y + lineH > H - M) newPage()
      doc.text(line, M, y)
      y += lineH
    }
    y += tail
  }

  /** Rifiuto invio PS: evidenza con bordo marcato (leggibile in stampa bianco e nero). */
  const writeRifiutoInvioPsBox = (title: string, body: string) => {
    const bodyText = (body || '').trim() || '—'
    const pad = 2.8
    const innerW = textW - pad * 2
    const titleSz = 8
    const bodySz = 8
    const lhTitle = 3.1
    const lhBody = 3.35
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(titleSz)
    const titleLines = doc.splitTextToSize(title, innerW)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(bodySz)
    const bodyLines = doc.splitTextToSize(bodyText, innerW)
    const innerH =
      titleLines.length * lhTitle + (titleLines.length ? 1.2 : 0) + bodyLines.length * lhBody
    const boxH = pad * 2 + innerH

    if (boxH > pageInnerH - 6) {
      writeParagraph(title, bodyText, { compact: true })
      return
    }
    if (y + boxH > H - M) newPage()

    const y0 = y
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(1.15)
    doc.setFillColor(255, 255, 255)
    doc.rect(M, y0, textW, boxH, 'FD')
    doc.setLineWidth(0.25)
    doc.setTextColor(0, 0, 0)

    let yt = y0 + pad + titleSz * 0.35
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(titleSz)
    for (const line of titleLines) {
      doc.text(line, M + pad, yt)
      yt += lhTitle
    }
    yt += 0.8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(bodySz)
    for (const line of bodyLines) {
      doc.text(line, M + pad, yt)
      yt += lhBody
    }
    y = y0 + boxH + 2.5
  }

  // Intestazione
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Report scheda paziente — CROSS PMA', M, y)
  y += 6
  setSmall()
  doc.text(`Manifestazione: ${ctx.manifestazioneNome || '—'}`, M, y)
  y += 4
  doc.text(`PMA: ${ctx.pmaNome || '—'}`, M, y)
  y += 4
  doc.text(
    `ID paziente: ${p.id_paziente_visibile}  ·  Colore: ${CODICE_COLORE_LABEL[p.codice_colore]}  ·  Stato: ${PAZIENTE_STATO_LABEL[p.stato]}`,
    M,
    y,
  )
  y += 5
  doc.text(`Apertura scheda: ${tsIt(p.apertura_scheda)}`, M, y)
  y += 6

  // Anagrafica (2 colonne)
  writeTitle('Dati anagrafici e generali', 10)
  const colGap = 6
  const colW = (textW - colGap) / 2
  const x2 = M + colW + colGap
  const leftCol = [
    `Nome: ${p.nome || '—'}`,
    `Cognome: ${p.cognome || '—'}`,
    `CF: ${p.codice_fiscale?.trim() || '—'}`,
    `Età (campo): ${p.eta != null ? `${p.eta} anni` : '—'}`,
    `Data nascita: ${tsItDate(p.data_nascita)}`,
  ]
  const rightCol = [
    `Email: ${p.email?.trim() || '—'}`,
    `Telefono: ${p.telefono?.trim() || '—'}`,
    `Tipo: ${TIPO_PAZIENTE_LABEL[p.tipo_paziente]}`,
    `Pettorale: ${p.pettorale != null ? String(p.pettorale) : '—'}`,
  ]
  const nAnagRows = Math.max(leftCol.length, rightCol.length)
  const anagBlockH = nAnagRows * 4 + 2
  if (anagBlockH <= pageInnerH && y + anagBlockH > H - M) newPage()
  let ya = y
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  for (let i = 0; i < nAnagRows; i++) {
    if (anagBlockH > pageInnerH && ya + 4 > H - M) {
      newPage()
      ya = y
    }
    if (leftCol[i]) doc.text(leftCol[i], M, ya)
    if (rightCol[i]) doc.text(rightCol[i], x2, ya)
    ya += 4
  }
  y = ya + 2

  if ((p.breve_descrizione ?? '').trim()) {
    writeParagraph('Breve descrizione (Sez. 1)', p.breve_descrizione)
  }
  if (p.tipo_evento || p.dettaglio_evento) {
    writeParagraph('Tipo / dettaglio evento', `${p.tipo_evento || '—'} — ${p.dettaglio_evento || '—'}`)
  }

  // Cartella
  writeTitle('Cartella clinica', 10)
  writeParagraph('DOMANDA ALLERGIE', allergieVerificaDisplay(p.allergie_verifica))
  writeParagraph('APR', p.apr)
  writeParagraph('Allergie', p.allergie)
  writeParagraph('APP', p.app)
  writeParagraph('Note esame obiettivo', p.eo_note)
  const eoCols = resolveEoColumnsForDisplay(p, defaultEoQuickGroupRows())
  const eoRiepilogo = formatEoColumnsForPdf(eoCols)
  if (eoRiepilogo !== '—') {
    writeParagraph('EO rapido', eoRiepilogo)
  }

  // Parametri vitali (operatore per riga omesso: in PDF compare solo il medico di dimissione)
  const pvBody = [...p.parametri_vitali]
    .sort((a, b) => (a.registrato_at?.toMillis?.() ?? 0) - (b.registrato_at?.toMillis?.() ?? 0))
    .map((r) => [
      tsIt(r.registrato_at),
      r.gcs != null ? String(r.gcs) : '—',
      r.fr != null ? String(r.fr) : '—',
      r.spo2_aa != null ? String(r.spo2_aa) : '—',
      r.spo2_o2 != null ? String(r.spo2_o2) : '—',
      r.fc != null ? String(r.fc) : '—',
      `${r.pa_sistolica != null ? r.pa_sistolica : '—'}/${r.pa_diastolica != null ? r.pa_diastolica : '—'}`,
      r.temperatura != null ? String(r.temperatura) : '—',
      r.nrs != null ? String(r.nrs) : '—',
    ])
  const nPvRows = Math.max(1, pvBody.length)
  const pvTableMm = 10 + nPvRows * 6.5
  ensureSectionFits(titleLineHeightMm(9) + pvTableMm)
  writeTitle('Parametri vitali', 9, 0)
  autoTable(doc, {
    startY: y,
    head: [['Data/ora', 'GCS', 'FR', 'SpO₂ aa', 'SpO₂ O₂', 'FC', 'PA', 'T°C', 'NRS']],
    body: pvBody.length ? pvBody : [['—', '—', '—', '—', '—', '—', '—', '—', '—']],
    styles: { fontSize: 7, cellPadding: 0.8, overflow: 'linebreak' },
    headStyles: { fillColor: [51, 65, 85], fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 22 },
      8: { cellWidth: 10 },
    },
    margin: { left: M, right: M },
    ...TABLE_KEEP_ON_PAGE,
  })
  y = afterAutoTableY(doc, y)

  // Prestazioni (griglia 4 colonne, come cartella clinica)
  const prestOrdinate = orderedPrestazioniLabels(
    ctx.prestazioniManifestazioneLista ?? [],
    p.prestazioni_sel ?? [],
  )
  const prestBody = prestOrdinate.length ? prestazioniRowsOfFour(prestOrdinate) : [['—', '', '', '']]
  const prestColW = textW / 4
  const prestRows = Math.max(1, prestBody.length)
  const prestTableMm = 8 + prestRows * 5.5
  ensureSectionFits(titleLineHeightMm(9) + prestTableMm)
  writeTitle('Prestazioni', 9, 0)
  autoTable(doc, {
    startY: y,
    body: prestBody,
    margin: { left: M, right: M },
    tableWidth: textW,
    styles: { fontSize: 7.5, cellPadding: 1, overflow: 'linebreak', valign: 'top' },
    columnStyles: {
      0: { cellWidth: prestColW },
      1: { cellWidth: prestColW },
      2: { cellWidth: prestColW },
      3: { cellWidth: prestColW },
    },
    ...TABLE_KEEP_ON_PAGE,
  })
  y = afterAutoTableY(doc, y)

  // Farmaci: solo data/ora, nome, dose, via (no inserito_da_nome / operatore riga)
  const farmBody = [...p.farmaci]
    .sort((a, b) => (a.registrato_at?.toMillis?.() ?? 0) - (b.registrato_at?.toMillis?.() ?? 0))
    .map((f) => [
      tsIt(f.registrato_at),
      f.nome,
      f.dose,
      FARMACO_VIA_LABEL[f.via],
    ])
  const nFarmRows = Math.max(1, farmBody.length)
  const farmTableMm = 10 + nFarmRows * 5.5
  ensureSectionFits(titleLineHeightMm(9) + farmTableMm)
  writeTitle('Farmaci', 9, 0)
  autoTable(doc, {
    startY: y,
    head: [['Data/ora', 'Farmaco', 'Dose', 'Via']],
    body: farmBody.length ? farmBody : [['—', '—', '—', '—']],
    styles: { fontSize: 8, cellPadding: 1 },
    headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
    columnStyles: { 1: { cellWidth: 55 } },
    margin: { left: M, right: M },
    ...TABLE_KEEP_ON_PAGE,
  })
  y = afterAutoTableY(doc, y)

  // Rivalutazioni (firma operatore omessa: come PV/farmaci, solo medico in dimissione)
  const rivBody = [...p.rivalutazioni]
    .sort((a, b) => (a.creato_at?.toMillis?.() ?? 0) - (b.creato_at?.toMillis?.() ?? 0))
    .map((r) => [tsIt(r.creato_at), r.testo])
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  const rivNoteW = 104
  let rivTableMm = 10
  const rivRowsForEst = rivBody.length ? rivBody : [['—', '—']]
  for (const r of rivRowsForEst) {
    const noteLines = doc.splitTextToSize(String(r[1]), rivNoteW).length
    rivTableMm += 4 + noteLines * 2.7
  }
  rivTableMm = Math.min(rivTableMm, pageInnerH)
  ensureSectionFits(titleLineHeightMm(9) + rivTableMm)
  writeTitle('Rivalutazioni', 9, 0)
  autoTable(doc, {
    startY: y,
    head: [['Data/ora', 'Nota']],
    body: rivBody.length ? rivBody : [['—', '—']],
    styles: { fontSize: 7.5, cellPadding: 1 },
    headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
    columnStyles: { 1: { cellWidth: 110 } },
    margin: { left: M, right: M },
    ...TABLE_KEEP_ON_PAGE,
  })
  y = afterAutoTableY(doc, y)

  // Lesioni
  const lesTitSz = 9
  const lesTitH = titleLineHeightMm(lesTitSz)
  const lesListLineH = 3.5

  if (p.lesioni.length) {
    const png = await buildLesioniPngDataUrl(p.lesioni)
    let imgBlockH = 0
    let imgDims: { h: number } | null = null
    if (png) {
      imgDims = await getScaledImageDimensions(png, Math.min(textW, 118), 56)
      imgBlockH = imgDims.h + 4
    }
    const sorted = [...p.lesioni].sort((a, b) => a.n - b.n)
    let listBlockH = 0
    for (const L of sorted) {
      const line = `${L.n}. [${L.vista === 'front' ? 'Fronte' : 'Retro'}] ${L.descrizione?.trim() || '—'}`
      const wrapped = doc.splitTextToSize(line, textW)
      listBlockH += wrapped.length * lesListLineH
    }
    listBlockH += 2

    const lesioniTotal = lesTitH + imgBlockH + listBlockH
    if (lesioniTotal <= pageInnerH) {
      if (y + lesioniTotal > H - M) newPage()
    } else {
      const keepHead = lesTitH + imgBlockH
      ensureBlockHeight(Math.min(Math.max(keepHead, lesTitH + lesListLineH), pageInnerH))
    }

    writeTitle('Lesioni (schema)', lesTitSz, 0)
    if (png && imgDims) {
      const hImg = await addImageDataUrl(doc, png, M, y, Math.min(textW, 118), 56)
      y += hImg + 4
    }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    for (const L of sorted) {
      const line = `${L.n}. [${L.vista === 'front' ? 'Fronte' : 'Retro'}] ${L.descrizione?.trim() || '—'}`
      const wrapped = doc.splitTextToSize(line, textW)
      for (const ln of wrapped) {
        if (lesioniTotal > pageInnerH && y + lesListLineH > H - M) newPage()
        doc.text(ln, M, y)
        y += lesListLineH
      }
    }
    y += 2
  } else {
    const lesEmptyH = lesTitH + 6
    if (lesEmptyH <= pageInnerH && y + lesEmptyH > H - M) newPage()
    writeTitle('Lesioni (schema)', lesTitSz, 0)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Nessun marker lesioni.', M, y)
    y += 5
  }

  // Dimissione
  ensureSectionFits(titleLineHeightMm(10) + 28)
  writeTitle('Dimissione (Sez. 4)', 10)
  ensureBlockHeight(8)
  const esitoLabel = p.dimissione_esito ? DIMISSIONE_ESITO_LABEL[p.dimissione_esito] : '—'
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(30, 30, 30)
  doc.text(`Esito: ${esitoLabel}`, M, y)
  y += 4
  const medicoDimissione = String(p.medico_rif ?? '').trim()
  doc.text(`Medico dimissione: ${medicoDimissione || '—'}`, M, y)
  y += 4
  writeParagraph('Note dimissione', p.dimissione_note)
  const cgPdf = ctx.consensoGenericoCure?.trim()
  if (cgPdf) writeParagraph('Consenso generico alle cure', cgPdf, { compact: true })
  const cpPdf = ctx.consensoPrivacy?.trim()
  if (cpPdf) writeParagraph('Consenso privacy', cpPdf, { compact: true })
  if (p.dimissione_esito === 'rifiuta_invio_ps') {
    const rifPdf = ctx.rifiutoInvioPsText?.trim()
    if (rifPdf) writeRifiutoInvioPsBox('Rifiuto invio in PS', rifPdf)
  }
  if (p.dimissione_esito === 'riaffidato') {
    writeParagraph(
      'Affidatario',
      `${p.affidatario_cognome} ${p.affidatario_nome} (${p.affidatario_legame})`.trim(),
    )
  }
  if (p.dimesso_at) {
    ensureBlockHeight(5)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 30, 30)
    doc.text(`Dimesso il: ${tsIt(p.dimesso_at)}`, M, y)
    y += 5
  }

  // Invio PS
  if (p.dimissione_esito === 'invio_ps') {
    const invTitSz = 9
    const invLines = [
      `Missione AREU: ${p.invio_ps_missione_areu ?? '—'}`,
      `Data/ora: ${tsIt(p.invio_ps_data_ora)}`,
      `Mezzo: ${p.invio_ps_mezzo || '—'}`,
      `Ospedale: ${p.invio_ps_ospedale || '—'}`,
      `Codice trasporto: ${p.invio_ps_codice_trasporto ?? '—'}`,
      `Note: ${p.invio_ps_note || '—'}`,
    ]
    const invLineH = 4
    const invTitleH = titleLineHeightMm(invTitSz)
    const invBlockH = invTitleH + invLines.length * invLineH + 2
    if (invBlockH <= pageInnerH && y + invBlockH > H - M) newPage()
    writeTitle('Invio in PS (Sez. 5)', invTitSz, 0)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    for (const ln of invLines) {
      if (invBlockH > pageInnerH && y + invLineH > H - M) newPage()
      doc.text(ln, M, y)
      y += invLineH
    }
    y += 2
  }

  // Firme (paziente e medico affiancati): titolo + etichette + immagini come blocco
  const halfGap = 6
  const halfColW = (textW - halfGap) / 2
  const xRight = M + halfColW + halfGap
  const imgMaxW = halfColW * 0.75
  const imgMaxH = 36 * 0.75

  const firmeTitleSz = 10
  const firmeTitleH = titleLineHeightMm(firmeTitleSz)
  const labelRowH = 4

  const firmaPazSrc = p.firma_paziente_base64?.trim() ?? ''
  let hLeftMeas = 5
  if (firmaPazSrc) {
    try {
      const u = await normalizeImageSrcForPdf(firmaPazSrc)
      if (u) hLeftMeas = (await getScaledImageDimensions(u, imgMaxW, imgMaxH)).h
    } catch {
      hLeftMeas = 5
    }
  }

  const firmaMedDoc = p.dimissione_firma_medico_base64?.trim() ?? ''
  const firmaMedProf = ctx.firmaMedicoProfiloDataUrl?.trim() ?? ''
  const firmaMedCombined = firmaMedDoc || firmaMedProf
  let hRightMeas = 5
  if (firmaMedCombined) {
    try {
      const u = await normalizeImageSrcForPdf(firmaMedCombined)
      if (u) hRightMeas = (await getScaledImageDimensions(u, imgMaxW, imgMaxH)).h
    } catch {
      hRightMeas = 5
    }
  }

  const imgRowH = Math.max(hLeftMeas, hRightMeas, 5)
  const firmeBlockH = firmeTitleH + labelRowH + imgRowH + 6
  if (firmeBlockH <= pageInnerH) {
    if (y + firmeBlockH > H - M) newPage()
  } else {
    ensureBlockHeight(Math.min(firmeBlockH, pageInnerH))
  }
  writeTitle('Firme', firmeTitleSz, 0)
  doc.setFontSize(8)
  const yLabels = y
  doc.setFont('helvetica', 'italic')
  doc.text('Firma paziente', M, yLabels)
  doc.text('Firma / timbro medico (dimissione o profilo)', xRight, yLabels)
  y = yLabels + labelRowH
  doc.setFont('helvetica', 'normal')

  const yImg = y
  let hLeft: number
  let hRight: number

  if (firmaPazSrc) {
    try {
      const u = await normalizeImageSrcForPdf(firmaPazSrc)
      if (u) {
        hLeft = await addImageDataUrl(doc, u, M, yImg, imgMaxW, imgMaxH)
      } else {
        doc.text('(formato non supportato)', M, yImg)
        hLeft = 5
      }
    } catch {
      doc.text('(errore firma paziente)', M, yImg)
      hLeft = 5
    }
  } else {
    doc.text('—', M, yImg)
    hLeft = 5
  }

  if (firmaMedCombined) {
    try {
      const u = await normalizeImageSrcForPdf(firmaMedCombined)
      if (u) {
        hRight = await addImageDataUrl(doc, u, xRight, yImg, imgMaxW, imgMaxH)
      } else {
        doc.text('(formato non supportato)', xRight, yImg)
        hRight = 5
      }
    } catch {
      doc.text('(errore firma medico)', xRight, yImg)
      hRight = 5
    }
  } else {
    doc.text('—', xRight, yImg)
    hRight = 5
  }

  y = yImg + Math.max(hLeft, hRight, 5) + 4

  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  ensure(6)
  doc.text(`Documento generato il ${new Date().toLocaleString('it-IT')} — ID interno: ${p.id}`, M, H - 8)

  return doc.output('blob')
}
