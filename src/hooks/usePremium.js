import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'aura-premium'

function loadPremium() {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

export function usePremium() {
  const [isPremium, setIsPremium] = useState(loadPremium)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isPremium))
  }, [isPremium])

  const activatePremium = useCallback(() => setIsPremium(true), [])
  const deactivatePremium = useCallback(() => setIsPremium(false), [])

  return { isPremium, activatePremium, deactivatePremium }
}
