import { ESITO_TRASPORTA } from '../constants';
import { findPmaById } from './pmaModule';
import {
  labelDestinazioneTrasportoExtended,
  resolveDestinazioneTrasportoSelect,
} from './pmaDestinazioneTrasporto';
import { pazientiPerEvento } from './eventoLinks';
import { normalizeMezzoKey, sameMezzoSigla } from './mezzoMissione';

/** Etichetta destinazione per UI (ospedale o PMA). */
export function labelDestinazioneTrasporto(paziente, impostazioni) {
  return labelDestinazioneTrasportoExtended(paziente, impostazioni);
}

export function hasDestinazioneTrasporto(paziente) {
  if (!paziente || paziente.esito !== ESITO_TRASPORTA) return false;
  return Boolean(
    String(paziente.destinazionePmaId ?? '').trim() ||
      String(paziente.ospedaleDestinazione ?? '').trim(),
  );
}

/** Chiave confronto destinazioni (PMA id + percorso, oppure ospedale). */
export function destinazioneTrasportoKey(paziente) {
  if (!paziente) return '';
  const pmaId = String(paziente.destinazionePmaId ?? '').trim();
  if (pmaId) {
    const suffix = paziente.percorsoCodiceMinore === true ? ':cm' : ':cl';
    return `pma:${pmaId.toLowerCase()}${suffix}`;
  }
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

/** Stesso ingaggio missione (non solo stessa sigla mezzo sull’evento). */
export function pazienteStessaMissioneTrasporto(paziente, missione) {
  if (!missione || !paziente) return false;
  const mUid = String(missione.idUnivoco ?? missione.missioneIdUnivoco ?? '').trim();
  const pUid = String(paziente.missioneIdUnivoco ?? '').trim();
  if (mUid && pUid) return mUid === pUid;
  const mId = String(missione.idMissione ?? '').trim();
  const pId = String(paziente.idMissione ?? '').trim();
  if (mId && pId) return mId === pId;
  return false;
}

/**
 * Primo paziente «Trasporta» sulla stessa missione/mezzo con destinazione già impostata.
 * @param {{ pazienti: object[]; evento?: object; mezzo: string; missione?: object; excludeDocId?: string; impostazioni?: object }} opts
 */
export function findDestinazioneTrasportoSuMezzoEvento({
  pazienti,
  evento,
  mezzo,
  missione = null,
  excludeDocId,
  impostazioni,
}) {
  if (!mezzo) return null;
  const list = evento ? pazientiPerEvento(pazienti, evento) : (pazienti ?? []);
  const exclude = String(excludeDocId ?? '').trim();

  for (const p of list) {
    if (exclude && p._docId === exclude) continue;
    if (p.esito !== ESITO_TRASPORTA) continue;
    if (missione) {
      if (!pazienteStessaMissioneTrasporto(p, missione)) continue;
    } else if (!sameMezzoSigla(p.mezzo, mezzo)) {
      continue;
    }
    if (!hasDestinazioneTrasporto(p)) continue;
    return {
      ospedaleDestinazione: p.ospedaleDestinazione ?? '',
      destinazionePmaId: p.destinazionePmaId ?? '',
      pmaId: p.pmaId ?? p.destinazionePmaId ?? '',
      percorsoCodiceMinore: p.percorsoCodiceMinore === true,
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
  missione = null,
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
    missione,
    excludeDocId,
    impostazioni,
  });
  if (!ref) return { ok: true };

  const proposed = resolveDestinazioneTrasportoSelect(nomeSelezionato, impostazioni);
  const proposedKey = destinazioneTrasportoKey({
    esito: ESITO_TRASPORTA,
    ospedaleDestinazione: proposed.ospedaleDestinazione,
    destinazionePmaId: proposed.destinazionePmaId,
    percorsoCodiceMinore: proposed.percorsoCodiceMinore === true,
  });
  const refKey = destinazioneTrasportoKey({
    esito: ESITO_TRASPORTA,
    ospedaleDestinazione: ref.ospedaleDestinazione,
    destinazionePmaId: ref.destinazionePmaId,
    percorsoCodiceMinore: ref.percorsoCodiceMinore === true,
  });

  if (proposedKey && refKey && proposedKey === refKey) {
    return { ok: true, ref };
  }

  return {
    ok: false,
    ref,
    message:
      `La missione ${missione?.idMissione ? `${missione.idMissione} (${mezzo})` : mezzo} ha già destinazione «${ref.label}»` +
      (ref.pazienteId ? ` (paziente ${ref.pazienteId})` : '') +
      '. Tutti i pazienti sulla stessa missione devono andare nella stessa destinazione.',
  };
}

/** Mappa opzione mezzo/missione → etichetta destinazione già fissata (per menu a tendina). */
export function mapDestinazionePerMezzoEvento({
  mezzoOptions,
  pazienti,
  evento,
  excludeDocId,
  impostazioni,
}) {
  const map = new Map();
  for (const opt of mezzoOptions ?? []) {
    const ref = findDestinazioneTrasportoSuMezzoEvento({
      pazienti,
      evento,
      mezzo: opt.mezzo,
      missione: opt.missione ?? null,
      excludeDocId,
      impostazioni,
    });
    if (ref?.label) {
      const key = String(opt.missioneIdUnivoco ?? opt.mezzo ?? '').trim()
        ? `${normalizeMezzoKey(opt.mezzo)}:${opt.missioneIdUnivoco ?? opt.idMissione ?? ''}`
        : normalizeMezzoKey(opt.mezzo);
      map.set(key, ref.label);
    }
  }
  return map;
}
