/** Campo su `settings/contatori`: se true, non riallineare da elenco client (dopo «Azzera contatori»). */
export function skipIdSeedField(counterKey) {
  return `${counterKey}SkipIdSeed`;
}

export function shouldSkipIdSeedFromCounterDoc(data, counterKey) {
  if (!data || typeof data !== 'object') return false;
  return data[skipIdSeedField(counterKey)] === true;
}
