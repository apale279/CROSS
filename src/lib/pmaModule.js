/** Tipo origine paziente (campo Firestore `tipoPz`, non mostrato in UI centrale). */
export const TIPO_PZ = {
  CENTRALE: 'CENTRALE',
  PMA: 'PMA',
};

/** Stato operativo lato PMA (solo se destinazione è un PMA). */
export const STATO_PZ_PMA = {
  IN_ARRIVO: 'IN ARRIVO',
  IN_CARICO: 'in carico',
};

export const STATO_PZ_PMA_LABEL = {
  [STATO_PZ_PMA.IN_ARRIVO]: 'In arrivo',
  [STATO_PZ_PMA.IN_CARICO]: 'In carico',
};

export function normalizeTipoPz(value) {
  const v = String(value ?? '').trim().toUpperCase();
  if (v === TIPO_PZ.PMA) return TIPO_PZ.PMA;
  return TIPO_PZ.CENTRALE;
}

export function normalizeStatoPzPma(value) {
  const v = String(value ?? '').trim();
  if (v === STATO_PZ_PMA.IN_ARRIVO) return STATO_PZ_PMA.IN_ARRIVO;
  if (v === STATO_PZ_PMA.IN_CARICO) return STATO_PZ_PMA.IN_CARICO;
  return null;
}

export function listaPmaImpostazioni(impostazioni) {
  return (impostazioni?.pma ?? [])
    .map((p) => ({
      id: String(p?.id ?? '').trim(),
      nome: String(p?.nome ?? '').trim(),
      indirizzo: p?.indirizzo ?? '',
      luogo_fisico: p?.luogo_fisico ?? '',
      coordinate: p.coordinate ?? null,
    }))
    .filter((p) => p.id && p.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it', { sensitivity: 'base' }));
}

export function listaOspedaliDestinazione(impostazioni) {
  return (impostazioni?.listaOspedali ?? [])
    .map((s) => String(s).trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
}

export function findPmaById(impostazioni, pmaId) {
  const id = String(pmaId ?? '').trim();
  if (!id) return null;
  return listaPmaImpostazioni(impostazioni).find((p) => p.id === id) ?? null;
}

export function findPmaByNome(impostazioni, nome) {
  const key = String(nome ?? '').trim().toLowerCase();
  if (!key) return null;
  return listaPmaImpostazioni(impostazioni).find((p) => p.nome.toLowerCase() === key) ?? null;
}

/** Campi destinazione da salvare al cambio select ospedale/PMA. */
export function resolveDestinazionePaziente(nomeSelezionato, impostazioni) {
  const nome = String(nomeSelezionato ?? '').trim();
  if (!nome) {
    return {
      ospedaleDestinazione: '',
      destinazionePmaId: '',
      statoPzPma: null,
    };
  }
  const pma = findPmaByNome(impostazioni, nome);
  if (pma) {
    return {
      ospedaleDestinazione: pma.nome,
      destinazionePmaId: pma.id,
      statoPzPma: null,
    };
  }
  return {
    ospedaleDestinazione: nome,
    destinazionePmaId: '',
    statoPzPma: null,
  };
}

export function pazienteHaDestinazionePma(paziente) {
  return Boolean(String(paziente?.destinazionePmaId ?? '').trim());
}

export function pazienteVisibileInPmaDesk(paziente, pmaId) {
  const pid = String(pmaId ?? '').trim();
  if (!pid || !paziente) return false;

  if (normalizeTipoPz(paziente.tipoPz) === TIPO_PZ.PMA) {
    return String(paziente.pmaId ?? '').trim() === pid;
  }

  if (String(paziente.destinazionePmaId ?? '').trim() !== pid) return false;
  const stato = normalizeStatoPzPma(paziente.statoPzPma);
  return stato === STATO_PZ_PMA.IN_ARRIVO || stato === STATO_PZ_PMA.IN_CARICO;
}

export function userHasFullCentraleAccess(profile, isSuperAdmin = false) {
  if (isSuperAdmin) return true;
  if (!profile) return true;
  const tipo = String(profile.accessType ?? '')
    .trim()
    .toUpperCase();
  if (tipo === 'CENTRALE') return true;
  if (tipo === 'PMA') return false;
  return !String(profile.pmaScopeId ?? '').trim();
}

export function effectivePmaScopeId(profile, isSuperAdmin) {
  if (isSuperAdmin) return null;
  const tipo = String(profile?.accessType ?? '')
    .trim()
    .toUpperCase();
  if (tipo === 'CENTRALE') return null;
  const id = String(profile?.pmaScopeId ?? '').trim();
  return id || null;
}
