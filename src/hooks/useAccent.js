import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'aura-accent'

// Every non-default preset is a deep, saturated hue chosen to read well with
// white text in both themes, so one override works everywhere instead of
// needing a separate light/dark value per preset like the default indigo has.
// --accent-soft/--accent-glow/--accent-ring are derived from --accent via
// color-mix() in index.css, so overriding this one variable retints all of
// them automatically.
export const ACCENT_PRESETS = [
  { value: 'default', label: 'Indigo', swatch: '#4b3fd4' },
  { value: 'teal', label: 'Teal', swatch: '#0f766e' },
  { value: 'rose', label: 'Rose', swatch: '#be123c' },
  { value: 'amber', label: 'Amber', swatch: '#b45309' },
  { value: 'green', label: 'Green', swatch: '#15803d' },
  { value: 'slate', label: 'Slate', swatch: '#334155' },
]

function loadAccent() {
  const stored = localStorage.getItem(STORAGE_KEY)
  return ACCENT_PRESETS.some((p) => p.value === stored) ? stored : 'default'
}

function applyAccent(value) {
  const root = document.documentElement
  const preset = ACCENT_PRESETS.find((p) => p.value === value)
  if (!preset || value === 'default') {
    root.style.removeProperty('--accent')
    root.style.removeProperty('--on-accent')
  } else {
    root.style.setProperty('--accent', preset.swatch)
    root.style.setProperty('--on-accent', '#ffffff')
  }
}

export function useAccent() {
  const [accent, setAccentState] = useState(loadAccent)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, accent)
    applyAccent(accent)
  }, [accent])

  const setAccent = useCallback((value) => {
    if (ACCENT_PRESETS.some((p) => p.value === value)) setAccentState(value)
  }, [])

  return { accent, setAccent, presets: ACCENT_PRESETS }
}
