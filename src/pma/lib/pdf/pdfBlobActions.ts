/** URL blob per anteprima PDF nel browser (revocare con `revokePdfObjectUrl`). */
export function createPdfObjectUrl(blob: Blob): string {
  const typed =
    blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' })
  return URL.createObjectURL(typed)
}

export function revokePdfObjectUrl(url: string | null | undefined): void {
  if (url) URL.revokeObjectURL(url)
}

/** Apre il PDF in una nuova scheda; ritorna false se il popup è bloccato. */
export function tryOpenPdfInNewTab(url: string): boolean {
  const win = window.open(url, '_blank', 'noopener,noreferrer')
  return win != null
}

/** Stampa immediata: apre il PDF e avvia la dialog di stampa del browser. */
export async function printPdfBlob(blob: Blob): Promise<void> {
  const url = createPdfObjectUrl(blob)
  const win = window.open(url, '_blank', 'noopener,noreferrer')
  if (!win) {
    revokePdfObjectUrl(url)
    throw new Error('Popup bloccato: consenti le finestre per stampare il PDF.')
  }
  const tryPrint = () => {
    try {
      win.focus()
      win.print()
    } catch {
      /* viewer PDF può bloccare print() finché non è pronto */
    }
  }
  window.setTimeout(tryPrint, 600)
  window.setTimeout(tryPrint, 1400)
  window.setTimeout(() => revokePdfObjectUrl(url), 120_000)
}
