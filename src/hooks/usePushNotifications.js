import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabaseClient'
import { useSyncContext } from './SyncContext'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

export const pushSupported =
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

// The Push API wants the VAPID public key as raw bytes, not the base64url
// string it's generated and stored as everywhere else.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

// Real push — arrives even with no Aura Task tab open anywhere, unlike
// useNotifications' in-tab timer. Needs a signed-in Sync account: the
// server-side sender (supabase/functions/send-reminders) has no way to
// find or trust a subscription that isn't tied to a real user id.
export function usePushNotifications() {
  const { isSignedIn, userId } = useSyncContext()
  const [enabled, setEnabledState] = useState(false)
  const [checking, setChecking] = useState(pushSupported)
  const [permissionDenied, setPermissionDenied] = useState(
    () => pushSupported && Notification.permission === 'denied',
  )
  // { start, end } as "HH:MM" strings, or nulls when quiet hours are off.
  const [quietHours, setQuietHoursState] = useState({ start: null, end: null })

  useEffect(() => {
    if (!pushSupported) {
      setChecking(false)
      return
    }
    let cancelled = false
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then(async (subscription) => {
        if (cancelled) return
        setEnabledState(Boolean(subscription))
        if (subscription && supabaseConfigured) {
          const { data } = await supabase
            .from('push_subscriptions')
            .select('quiet_start, quiet_end')
            .eq('endpoint', subscription.endpoint)
            .maybeSingle()
          if (!cancelled && data) setQuietHoursState({ start: data.quiet_start, end: data.quiet_end })
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setEnabled = useCallback(
    async (value) => {
      if (!pushSupported) return { ok: false, message: 'Push notifications aren’t supported in this browser.' }
      if (!supabaseConfigured) return { ok: false, message: 'Sync isn’t set up yet.' }
      if (!isSignedIn || !userId) return { ok: false, message: 'Sign in to Sync first — Settings → Sync.' }

      const registration = await navigator.serviceWorker.ready

      if (!value) {
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
          await subscription.unsubscribe()
        }
        setEnabledState(false)
        return { ok: true }
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setPermissionDenied(permission === 'denied')
        return { ok: false, permissionDenied: permission === 'denied' }
      }
      setPermissionDenied(false)

      let subscription
      try {
        subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          }))
      } catch (err) {
        return { ok: false, message: err?.message || 'Couldn’t subscribe to push notifications.' }
      }

      const { endpoint, keys } = subscription.toJSON()
      const { error } = await supabase.from('push_subscriptions').upsert({
        endpoint,
        user_id: userId,
        p256dh: keys.p256dh,
        auth: keys.auth,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      if (error) return { ok: false, message: error.message }

      setEnabledState(true)
      return { ok: true }
    },
    [isSignedIn, userId],
  )

  // Shown right in the browser via the same service worker that would
  // handle a real server push — proves permission + registration actually
  // work without waiting on the once-a-minute cron job to fire for real.
  const sendTestNotification = useCallback(async (body) => {
    if (!pushSupported || Notification.permission !== 'granted') {
      return { ok: false, message: 'Enable push notifications first.' }
    }
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification('Aura Task', {
      body,
      icon: '/Vocetask-/icons/icon-192.png',
      badge: '/Vocetask-/icons/icon-192.png',
    })
    return { ok: true }
  }, [])

  // Premium: a DND window during which send-reminders suppresses reminders
  // instead of sending them (see supabase/functions/send-reminders). Pass
  // null/null to turn it back off.
  const setQuietHours = useCallback(async (start, end) => {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return { ok: false, message: 'Enable push notifications first.' }
    const { error } = await supabase
      .from('push_subscriptions')
      .update({ quiet_start: start, quiet_end: end })
      .eq('endpoint', subscription.endpoint)
    if (error) return { ok: false, message: error.message }
    setQuietHoursState({ start, end })
    return { ok: true }
  }, [])

  return {
    supported: pushSupported,
    enabled,
    checking,
    setEnabled,
    permissionDenied,
    sendTestNotification,
    quietHours,
    setQuietHours,
  }
}
