/** Nome paziente per elenco PMA: cognome e nome (pettorale solo in badge). */
export function displayNomePazientePma(paziente) {
  const nomeCognome = [paziente?.cognome, paziente?.nome].filter(Boolean).join(' ').trim();
  return nomeCognome || 'Senza nome';
}
