import { TIPO_PZ, findPmaById, isPazienteCodiceMinore, listaPmaImpostazioni } from './pmaModule';

/** Valore `<select>`: PMA clinico. */
export const PMA_DEST_SELECT_PREFIX = '__cross_pma__:';
/** Valore `<select>`: PMA percorso codice minore (astanteria). */
export const PMA_CODICE_MINORE_DEST_SELECT_PREFIX = '__cross_pma_cm__:';

export function encodePmaDestinazioneSelectValue(pmaId, { codiceMinore = false } = {}) {
  const id = String(pmaId ?? '').trim();
  if (!id) return '';
  return codiceMinore ? `${PMA_CODICE_MINORE_DEST_SELECT_PREFIX}${id}` : `${PMA_DEST_SELECT_PREFIX}${id}`;
}

export function decodePmaDestinazioneSelectValue(rawValue) {
  const value = String(rawValue ?? '').trim();
  if (!value) return null;
  if (value.startsWith(PMA_CODICE_MINORE_DEST_SELECT_PREFIX)) {
    return {
      pmaId: value.slice(PMA_CODICE_MINORE_DEST_SELECT_PREFIX.length),
      percorsoCodiceMinore: true,
    };
  }
  if (value.startsWith(PMA_DEST_SELECT_PREFIX)) {
    return {
      pmaId: value.slice(PMA_DEST_SELECT_PREFIX.length),
      percorsoCodiceMinore: false,
    };
  }
  return null;
}

/** Opzioni destinazione trasporto (ospedali + PMA / PMA codice minore). */
export function buildDestinazioneTrasportoSelectOptions(impostazioni) {
  const ospedali = (impostazioni?.listaOspedali ?? [])
    .map((s) => String(s).trim())
    .filter(Boolean);
  const pmaList = listaPmaImpostazioni(impostazioni);
  return { ospedali, pmaList };
}

/**
 * Risolve valore `<select>` → campi Firestore destinazione.
 * @returns {{ ospedaleDestinazione: string, destinazionePmaId: string, pmaId: string, percorsoCodiceMinore: boolean, statoPzPma: null | string }}
 */
export function resolveDestinazioneTrasportoSelect(rawValue, impostazioni) {
  const value = String(rawValue ?? '').trim();
  if (!value) {
    return {
      ospedaleDestinazione: '',
      destinazionePmaId: '',
      pmaId: '',
      percorsoCodiceMinore: false,
      statoPzPma: null,
    };
  }

  const decoded = decodePmaDestinazioneSelectValue(value);
  if (decoded?.pmaId) {
    const pma = findPmaById(impostazioni, decoded.pmaId);
    if (!pma) {
      throw new Error('PMA di destinazione non trovato nelle impostazioni.');
    }
    return {
      ospedaleDestinazione: pma.nome,
      destinazionePmaId: pma.id,
      pmaId: pma.id,
      percorsoCodiceMinore: decoded.percorsoCodiceMinore,
      statoPzPma: null,
    };
  }

  const pmaByNome = listaPmaImpostazioni(impostazioni).find(
    (p) => p.nome.toLowerCase() === value.toLowerCase(),
  );
  if (pmaByNome) {
    return {
      ospedaleDestinazione: pmaByNome.nome,
      destinazionePmaId: pmaByNome.id,
      pmaId: pmaByNome.id,
      percorsoCodiceMinore: false,
      statoPzPma: null,
    };
  }

  return {
    ospedaleDestinazione: value,
    destinazionePmaId: '',
    pmaId: '',
    percorsoCodiceMinore: false,
    statoPzPma: null,
  };
}

/** Paziente trasportato verso PMA astanteria (centrale o nativo desk). */
export function isPercorsoCodiceMinoreTrasporto(paziente) {
  if (!paziente) return false;
  if (paziente.percorsoCodiceMinore === true) return true;
  if (!isPazienteCodiceMinore(paziente)) return false;
  return Boolean(
    String(paziente.eventoCorrelato ?? '').trim() ||
      String(paziente.eventoIdUnivoco ?? '').trim() ||
      String(paziente.mezzo ?? '').trim(),
  );
}

/** Valore corrente per `<select>` destinazione trasporto. */
export function destinazioneTrasportoSelectValue(pazienteOrDraft, impostazioni) {
  if (!pazienteOrDraft) return '';
  const pmaId = String(pazienteOrDraft.destinazionePmaId ?? '').trim();
  if (pmaId) {
    const codiceMinore =
      pazienteOrDraft.percorsoCodiceMinore === true || isPercorsoCodiceMinoreTrasporto(pazienteOrDraft);
    return encodePmaDestinazioneSelectValue(pmaId, { codiceMinore });
  }
  return String(pazienteOrDraft.ospedaleDestinazione ?? '').trim();
}

export function labelDestinazioneTrasportoExtended(paziente, impostazioni) {
  const pmaId = String(paziente?.destinazionePmaId ?? '').trim();
  if (!pmaId) return String(paziente?.ospedaleDestinazione ?? '').trim();
  const pma = findPmaById(impostazioni, pmaId);
  const nome = pma?.nome ?? String(paziente?.ospedaleDestinazione ?? '').trim();
  if (isPercorsoCodiceMinoreTrasporto(paziente)) {
    return nome ? `PMA — ${nome} · Codice minore` : 'PMA · Codice minore';
  }
  return nome ? `PMA — ${nome}` : String(paziente?.ospedaleDestinazione ?? '').trim();
}
