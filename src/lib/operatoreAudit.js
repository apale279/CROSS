import { formatTimestamp } from '../utils/formatters';

/** Campi audit immutabili (solo create, mai patch). */
export const OPERATORE_CREATO_FIELD_KEYS = [
  'creatoDaUid',
  'creatoDaNomeUtente',
  'creatoDaNome',
];

/** Campi audit da includere nel payload di create evento/missione. */
export function operatoreCreatoFields(user, profile) {
  if (!user?.uid) return {};
  const nomeUtente = String(profile?.nomeUtente ?? '').trim();
  const nome = String(profile?.nome ?? user.displayName ?? '').trim();
  return {
    creatoDaUid: user.uid,
    ...(nomeUtente ? { creatoDaNomeUtente: nomeUtente } : {}),
    ...(nome ? { creatoDaNome: nome } : {}),
  };
}

/** Etichetta compatta per dashboard (@username o nome). */
export function operatoreUserLabel(doc) {
  const nomeUtente = String(doc?.creatoDaNomeUtente ?? '').trim();
  if (nomeUtente) return `@${nomeUtente}`;
  const nome = String(doc?.creatoDaNome ?? '').trim();
  return nome || '—';
}

/** Riga scheda: «Creato da @user · data/ora» (fallback su sola apertura). */
export function operatoreCreatoLine(doc) {
  const user = operatoreUserLabel(doc);
  const when = formatTimestamp(doc?.apertura);
  if (user !== '—' && when !== '—') return `Creato da ${user} · ${when}`;
  if (when !== '—') return when;
  if (user !== '—') return `Creato da ${user}`;
  return '—';
}

export function mergeOperatoreCreatoPayload(payload = {}) {
  const out = {};
  if (payload.creatoDaUid) out.creatoDaUid = payload.creatoDaUid;
  const nomeUtente = String(payload.creatoDaNomeUtente ?? '').trim();
  if (nomeUtente) out.creatoDaNomeUtente = nomeUtente;
  const nome = String(payload.creatoDaNome ?? '').trim();
  if (nome) out.creatoDaNome = nome;
  return out;
}

/**
 * Rimuove campi audit da patch evento/missione (write-once alla creazione).
 * Evita sovrascritture accidentali se un payload include l'intero documento.
 */
export function stripOperatoreCreatoFromPatch(fields) {
  if (!fields || typeof fields !== 'object') return fields;
  let stripped = false;
  const out = { ...fields };
  for (const key of OPERATORE_CREATO_FIELD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      delete out[key];
      stripped = true;
    }
  }
  return stripped ? out : fields;
}
