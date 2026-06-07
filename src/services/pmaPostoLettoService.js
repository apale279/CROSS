import { deleteField } from 'firebase/firestore';
import { findPmaRawEntry, normalizeStatoPzPma, STATO_PZ_PMA } from '../lib/pmaModule';
import { patchPmaPostiLettoLabels } from './impostazioniService';
import { patchPaziente } from './pazientiService';
import { prendiInCaricoPma } from './pmaStatoService';

/**
 * Assegna o rimuove posto letto. Rifiuta se il letto è già occupato da un altro paziente.
 * @param {string | null} postoLettoId — null = senza letto
 */
export async function assignPazientePostoLetto(
  manifestationId,
  patientDocId,
  postoLettoId,
  inCaricoPazienti = [],
) {
  const targetId = postoLettoId ? String(postoLettoId).trim() : '';
  const occupant = (inCaricoPazienti ?? []).find(
    (p) =>
      p._docId !== patientDocId &&
      String(p.pmaPostoLettoId ?? '').trim() === targetId &&
      targetId,
  );
  if (occupant) {
    throw new Error('Posto letto già occupato.');
  }
  if (targetId) {
    await patchPaziente(manifestationId, patientDocId, { pmaPostoLettoId: targetId });
  } else {
    await patchPaziente(manifestationId, patientDocId, { pmaPostoLettoId: deleteField() });
  }
}

/**
 * Assegna posto letto; se il paziente non è IN CARICO lo porta in carico prima (drop da sidebar o letto).
 * Il posto letto è secondario: un fallimento assegnazione non annulla la presa in carico.
 * @returns {{ ok: boolean, warning: string | null }}
 */
export async function assegnaPostoLettoConPresaInCarico(
  manifestationId,
  patientDocId,
  postoLettoId,
  paziente,
  inCaricoPazienti = [],
) {
  const stato = normalizeStatoPzPma(paziente?.statoPzPma);
  const richiedeCarico =
    stato !== STATO_PZ_PMA.IN_CARICO && stato !== STATO_PZ_PMA.DIMESSO;
  if (richiedeCarico) {
    await prendiInCaricoPma(manifestationId, patientDocId);
  }
  try {
    await assignPazientePostoLetto(manifestationId, patientDocId, postoLettoId, inCaricoPazienti);
    return { ok: true, warning: null };
  } catch (err) {
    if (richiedeCarico || stato === STATO_PZ_PMA.IN_CARICO) {
      return {
        ok: true,
        warning: err?.message ?? 'Posto letto non assegnato.',
      };
    }
    throw err;
  }
}

export async function updatePostoLettoLabel(manifestationId, pmaId, postoLettoId, label, impostazioni) {
  const entry = findPmaRawEntry(impostazioni, pmaId);
  if (!entry) {
    console.warn('[PMA desk] Rinomina letto: PMA non trovato in cache locale.');
    return { ok: false, warning: 'PMA non trovato. Riprova tra qualche secondo.' };
  }
  const trimmed = String(label ?? '').trim();
  const postiLettoLabels = { ...(entry.postiLettoLabels ?? {}) };
  if (trimmed) {
    postiLettoLabels[postoLettoId] = trimmed;
  } else {
    delete postiLettoLabels[postoLettoId];
  }
  try {
    await patchPmaPostiLettoLabels(manifestationId, pmaId, postiLettoLabels);
    return { ok: true, warning: null };
  } catch (err) {
    return { ok: false, warning: err?.message ?? 'Salvataggio nome posto letto non riuscito.' };
  }
}
