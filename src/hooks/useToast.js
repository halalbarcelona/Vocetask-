import { useCallback, useRef, useState } from 'react'

export function useToast(defaultDuration = 4000) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  const showToast = useCallback(
    (message, options = {}) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      setToast({ message, actionLabel: options.actionLabel, onAction: options.onAction })
      timerRef.current = setTimeout(() => setToast(null), options.duration ?? defaultDuration)
    },
    [defaultDuration],
  )

  const dismissToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(null)
  }, [])

  return { toast, showToast, dismissToast }
}
