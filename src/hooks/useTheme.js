import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'aura-theme'
const VALID = ['system', 'light', 'dark']

function loadTheme() {
  const stored = localStorage.getItem(STORAGE_KEY)
  return VALID.includes(stored) ? stored : 'system'
}

// Writes the choice onto <html> so CSS can key off it. "system" removes the
// attribute entirely, letting the prefers-color-scheme media query decide.
function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

export function useTheme() {
  const [theme, setThemeState] = useState(loadTheme)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme)
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((value) => {
    if (VALID.includes(value)) setThemeState(value)
  }, [])

  return { theme, setTheme, options: VALID }
}
