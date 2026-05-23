import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ESITO_TRASPORTA } from '../constants';
import { applyMissioneArrivatoH } from '../lib/pazienteRules';
import { STATO_PZ_PMA, TIPO_PZ } from '../lib/pmaModule';
import { pazientiPath } from '../lib/firestorePaths';
import { patchPaziente } from './pazientiService';

function pazienteCollegatoAMissione(p, missione) {
  const sameEvento =
    (missione.eventoIdUnivoco && p.eventoIdUnivoco === missione.eventoIdUnivoco) ||
    p.eventoCorrelato === missione.eventoCorrelato;
  return (
    sameEvento &&
    p.mezzo === missione.mezzo &&
    p.esito === ESITO_TRASPORTA &&
    String(p.destinazionePmaId ?? '').trim()
  );
}

/** Mezzo in DIRETTO H → pazienti verso quel PMA in «IN ARRIVO» (vista PMA). */
export async function syncPazientiPmaOnDirettoH(manifestationId, missione) {
  if (!missione?.mezzo) return { updated: 0 };
  const snap = await getDocs(collection(db, ...pazientiPath(manifestationId)));
  const tasks = [];

  snap.forEach((docSnap) => {
    const p = { _docId: docSnap.id, ...docSnap.data() };
    if (!pazienteCollegatoAMissione(p, missione)) return;
    tasks.push(
      patchPaziente(manifestationId, docSnap.id, {
        tipoPz: p.tipoPz ?? TIPO_PZ.CENTRALE,
        statoPzPma: STATO_PZ_PMA.IN_ARRIVO,
      }),
    );
  });

  await Promise.all(tasks);
  return { updated: tasks.length };
}

/** Estensione sync ARRIVATO H: stato centrale + «in carico» in PMA. */
export function patchPazienteArrivatoHConPma(paziente) {
  const patch = applyMissioneArrivatoH(paziente);
  if (!patch) return null;
  let initPmaScheda = false;
  if (String(paziente.destinazionePmaId ?? '').trim()) {
    patch.statoPzPma = STATO_PZ_PMA.IN_CARICO;
    if (!paziente.pmaScheda) initPmaScheda = true;
  }
  return { patch, initPmaScheda };
}
