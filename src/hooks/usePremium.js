import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabaseClient'

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

  // Asks the backend whether this email has been marked premium by the
  // Stripe webhook. Only ever flips premium ON here, never off — a network
  // hiccup or an unconfigured backend can't lock someone out of premium
  // they already have locally.
  const syncFromBackend = useCallback(async (email) => {
    if (!supabaseConfigured || !email) return false
    try {
      const { data, error } = await supabase
        .from('premium_status')
        .select('is_premium')
        .eq('email', email)
        .maybeSingle()
      if (error || !data?.is_premium) return false
      setIsPremium(true)
      return true
    } catch {
      return false
    }
  }, [])

  return { isPremium, activatePremium, deactivatePremium, syncFromBackend }
}
