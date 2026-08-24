import { useCallback, useEffect, useState } from 'react'
import { STRINGS } from '../i18n/strings'

const STORAGE_KEY = 'aura-ui-lang'

export const UI_LANG_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिंदी' },
]

function loadLang() {
  const stored = localStorage.getItem(STORAGE_KEY)
  return UI_LANG_OPTIONS.some((o) => o.value === stored) ? stored : 'en'
}

export function useUILang() {
  const [lang, setLangState] = useState(loadLang)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang)
  }, [lang])

  const setLang = useCallback((value) => {
    if (UI_LANG_OPTIONS.some((o) => o.value === value)) setLangState(value)
  }, [])

  const t = useCallback(
    (key, ...args) => {
      const entry = STRINGS[lang]?.[key] ?? STRINGS.en[key]
      if (entry === undefined) return key
      return typeof entry === 'function' ? entry(...args) : entry
    },
    [lang]
  )

  return { lang, setLang, t, options: UI_LANG_OPTIONS }
}
