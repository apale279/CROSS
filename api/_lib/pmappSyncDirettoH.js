import { FieldValue, getAdminDb } from './firebaseAdmin.js';
import { getPmappIntegrationSettings } from './pmappIntegration.js';
import { getMissioneById } from './missionAdmin.js';

const ESITO_TRASPORTA = 'Trasporta';

function crossPazientiCol(tenantId) {
  return getAdminDb().collection('manifestazioni').doc(tenantId).collection('pazienti');
}

function pmappPazientiCol() {
  return getAdminDb().collection('pazienti');
}

/** CROSS colore evento/missione → codice trasporto PMApp. */
export function crossColoreToInvioPsCodice(colore) {
  const c = String(colore ?? '').trim().toLowerCase();
  if (c === 'rosso') return 'rosso';
  if (c === 'giallo') return 'giallo';
  if (c === 'verde' || c === 'bianco') return 'verde';
  return null;
}

async function findPmappPazienteDoc(pmappManifestazioneId, crossPaziente) {
  const col = pmappPazientiCol();
  const pettorale = crossPaziente.pettorale;
  if (pettorale != null && Number.isFinite(Number(pettorale))) {
    const n = Math.trunc(Number(pettorale));
    const byBib = await col
      .where('id_manifestazione', '==', pmappManifestazioneId)
      .where('pettorale', '==', n)
      .limit(3)
      .get();
    if (!byBib.empty) return byBib.docs[0];
  }

  const idUnivoco = String(crossPaziente.idUnivoco ?? '').trim();
  if (idUnivoco) {
    const byExt = await col
      .where('id_manifestazione', '==', pmappManifestazioneId)
      .where('external_app_id', '==', idUnivoco)
      .limit(3)
      .get();
    if (!byExt.empty) return byExt.docs[0];
  }

  return null;
}

function buildPmappInvioPsPatch(missione, crossPaziente, eventoColore) {
  const codice = crossColoreToInvioPsCodice(
    missione.codiceColore ?? eventoColore ?? crossPaziente.codice_colore,
  );
  const noteParts = [
    `Sync CROSS — missione ${missione.idMissione ?? '—'}`,
    missione.eventoCorrelato ? `evento ${missione.eventoCorrelato}` : '',
  ].filter(Boolean);

  const patch = {
    dimissione_esito: 'invio_ps',
    invio_ps_mezzo: missione.mezzo ?? '',
    invio_ps_ospedale: String(crossPaziente.ospedaleDestinazione ?? '').trim(),
    invio_ps_data_ora: FieldValue.serverTimestamp(),
    invio_ps_note: noteParts.join(' · '),
    external_app_id: crossPaziente.idUnivoco ?? '',
    external_source: 'CROSS',
    external_sync_at: FieldValue.serverTimestamp(),
  };

  if (codice) patch.invio_ps_codice_trasporto = codice;
  return patch;
}

async function loadEventoColore(tenantId, missione) {
  const eventiCol = getAdminDb().collection('manifestazioni').doc(tenantId).collection('eventi');
  if (missione.eventoIdUnivoco) {
    const snap = await eventiCol.where('idUnivoco', '==', missione.eventoIdUnivoco).limit(1).get();
    if (!snap.empty) return snap.docs[0].data()?.colore ?? null;
  }
  if (missione.eventoCorrelato) {
    const snap = await eventiCol.where('idEvento', '==', missione.eventoCorrelato).limit(1).get();
    if (!snap.empty) return snap.docs[0].data()?.colore ?? null;
  }
  return null;
}

/**
 * Allinea PMApp (invio PS) quando la missione CROSS passa a DIRETTO H.
 * @returns {Promise<{ synced: number, skipped: number, errors?: { idPaziente: string, message: string }[] }>}
 */
export async function syncPmappOnDirettoH(tenantId, missionDocId) {
  const { enabled, pmappManifestazioneId } = await getPmappIntegrationSettings(tenantId);
  if (!enabled) return { synced: 0, skipped: 0, reason: 'integration_disabled' };
  if (!pmappManifestazioneId) {
    return { synced: 0, skipped: 0, reason: 'pmapp_manifestazione_id_missing' };
  }

  const missione = await getMissioneById(tenantId, missionDocId);
  if (!missione) return { synced: 0, skipped: 0, reason: 'mission_not_found' };
  if ((missione.stato ?? '') !== 'DIRETTO H') {
    return { synced: 0, skipped: 0, reason: 'mission_not_diretto_h', stato: missione.stato };
  }
  if (!missione.mezzo) return { synced: 0, skipped: 0, reason: 'no_mezzo' };

  const eventoColore = await loadEventoColore(tenantId, missione);
  const pazSnap = await crossPazientiCol(tenantId).get();

  let synced = 0;
  let skipped = 0;
  const errors = [];

  for (const docSnap of pazSnap.docs) {
    const p = { _docId: docSnap.id, ...docSnap.data() };
    const sameEvento =
      (missione.eventoIdUnivoco && p.eventoIdUnivoco === missione.eventoIdUnivoco) ||
      p.eventoCorrelato === missione.eventoCorrelato;
    if (!sameEvento || p.mezzo !== missione.mezzo || p.esito !== ESITO_TRASPORTA) {
      continue;
    }

    try {
      const pmappDoc = await findPmappPazienteDoc(pmappManifestazioneId, p);
      if (!pmappDoc) {
        skipped += 1;
        continue;
      }
      await pmappDoc.ref.update(buildPmappInvioPsPatch(missione, p, eventoColore));
      synced += 1;
    } catch (e) {
      errors.push({
        idPaziente: p.idPaziente ?? docSnap.id,
        message: e.message ?? String(e),
      });
    }
  }

  return {
    synced,
    skipped,
    pmappManifestazioneId,
    errors: errors.length ? errors : undefined,
  };
}
