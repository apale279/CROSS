import { isPercorsoCodiceMinoreTrasporto } from './pmaDestinazioneTrasporto';

/** Sigla mezzo normalizzata per etichetta (senza spazi). */
export function siglaMezzoCodiceMinoreLabel(mezzo) {
  return String(mezzo ?? '')
    .trim()
    .replace(/\s+/g, '');
}

/**
 * Nome segnaposto per codice minore da trasporto centrale senza anagrafica.
 * Es. mezzo BRAVO_1 + id P42 → `BRAVO_1_P42`
 */
export function buildCodiceMinoreTrasportoNome({ mezzo, idPaziente } = {}) {
  const sigla = siglaMezzoCodiceMinoreLabel(mezzo);
  const id = String(idPaziente ?? '').trim();
  if (sigla && id) return `${sigla}_${id}`;
  if (id) return id;
  return 'Codice minore';
}

export function shouldAutoNomeCodiceMinoreTrasporto(paziente) {
  if (!isPercorsoCodiceMinoreTrasporto(paziente)) return false;
  return !String(paziente?.nome ?? '').trim();
}

/** Etichetta elenco centrale / missione per paziente codice minore. */
export function displayAnagraficaCodiceMinore(paziente) {
  if (!paziente) return '—';
  const pettorale = paziente.pettorale;
  const nomeCognome = [paziente.cognome, paziente.nome].filter(Boolean).join(' ').trim();
  if (pettorale != null && pettorale !== '') {
    return nomeCognome ? `${nomeCognome} (Pett. ${pettorale})` : `Pettorale ${pettorale}`;
  }
  const nome = String(paziente.nome ?? '').trim();
  if (nome) return nome;
  return buildCodiceMinoreTrasportoNome(paziente) || paziente.idPaziente || '—';
}
