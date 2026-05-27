/** Testo equipaggio su missione (snapshot al legame con il mezzo). */
export function formatEquipaggioText(equipaggio) {
  if (!equipaggio) return '';
  const roles = [
    ['Autista', equipaggio.autista],
    ['Medico/CE', equipaggio.medico],
    ['Soccorritore 1', equipaggio.soccorritore1],
    ['Soccorritore 2', equipaggio.soccorritore2],
  ];
  return roles
    .map(([label, p]) => {
      if (!p?.nome && !p?.cognome) return null;
      const nome = [p.nome, p.cognome].filter(Boolean).join(' ');
      const tel = p.telefono ? ` — ${p.telefono}` : '';
      return `${label}: ${nome}${tel}`;
    })
    .filter(Boolean)
    .join(' | ');
}
