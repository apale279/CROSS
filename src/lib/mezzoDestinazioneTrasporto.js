import { ESITO_TRASPORTA } from '../constants';
import { findPmaById, resolveDestinazionePaziente } from './pmaModule';
import { pazientiPerEvento } from './eventoLinks';
import { normalizeMezzoKey, sameMezzoSigla } from './mezzoMissione';

/** Etichetta destinazione per UI (ospedale o PMA). */
export function labelDestinazioneTrasporto(paziente, impostazioni) {
  if (!paziente) return '';
  const pmaId = String(paziente.destinazionePmaId ?? '').trim();
  if (pmaId) {
    const pma = findPmaById(impostazioni, pmaId);
    return pma?.nome ? `PMA — ${pma.nome}` : String(paziente.ospedaleDestinazione ?? '').trim();
  }
  return String(paziente.ospedaleDestinazione ?? '').trim();
}

export function hasDestinazioneTrasporto(paziente) {
  if (!paziente || paziente.esito !== ESITO_TRASPORTA) return false;
  return Boolean(
    String(paziente.destinazionePmaId ?? '').trim() ||
      String(paziente.ospedaleDestinazione ?? '').trim(),
  );
}

/** Chiave confronto destinazioni (PMA id o nome ospedale normalizzato). */
export function destinazioneTrasportoKey(paziente) {
  if (!paziente) return '';
  const pmaId = String(paziente.destinazionePmaId ?? '').trim();
  if (pmaId) return `pma:${pmaId.toLowerCase()}`;
  const osp = String(paziente.ospedaleDestinazione ?? '')
    .trim()
    .toLowerCase();
  return osp ? `osp:${osp}` : '';
}

export function stessaDestinazioneTrasporto(a, b) {
  const ka = destinazioneTrasportoKey(a);
  const kb = destinazioneTrasportoKey(b);
  if (!ka || !kb) return false;
  return ka === kb;
}

/**
 * Primo paziente «Trasporta» sullo stesso mezzo (stesso evento) con destinazione già impostata.
 * @param {{ pazienti: object[]; evento?: object; mezzo: string; excludeDocId?: string; impostazioni?: object }} opts
 */
export function findDestinazioneTrasportoSuMezzoEvento({
  pazienti,
  evento,
  mezzo,
  excludeDocId,
  impostazioni,
}) {
  if (!mezzo) return null;
  const list = evento ? pazientiPerEvento(pazienti, evento) : (pazienti ?? []);
  const exclude = String(excludeDocId ?? '').trim();

  for (const p of list) {
    if (exclude && p._docId === exclude) continue;
    if (p.esito !== ESITO_TRASPORTA) continue;
    if (!sameMezzoSigla(p.mezzo, mezzo)) continue;
    if (!hasDestinazioneTrasporto(p)) continue;
    return {
      ospedaleDestinazione: p.ospedaleDestinazione ?? '',
      destinazionePmaId: p.destinazionePmaId ?? '',
      pmaId: p.pmaId ?? p.destinazionePmaId ?? '',
      label: labelDestinazioneTrasporto(p, impostazioni),
      pazienteId: p.idPaziente ?? '',
    };
  }
  return null;
}

/** Blocca destinazione diversa da quella già fissata sul mezzo. */
export function validateDestinazionePerMezzo({
  mezzo,
  nomeSelezionato,
  pazienti,
  evento,
  excludeDocId,
  impostazioni,
}) {
  if (!mezzo || !String(nomeSelezionato ?? '').trim()) {
    return { ok: true };
  }

  const ref = findDestinazioneTrasportoSuMezzoEvento({
    pazienti,
    evento,
    mezzo,
    excludeDocId,
    impostazioni,
  });
  if (!ref) return { ok: true };

  const proposed = resolveDestinazionePaziente(nomeSelezionato, impostazioni);
  const proposedKey = destinazioneTrasportoKey({
    esito: ESITO_TRASPORTA,
    ospedaleDestinazione: proposed.ospedaleDestinazione,
    destinazionePmaId: proposed.destinazionePmaId,
  });
  const refKey = destinazioneTrasportoKey({
    esito: ESITO_TRASPORTA,
    ospedaleDestinazione: ref.ospedaleDestinazione,
    destinazionePmaId: ref.destinazionePmaId,
  });

  if (proposedKey && refKey && proposedKey === refKey) {
    return { ok: true, ref };
  }

  return {
    ok: false,
    ref,
    message:
      `Il mezzo ${mezzo} ha già destinazione «${ref.label}»` +
      (ref.pazienteId ? ` (paziente ${ref.pazienteId})` : '') +
      '. Tutti i pazienti sullo stesso mezzo devono andare nella stessa destinazione.',
  };
}

/** Mappa sigla mezzo → etichetta destinazione già fissata (per menu a tendina). */
export function mapDestinazionePerMezzoEvento({
  mezziSigle,
  pazienti,
  evento,
  excludeDocId,
  impostazioni,
}) {
  const map = new Map();
  for (const sigla of mezziSigle ?? []) {
    const ref = findDestinazioneTrasportoSuMezzoEvento({
      pazienti,
      evento,
      mezzo: sigla,
      excludeDocId,
      impostazioni,
    });
    if (ref?.label) {
      map.set(normalizeMezzoKey(sigla), ref.label);
    }
  }
  return map;
}
