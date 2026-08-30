import { useCallback, useEffect, useRef, useState } from 'react'
import { isDueOn } from '../utils/recurrence'
import { todayISO } from '../utils/dateUtils'

function isAlreadyDone(task, today) {
  return task.recurrence && task.recurrence !== 'none'
    ? (task.completedDates ?? []).includes(today)
    : task.done
}

const STORAGE_KEY = 'aura-notifications'

export const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window

// Best-effort only: this schedules a browser Notification while the app is
// open in a tab, using setTimeout. It cannot wake the app or notify once the
// tab/browser is fully closed — true background push needs a server (VAPID
// + push service), which this no-backend app doesn't have.
export function useNotifications(tasks) {
  const [enabled, setEnabledState] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')
  // Distinguishes "never asked" from "the user (or their browser) said no" —
  // the toggle flipping back off with no explanation reads as broken rather
  // than as the browser blocking it.
  const [permissionDenied, setPermissionDenied] = useState(
    () => notificationsSupported && Notification.permission === 'denied',
  )
  const timersRef = useRef([])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(enabled))
  }, [enabled])

  const setEnabled = useCallback(async (value) => {
    if (value && notificationsSupported) {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setPermissionDenied(permission === 'denied')
        setEnabledState(false)
        return
      }
    }
    setPermissionDenied(false)
    setEnabledState(value)
  }, [])

  useEffect(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    if (!enabled || !notificationsSupported || Notification.permission !== 'granted') return undefined

    const today = todayISO()
    const now = Date.now()

    for (const task of tasks) {
      // Don't nag about something they already finished.
      if (!task.time || !isDueOn(task, today) || isAlreadyDone(task, today)) continue
      const [h, m] = task.time.split(':').map(Number)
      const target = new Date()
      target.setHours(h, m, 0, 0)
      const leadMs = (task.reminderLeadMinutes ?? 0) * 60 * 1000
      const delay = target.getTime() - leadMs - now
      if (delay <= 0 || delay > 24 * 60 * 60 * 1000) continue

      const body = task.reminderLeadMinutes
        ? `${task.title || 'Task'} — in ${task.reminderLeadMinutes} min`
        : task.title || 'You have a task due now'

      const timer = setTimeout(() => {
        new Notification('Aura Task', { body })
      }, delay)
      timersRef.current.push(timer)
    }

    return () => timersRef.current.forEach(clearTimeout)
  }, [enabled, tasks])

  return { enabled, setEnabled, supported: notificationsSupported, permissionDenied }
}
