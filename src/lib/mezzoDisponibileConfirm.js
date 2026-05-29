import { MEZZO_STATO_DISPONIBILE } from './mezzoStati';
import { missioniAperteSuMezzo } from './mezzoMissione';

/** Conferma liberazione mezzo: chiude le missioni aperte collegate. */
export function confirmMezzoDisponibileLiberaMissioni(missioni, sigla, statoMezzo) {
  if (statoMezzo !== MEZZO_STATO_DISPONIBILE) return true;
  const aperte = missioniAperteSuMezzo(missioni, sigla);
  if (!aperte.length) return true;
  const ids = aperte.map((m) => m.idMissione ?? '—').join(', ');
  return window.confirm(
    `Il mezzo ${sigla} ha ${aperte.length} missione/i aperta/e (${ids}). ` +
      'Impostandolo DISPONIBILE le missioni verranno chiuse in FINE MISSIONE. Continuare?',
  );
}
