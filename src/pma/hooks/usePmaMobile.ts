import { useEffect, useState } from 'react'

/** Breakpoint allineato al design system PMA (smartphone / tablet stretto). */
export const PMA_MOBILE_MEDIA = '(max-width: 640px)'

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
