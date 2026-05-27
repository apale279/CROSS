import {
  isPazienteCodiceMinore,
  isPazienteOriginePma,
  normalizeStatoPzPma,
  STATO_PZ_PMA,
} from './pmaModule';
import { pazientiTrasportoPerMissione } from './pazientiTrasportoQuery';
import { pazienteEsclusoDaSyncMissione } from './pmaInvioPsMission';
import {
  playPmaAlertSound,
  startPmaAlertSoundLoop,
  stopPmaAlertSoundLoop,
  unlockPmaAlertAudio,
} from './pmaAlertSound';

export const MISSIONE_STATO_DIRETTO_H = 'DIRETTO H';

export function pmaDirettoHAlertKey(missioneDocId, pmaId) {
  return `diretto_h:${missioneDocId}:${pmaId}`;
}

export function pmaDirettoHNotifiedStorageKey(manifestationId) {
  return `cross:pma_diretto_h_notified:${manifestationId}`;
}

/** Alert DIRETTO H già mostrato/chiuso (una volta per missione+PMA). */
export function loadPmaDirettoHNotified(manifestationId) {
  try {
    const raw = sessionStorage.getItem(pmaDirettoHNotifiedStorageKey(manifestationId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function savePmaDirettoHNotified(manifestationId, keys) {
  try {
    sessionStorage.setItem(
      pmaDirettoHNotifiedStorageKey(manifestationId),
      JSON.stringify([...(keys instanceof Set ? keys : [])]),
    );
  } catch {
    /* ignore */
  }
}

export function markPmaDirettoHNotified(manifestationId, keys, alertKeys) {
  const set = keys instanceof Set ? new Set(keys) : new Set(keys ?? []);
  for (const k of alertKeys ?? []) set.add(k);
  savePmaDirettoHNotified(manifestationId, set);
  return set;
}

function pazienteDestinatoVersoPma(paziente, pmaId) {
  const pid = String(pmaId ?? '').trim();
  if (!pid || !paziente) return false;
  const dest = String(paziente.destinazionePmaId ?? '').trim();
  const pma = String(paziente.pmaId ?? '').trim();
  return dest === pid || pma === pid;
}

/** Paziente inviato dalla centrale verso un PMA, in attesa di presa in carico (come colonna desk). */
export function isPazienteInArrivoDaCentrale(paziente, pmaId) {
  if (!pazienteDestinatoVersoPma(paziente, pmaId)) return false;
  if (isPazienteOriginePma(paziente) || isPazienteCodiceMinore(paziente)) return false;
  const stato = normalizeStatoPzPma(paziente.statoPzPma);
  return stato === STATO_PZ_PMA.IN_ARRIVO || stato == null;
}

export function pazientiVersoPmaSuMissione(pazienti, missione, accessiblePmaIds) {
  const allowed = new Set(accessiblePmaIds ?? []);
  return pazientiTrasportoPerMissione(pazienti, missione).filter((p) => {
    if (pazienteEsclusoDaSyncMissione(p)) return false;
    const pmaId = String(p.destinazionePmaId ?? '').trim();
    return pmaId && allowed.has(pmaId);
  });
}

export function pazienteInArrivoLabel(paziente) {
  const id = paziente?.idPaziente ? String(paziente.idPaziente) : '';
  const nome = [paziente?.cognome, paziente?.nome].filter(Boolean).join(' ').trim();
  const pett = paziente?.pettorale != null ? `#${paziente.pettorale}` : '';
  return [id, nome, pett].filter(Boolean).join(' · ') || 'Paziente';
}

export function titoloAlertPmaArrivo() {
  return 'Mezzo in diretto verso PMA';
}

export function sottotitoloAlertPmaArrivo(alert) {
  const mezzo = String(alert?.mezzo ?? '').trim();
  return mezzo
    ? `Stato missione: ${MISSIONE_STATO_DIRETTO_H} · Mezzo ${mezzo}`
    : `Stato missione: ${MISSIONE_STATO_DIRETTO_H}`;
}

export { unlockPmaAlertAudio };

/** @deprecated Usare playPmaAlertSound da pmaAlertSound */
export function playPmaArrivoAlertSound() {
  playPmaAlertSound();
}

/** Ripete il doppio beep fino a `stopPmaArrivoAlertLoop` (ref.count con alert diario). */
export function startPmaArrivoAlertLoop() {
  unlockPmaAlertAudio();
  startPmaAlertSoundLoop();
}

export function stopPmaArrivoAlertLoop() {
  stopPmaAlertSoundLoop();
}

/** Mezzo in DIRETTO H verso PMA: un alert per PMA con tutti i pazienti sul mezzo. */
export function detectNuoviDirettoHPma(
  missionSnapDocs,
  pazienti,
  accessiblePmaIds,
  prevMissionFlags,
  primed,
  notifiedKeys,
) {
  const incoming = [];
  const nextFlags = new Map(prevMissionFlags);
  const pazientiList = (pazienti ?? []).map((p) =>
    p._docId ? p : { _docId: p.id, ...p },
  );

  for (const d of missionSnapDocs) {
    const missione = { _docId: d.id, ...d.data() };
    const key = d.id;
    const now = String(missione.stato ?? '') === MISSIONE_STATO_DIRETTO_H;
    const was = prevMissionFlags.get(key) ?? false;
    nextFlags.set(key, now);

    if (!primed) continue;
    if (!now || was) continue;

    const byPma = new Map();
    for (const p of pazientiVersoPmaSuMissione(pazientiList, missione, accessiblePmaIds)) {
      const pmaId = String(p.destinazionePmaId ?? '').trim();
      if (!byPma.has(pmaId)) byPma.set(pmaId, []);
      byPma.get(pmaId).push({ pazienteDocId: p._docId, paziente: p });
    }

    for (const [pmaId, items] of byPma) {
      if (!items.length) continue;
      const alertKey = pmaDirettoHAlertKey(d.id, pmaId);
      if (notifiedKeys?.has(alertKey)) continue;
      incoming.push({
        alertKey,
        trigger: 'diretto_h',
        pmaId,
        missioneDocId: d.id,
        mezzo: missione.mezzo ?? '',
        missioneId: missione.idMissione ?? '',
        pazienti: items,
      });
    }
  }

  return { incoming, nextFlags: nextFlags };
}
