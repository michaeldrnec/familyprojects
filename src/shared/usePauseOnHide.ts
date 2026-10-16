// Calls `pause` when the player leaves mid-game -- switching tabs, switching
// apps, locking the phone, or clicking out of the window -- so a real-time
// game is waiting on a pause screen when they come back, rather than having
// carried on (or ended) without them. Only listens while `active` is true,
// e.g. while the game is actually being played.
import { useEffect, useRef } from 'react'

export function usePauseOnHide(pause: () => void, active = true) {
  const pauseRef = useRef(pause)
  pauseRef.current = pause

  useEffect(() => {
    if (!active) return
    const onBlur = () => pauseRef.current()
    const onVisibility = () => {
      if (document.hidden) pauseRef.current()
    }
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [active])
}
