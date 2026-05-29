import { DEFAULT_IMPOSTAZIONI } from '../constants';
import {
  STATO_PZ_PMA,
  isPazienteCodiceMinore,
  isPazienteOriginePma,
  listaPmaImpostazioni,
  normalizeStatoPzPma,
  pazienteVisibileInPmaDesk,
  pmaIdPerPaziente,
} from './pmaModule';

const MAP_PMA_TO_EVENTO = {
  bianco: 'Bianco',
  verde: 'Verde',
  giallo: 'Giallo',
  rosso: 'Rosso',
};

export function emptyContatoriColore() {
  return Object.fromEntries(DEFAULT_IMPOSTAZIONI.coloriEvento.map((c) => [c, 0]));
}

/** Colore triage per conteggio dashboard (MSB/MSA o scheda PMA). */
export function codiceColorePazientePmaDashboard(paziente) {
  const raw = paziente?.pmaScheda?.codice_colore;
  if (raw) {
    const mapped = MAP_PMA_TO_EVENTO[String(raw).trim().toLowerCase()];
    if (mapped) return mapped;
  }
  const san = String(paziente?.codiceColoreSanitario ?? '').trim();
  if (DEFAULT_IMPOSTAZIONI.coloriEvento.includes(san)) return san;
  return null;
}

function addConteggio(contatori, colore) {
  if (colore && contatori[colore] != null) contatori[colore] += 1;
}

/** Conteggi codici minori (aperti = senza ora fine, chiusi = con ora fine). */
export function conteggiCodiciMinoriPerPma(pazienti, pmaId) {
  const rows = pazientiCodiceMinorePerPma(pazienti, pmaId);
  let aperti = 0;
  let chiusi = 0;
  for (const p of rows) {
    const cm = p?.codiceMinore ?? {};
    if (cm.oraFine != null) chiusi += 1;
    else aperti += 1;
  }
  return { aperti, chiusi, totale: rows.length };
}

/**
 * Snapshot per stazione PMA: contatori per stato (in arrivo / in attesa / in carico)
 * e per codice colore evento (Bianco, Verde, Giallo, Rosso).
 */
export function buildDashboardPmaStazioni(pazienti, impostazioni) {
  const pmaList = listaPmaImpostazioni(impostazioni);
  const byId = Object.fromEntries(
    pmaList.map((pma) => [
      pma.id,
      {
        pma,
        inArrivo: emptyContatoriColore(),
        inAttesa: emptyContatoriColore(),
        inCarico: emptyContatoriColore(),
        totali: { inArrivo: 0, inAttesa: 0, inCarico: 0, totale: 0 },
        codiciMinori: conteggiCodiciMinoriPerPma(pazienti, pma.id),
      },
    ]),
  );

  for (const p of pazienti ?? []) {
    if (isPazienteCodiceMinore(p)) continue;
    const pid =
      pmaIdPerPaziente(p) ||
      (isPazienteOriginePma(p) ? String(p.pmaId ?? '').trim() : '') ||
      String(p.destinazionePmaId ?? '').trim();
    if (!pid || !byId[pid]) continue;
    if (!pazienteVisibileInPmaDesk(p, pid)) continue;

    const stato = normalizeStatoPzPma(p.statoPzPma);
    const row = byId[pid];
    const col = codiceColorePazientePmaDashboard(p);

    if (stato === STATO_PZ_PMA.IN_ARRIVO) {
      row.totali.inArrivo += 1;
      addConteggio(row.inArrivo, col);
    } else if (stato === STATO_PZ_PMA.IN_ATTESA) {
      row.totali.inAttesa += 1;
      addConteggio(row.inAttesa, col);
    } else if (stato === STATO_PZ_PMA.IN_CARICO) {
      row.totali.inCarico += 1;
      addConteggio(row.inCarico, col);
    }
    row.totali.totale =
      row.totali.inArrivo + row.totali.inAttesa + row.totali.inCarico;
  }

  return pmaList
    .map((pma) => byId[pma.id])
    .sort((a, b) => {
      if (b.totali.totale !== a.totali.totale) return b.totali.totale - a.totali.totale;
      return a.pma.nome.localeCompare(b.pma.nome, 'it', { sensitivity: 'base' });
    });
}

export function totalePazientiPmaDashboard(stazioni) {
  return (stazioni ?? []).reduce((s, row) => s + row.totali.totale, 0);
}
