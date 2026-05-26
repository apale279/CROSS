/** Colore sanitario/triage per export e report (MSB/MSA → root, altrimenti PMA). */
export function coloreSanitarioPazienteExport(paziente) {
  const san = String(paziente?.codiceColoreSanitario ?? paziente?.codiceColore ?? '').trim();
  if (san) return san;
  const raw = String(paziente?.pmaScheda?.codice_colore ?? '').trim().toLowerCase();
  const map = { bianco: 'Bianco', verde: 'Verde', giallo: 'Giallo', rosso: 'Rosso' };
  return map[raw] || raw;
}
