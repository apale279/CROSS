/** Nome paziente per elenco PMA: cognome nome + pettorale se presente. */
export function displayNomePazientePma(paziente) {
  const nomeCognome = [paziente?.cognome, paziente?.nome].filter(Boolean).join(' ').trim();
  const pett = paziente?.pettorale;
  if (pett != null && String(pett).trim() !== '') {
    const pettLabel = `(Pett. ${pett})`;
    return nomeCognome ? `${nomeCognome} ${pettLabel}` : `Pettorale ${pett}`;
  }
  return nomeCognome || 'Senza nome';
}
