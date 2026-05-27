import { useEffect, useState } from 'react'

/**
 * Viewport touch PMA: smartphone e tablet in portrait (operatori tenda).
 * La centrale usa sempre PC — le ottimizzazioni `usePmaMobile` vanno abbinate a `restrictedNav`.
 */
export const PMA_MOBILE_MEDIA = '(max-width: 768px)'

function readMatches(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(PMA_MOBILE_MEDIA).matches
}

/** True su viewport stretta: layout PMA senza scroll orizzontale. */
export function usePmaMobile(): boolean {
  const [mobile, setMobile] = useState(readMatches)

  useEffect(() => {
    const mq = window.matchMedia(PMA_MOBILE_MEDIA)
    const onChange = () => setMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return mobile
}
