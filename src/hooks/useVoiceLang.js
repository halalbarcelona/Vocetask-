import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'aura-voice-lang'
const EVENT = 'aura-voice-lang-changed'

// The Web Speech API loads one acoustic + language model per session, so the
// choice genuinely changes what comes back. en-IN transcribes Hinglish into
// Latin script and mangles the Hindi words into English near-homophones (which
// speechFix then repairs); hi-IN transcribes into Devanagari and gets the Hindi
// right but drops English words. Neither wins for everyone, so it's a setting —
// and a one-tap retry on the Record screen, because the fastest way to fix a
// bad transcript is to say it again into the other model.
export const VOICE_LANGS = [
  { value: 'en-IN', label: 'Hinglish', hint: 'English + Hindi, Latin script' },
  { value: 'hi-IN', label: 'हिंदी', hint: 'Devanagari' },
  { value: 'en-US', label: 'English', hint: 'US English' },
]

const VALID = new Set(VOICE_LANGS.map((l) => l.value))

function load() {
  const saved = localStorage.getItem(STORAGE_KEY)
  return VALID.has(saved) ? saved : 'en-IN'
}

export function otherLang(lang) {
  return lang === 'hi-IN' ? 'en-IN' : 'hi-IN'
}

export function useVoiceLang() {
  const [lang, setLangState] = useState(load)

  // Written from more than one screen (Settings, and the retry chip on
  // Record), so mirror it the way useTheme does rather than lifting state.
  useEffect(() => {
    const refresh = () => setLangState(load())
    window.addEventListener(EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const setLang = useCallback((next) => {
    if (!VALID.has(next)) return
    localStorage.setItem(STORAGE_KEY, next)
    setLangState(next)
    window.dispatchEvent(new Event(EVENT))
  }, [])

  return { lang, setLang }
}
