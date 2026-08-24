import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabaseClient'

// Cross-device sync is entirely separate from the app's local "account"
// (name + email typed in at signup, never verified). This is real
// authentication — a Supabase Auth session — used only to scope which rows
// in the tasks table belong to which person. Nobody is required to sign in
// here; the app works fully offline/local without it, exactly as before.
export function useSync() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(supabaseConfigured)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false)
      return undefined
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  // Sends a 6-digit code to the given email. shouldCreateUser is explicit
  // (rather than relying on the project default) because a sign-in flow that
  // silently refuses to work for a first-time visitor is the single worst
  // failure mode a "just try it" onboarding step can have.
  const requestCode = useCallback(async (email) => {
    if (!supabaseConfigured) return { ok: false, message: 'Sync isn’t set up yet.' }
    setError('')
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    if (authError) {
      setError(authError.message)
      return { ok: false, message: authError.message }
    }
    return { ok: true }
  }, [])

  const verifyCode = useCallback(async (email, token) => {
    if (!supabaseConfigured) return { ok: false, message: 'Sync isn’t set up yet.' }
    setError('')
    const { error: authError } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    if (authError) {
      setError(authError.message)
      return { ok: false, message: authError.message }
    }
    return { ok: true }
  }, [])

  // scope: 'local' clears only this device's session without a server round
  // trip — both the correct match for a button that says "on this device"
  // (other signed-in devices keep syncing), and it means signing out still
  // works while offline, rather than getting stuck because the network call
  // to invalidate the session server-side failed.
  const signOut = useCallback(async () => {
    if (!supabaseConfigured) return
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      setSession(null)
    }
  }, [])

  return {
    userId: session?.user?.id ?? null,
    userEmail: session?.user?.email ?? null,
    isSignedIn: Boolean(session),
    loading,
    error,
    requestCode,
    verifyCode,
    signOut,
  }
}
