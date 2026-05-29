import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { missioniPath } from '../lib/firestorePaths';
import { fieldsChiusuraMissioneSuEventoForzato } from '../lib/eventoChiusuraMissioni';
import { missioniAperteSuMezzo } from '../lib/mezzoMissione';
import { MEZZO_STATO_DISPONIBILE } from '../lib/mezzoStati';
import { patchMissione } from './missioniService';
import { patchMezzo } from './mezziService';

/**
 * Chiude tutte le missioni aperte sul mezzo (FINE MISSIONE / chiude flag aperta).
 * Usato quando l'operatore forza il mezzo a DISPONIBILE.
 */
export async function chiudiMissioniAperteSuMezzo(manifestationId, mezzoSiglaRaw) {
  if (!manifestationId || !mezzoSiglaRaw) return 0;
  const snap = await getDocs(collection(db, ...missioniPath(manifestationId)));
  const missioni = snap.docs.map((d) => ({ _docId: d.id, ...d.data() }));
  const aperte = missioniAperteSuMezzo(missioni, mezzoSiglaRaw);
  for (const mis of aperte) {
    const fields = fieldsChiusuraMissioneSuEventoForzato(mis);
    await patchMissione(manifestationId, mis._docId, fields, mis.mezzo);
  }
  return aperte.length;
}

/** Imposta stato mezzo; se DISPONIBILE chiude prima le missioni aperte collegate. */
export async function patchMezzoStatoMezzo(manifestationId, sigla, statoMezzo) {
  if (statoMezzo === MEZZO_STATO_DISPONIBILE) {
    await chiudiMissioniAperteSuMezzo(manifestationId, sigla);
  }
  await patchMezzo(manifestationId, sigla, { statoMezzo });
}
