import { usePmaMobile } from './usePmaMobile'

/** Layout compatto smartphone in cartella clinica (tutti i profili PMA su viewport stretta). */
export function useInfermiereSmartphone(_user: unknown): boolean {
  return usePmaMobile()
}
