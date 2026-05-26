/**
 * URL PDF per visualizzazione embedded (Safari iPad / Chrome).
 * `view=FitH` adatta la pagina alla larghezza del riquadro.
 */
export function pdfEmbedViewerUrl(url) {
  const raw = String(url ?? '').trim();
  if (!raw) return '';
  const base = raw.split('#')[0].split('?')[0];
  return `${base}#view=FitH&zoom=page-width&scrollbar=1&toolbar=1`;
}
