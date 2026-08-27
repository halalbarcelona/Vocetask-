import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'aura-preferences'

const DEFAULTS = {
  // Minutes-of-day. Feeds the smart-scheduling suggestion in Confirm — the
  // window it's willing to propose a slot inside, not a hard task boundary.
  workStartMinutes: 8 * 60,
  workEndMinutes: 21 * 60,
  // 0 = Sunday, 1 = Monday. Feeds Calendar's month grid.
  weekStartsOn: 0,
}

function loadPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? { ...DEFAULTS, ...parsed } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function usePreferences() {
  const [preferences, setPreferences] = useState(loadPreferences)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  }, [preferences])

  const setWorkingHours = useCallback((startMinutes, endMinutes) => {
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || startMinutes >= endMinutes) return
    setPreferences((prev) => ({ ...prev, workStartMinutes: startMinutes, workEndMinutes: endMinutes }))
  }, [])

  const setWeekStartsOn = useCallback((day) => {
    if (day === 0 || day === 1) setPreferences((prev) => ({ ...prev, weekStartsOn: day }))
  }, [])

  return { ...preferences, setWorkingHours, setWeekStartsOn }
}
