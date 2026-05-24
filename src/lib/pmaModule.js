/** Tipo origine paziente (campo Firestore `tipoPz`, non mostrato in UI centrale). */
export const TIPO_PZ = {
  CENTRALE: 'CENTRALE',
  PMA: 'PMA',
};

/** Stato operativo lato PMA (campo Firestore `statoPzPma`). */
export const STATO_PZ_PMA = {
  IN_ARRIVO: 'IN ARRIVO',
  IN_ATTESA: 'IN ATTESA',
  IN_CARICO: 'in carico',
  DIMESSO: 'DIMESSO',
};

export const STATO_PZ_PMA_LABEL = {
  [STATO_PZ_PMA.IN_ARRIVO]: 'In arrivo',
  [STATO_PZ_PMA.IN_ATTESA]: 'In attesa',
  [STATO_PZ_PMA.IN_CARICO]: 'In carico',
  [STATO_PZ_PMA.DIMESSO]: 'Dimesso',
};

/** Stati PMA in cui il paziente è considerato «aperto» per il modulo PMA. */
export const STATI_PZ_PMA_APERTI = [
  STATO_PZ_PMA.IN_ARRIVO,
  STATO_PZ_PMA.IN_ATTESA,
  STATO_PZ_PMA.IN_CARICO,
];

export function normalizeTipoPz(value) {
  const v = String(value ?? '').trim().toUpperCase();
  if (v === TIPO_PZ.PMA) return TIPO_PZ.PMA;
  return TIPO_PZ.CENTRALE;
}

export function normalizeStatoPzPma(value) {
  const v = String(value ?? '').trim();
  if (v === STATO_PZ_PMA.IN_ARRIVO) return STATO_PZ_PMA.IN_ARRIVO;
  if (v === STATO_PZ_PMA.IN_ATTESA) return STATO_PZ_PMA.IN_ATTESA;
  if (v === STATO_PZ_PMA.IN_CARICO) return STATO_PZ_PMA.IN_CARICO;
  if (v === STATO_PZ_PMA.DIMESSO) return STATO_PZ_PMA.DIMESSO;
  return null;
}

export function statoPzPmaLabel(stato) {
  const n = normalizeStatoPzPma(stato);
  if (!n) return null;
  return STATO_PZ_PMA_LABEL[n] ?? n;
}

/** Paziente con scheda PMA (inviato da centrale o autopresentato). */
export function pazienteHaSchedaPma(paziente) {
  if (!paziente) return false;
  if (normalizeTipoPz(paziente.tipoPz) === TIPO_PZ.PMA) return true;
  return pazienteHaDestinazionePma(paziente);
}

export function pazientePmaAperto(paziente) {
  const stato = normalizeStatoPzPma(paziente?.statoPzPma);
  return stato != null && STATI_PZ_PMA_APERTI.includes(stato);
}

export function pazientePmaChiuso(paziente) {
  return normalizeStatoPzPma(paziente?.statoPzPma) === STATO_PZ_PMA.DIMESSO;
}

export function isPazienteOriginePma(paziente) {
  return normalizeTipoPz(paziente?.tipoPz) === TIPO_PZ.PMA;
}

/** Scheda PMA consultabile (qualsiasi paziente con modulo PMA). */
export function canViewPmaScheda(paziente) {
  return pazienteHaSchedaPma(paziente);
}

/** Modifica cartella/dimissione PMA. */
export function canEditPmaSchedaDoc(paziente) {
  return normalizeStatoPzPma(paziente?.statoPzPma) === STATO_PZ_PMA.IN_CARICO;
}

/** Colonna «Stato» in elenco pazienti. */
export { displayStatoPazienteInLista } from './pazienteStati';

/** Colonna «Evento» in elenco per autopresentati (nessun evento operativo collegato). */
export function displayEventoPazienteInLista(paziente, evento) {
  if (isPazienteOriginePma(paziente)) {
    const scheda = paziente.pmaScheda ?? {};
    const tipo = scheda.tipo_evento ?? '';
    const det = scheda.dettaglio_evento ?? '';
    if (tipo && det) return `${tipo} — ${det}`;
    if (tipo) return tipo;
    return 'Autopresentato PMA';
  }
  return evento?.idEvento ?? paziente?.eventoCorrelato ?? '—';
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
      pmaId: '',
      statoPzPma: null,
    };
  }
  const pma = findPmaByNome(impostazioni, nome);
  if (pma) {
    return {
      ospedaleDestinazione: pma.nome,
      destinazionePmaId: pma.id,
      pmaId: pma.id,
      statoPzPma: null,
    };
  }
  return {
    ospedaleDestinazione: nome,
    destinazionePmaId: '',
    pmaId: '',
    statoPzPma: null,
  };
}

export function pazienteHaDestinazionePma(paziente) {
  return Boolean(String(paziente?.destinazionePmaId ?? '').trim());
}

/** Visibile nella dashboard PMA (esclusi i dimessi). */
export function pazienteVisibileInPmaDesk(paziente, pmaId) {
  const pid = String(pmaId ?? '').trim();
  if (!pid || !paziente) return false;

  const stato = normalizeStatoPzPma(paziente.statoPzPma);
  if (stato === STATO_PZ_PMA.DIMESSO) return false;

  if (normalizeTipoPz(paziente.tipoPz) === TIPO_PZ.PMA) {
    return String(paziente.pmaId ?? '').trim() === pid;
  }

  if (String(paziente.destinazionePmaId ?? '').trim() !== pid) return false;
  return stato != null && STATI_PZ_PMA_APERTI.includes(stato);
}

export function pmaIdPerPaziente(paziente) {
  return String(paziente?.pmaId ?? paziente?.destinazionePmaId ?? '').trim();
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
