/** Mezzo escluso dalla pila / assegnazione sulla mappa tattica (solo supporto esterno). */
export function isMezzoAssegnabileMappaTattica(mezzo) {
  return mezzo?.solamente_esterno !== true;
}

export function filterMezziMappaTattica(mezzi) {
  return (mezzi ?? []).filter(isMezzoAssegnabileMappaTattica);
}
