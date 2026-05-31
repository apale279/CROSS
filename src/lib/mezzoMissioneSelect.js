import { normalizeMezzoKey } from './mezzoMissione';

/** Valore `<select>` mezzo+missione quando la stessa sigla è su più missioni aperte. */
export const MEZZO_MISSION_SELECT_PREFIX = '__cross_mm__:';

export function encodeMezzoMissioneSelect(missioneIdUnivoco, mezzo) {
  const uid = String(missioneIdUnivoco ?? '').trim();
  const sigla = String(mezzo ?? '').trim();
  if (!uid || !sigla) return sigla;
  return `${MEZZO_MISSION_SELECT_PREFIX}${uid}|${sigla}`;
}

export function decodeMezzoMissioneSelect(rawValue, missioni = []) {
  const value = String(rawValue ?? '').trim();
  if (!value) return { mezzo: '', missione: null };
  if (!value.startsWith(MEZZO_MISSION_SELECT_PREFIX)) {
    return { mezzo: value, missione: null };
  }
  const rest = value.slice(MEZZO_MISSION_SELECT_PREFIX.length);
  const sep = rest.indexOf('|');
  if (sep <= 0) return { mezzo: value, missione: null };
  const uid = rest.slice(0, sep);
  const mezzo = rest.slice(sep + 1);
  const missione =
    (missioni ?? []).find((m) => String(m.idUnivoco ?? '').trim() === uid) ?? null;
  return { mezzo, missione };
}

/** Valore corrente per `<select>` mezzo (allineato alle option encode). */
export function mezzoMissioneSelectValue(draftOrPatient, missioni = []) {
  const mezzo = String(draftOrPatient?.mezzo ?? '').trim();
  if (!mezzo) return '';
  let uid = String(draftOrPatient?.missioneIdUnivoco ?? '').trim();
  if (!uid) {
    const idMissione = String(draftOrPatient?.idMissione ?? '').trim();
    if (idMissione) {
      const hit = (missioni ?? []).find(
        (m) =>
          m.aperta !== false &&
          m.mezzo &&
          String(m.idMissione ?? '').trim() === idMissione &&
          normalizeMezzoKey(m.mezzo) === normalizeMezzoKey(mezzo),
      );
      uid = String(hit?.idUnivoco ?? '').trim();
    }
  }
  if (uid) return encodeMezzoMissioneSelect(uid, mezzo);
  return mezzo;
}
