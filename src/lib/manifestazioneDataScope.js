import { IS_SUPERADMIN } from '../constants';
import {
  effectivePmaScopeId,
  isPazienteCodiceMinore,
  isPazienteOriginePma,
  pazienteDimessoInPmaDesk,
  pazienteVisibileInPmaDesk,
  userHasFullCentraleAccess,
} from './pmaModule';

function pazienteAppartienePma(paziente, pmaId) {
  const pid = String(pmaId ?? '').trim();
  if (!pid || !paziente) return false;
  if (isPazienteCodiceMinore(paziente)) {
    return String(paziente.pmaId ?? '').trim() === pid;
  }
  if (isPazienteOriginePma(paziente)) {
    return String(paziente.pmaId ?? '').trim() === pid;
  }
  return (
    pazienteVisibileInPmaDesk(paziente, pid) || pazienteDimessoInPmaDesk(paziente, pid)
  );
}

/**
 * Limita eventi/missioni/mezzi/pazienti per operatore PMA con `pmaScopeId`.
 * Centrale e superadmin vedono tutto (nessun filtro).
 */
export function filterManifestazioneDataForProfile(data, profile) {
  if (!data) return data;
  if (userHasFullCentraleAccess(profile, IS_SUPERADMIN)) return data;

  const scopeId = effectivePmaScopeId(profile, false);
  if (!scopeId) return data;

  const pazienti = (data.pazienti ?? []).filter((p) => pazienteAppartienePma(p, scopeId));

  const eventoKeys = new Set();
  for (const p of pazienti) {
    if (p.eventoIdUnivoco) eventoKeys.add(p.eventoIdUnivoco);
    if (p.eventoCorrelato) eventoKeys.add(p.eventoCorrelato);
  }

  const eventi = (data.eventi ?? []).filter(
    (e) => eventoKeys.has(e.idUnivoco) || eventoKeys.has(e.idEvento),
  );

  const eventoUnivoci = new Set(eventi.map((e) => e.idUnivoco).filter(Boolean));
  const eventoDisplay = new Set(eventi.map((e) => e.idEvento).filter(Boolean));

  const missioni = (data.missioni ?? []).filter(
    (m) =>
      (m.eventoIdUnivoco && eventoUnivoci.has(m.eventoIdUnivoco)) ||
      (m.eventoCorrelato && eventoDisplay.has(m.eventoCorrelato)),
  );

  const mezzoKeys = new Set();
  for (const m of missioni) {
    if (m.mezzo) mezzoKeys.add(String(m.mezzo).trim().toLowerCase().replace(/_/g, ''));
  }

  const mezzi = (data.mezzi ?? []).filter((mz) => {
    const sigla = String(mz.sigla ?? mz._docId ?? '').trim();
    if (!sigla) return false;
    const nk = sigla.toLowerCase().replace(/_/g, '');
    return mezzoKeys.has(nk);
  });

  return {
    ...data,
    pazienti,
    eventi,
    missioni,
    mezzi,
    noteDiario: data.noteDiario ?? [],
  };
}
