import { usePmaAccess } from '../../hooks/usePmaAccess'
import { usePmaMobile } from './usePmaMobile'

/** Layout touch PMA per operatori tenda (non centrale su PC). */
export function usePmaFieldUx(): boolean {
  const { restrictedNav } = usePmaAccess()
  const touch = usePmaMobile()
  return Boolean(restrictedNav && touch)
}
