import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabaseClient'

const STORAGE_KEY = 'aura-premium'
const TRIAL_KEY = 'aura-trial-start'
const TRIAL_DAYS = 7

function loadPaid() {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

function loadTrialStart() {
  const raw = localStorage.getItem(TRIAL_KEY)
  const ms = raw ? Number(raw) : NaN
  return Number.isFinite(ms) ? ms : null
}

// Whole days remaining, rounded up, so "1 day left" means "expires sometime
// today" rather than showing 0 while the trial is still usable.
function daysLeftFrom(startMs) {
  if (!startMs) return 0
  const elapsedDays = (Date.now() - startMs) / (24 * 60 * 60 * 1000)
  return Math.max(0, Math.ceil(TRIAL_DAYS - elapsedDays))
}

const TRIAL_EVENT = 'aura-trial-started'

// Starts the trial clock. Idempotent — a returning user never gets a fresh
// 7 days by reinstalling the account, since the stamp is only written once.
// Fires an event because this is called from account creation, after
// usePremium has already mounted and read the (then empty) stamp.
export function beginTrialIfUnstarted() {
  if (!localStorage.getItem(TRIAL_KEY)) {
    localStorage.setItem(TRIAL_KEY, String(Date.now()))
    window.dispatchEvent(new Event(TRIAL_EVENT))
  }
}

export function usePremium() {
  const [isPaid, setIsPaid] = useState(loadPaid)
  const [trialStart, setTrialStart] = useState(loadTrialStart)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isPaid))
  }, [isPaid])

  // The trial stamp is written outside React (on account creation), so listen
  // for that, and re-check on focus to catch expiry for a session left open
  // across the boundary.
  useEffect(() => {
    const refresh = () => setTrialStart(loadTrialStart())
    refresh()
    window.addEventListener(TRIAL_EVENT, refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener(TRIAL_EVENT, refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  const trialDaysLeft = daysLeftFrom(trialStart)
  const trialActive = Boolean(trialStart) && trialDaysLeft > 0
  const trialExpired = Boolean(trialStart) && trialDaysLeft <= 0
  // Nobody gets a second one. Anyone who has never had a trial can still be
  // offered it — accounts made before the trial existed, mainly.
  const trialAvailable = !trialStart && !isPaid

  // Same one-shot stamp the account flow writes, exposed so the paywall can
  // offer the trial as a real choice instead of it only ever happening
  // silently at signup.
  const startTrial = useCallback(() => {
    beginTrialIfUnstarted()
    setTrialStart(loadTrialStart())
  }, [])

  const activatePremium = useCallback(() => setIsPaid(true), [])
  const deactivatePremium = useCallback(() => setIsPaid(false), [])

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
      setIsPaid(true)
      return true
    } catch {
      return false
    }
  }, [])

  return {
    // Everything gated in the app reads isPremium, so the trial simply
    // flows through the existing checks with no per-feature changes.
    isPremium: isPaid || trialActive,
    isPaid,
    trialActive,
    trialExpired,
    trialAvailable,
    trialDaysLeft,
    trialDays: TRIAL_DAYS,
    startTrial,
    activatePremium,
    deactivatePremium,
    syncFromBackend,
  }
}
