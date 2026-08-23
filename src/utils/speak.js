import { formatTimeLabel } from './dateUtils'

export const supportsSpeechSynthesis = typeof window !== 'undefined' && 'speechSynthesis' in window

// Devanagari read by an en-US voice comes out as noise. Tagging the
// utterance en-IN lets the platform pick a voice that handles both scripts.
function utter(text) {
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-IN'
  return u
}

export function speakDailyRecap(tasks) {
  if (!supportsSpeechSynthesis) return

  if (tasks.length === 0) {
    window.speechSynthesis.speak(utter('You have no tasks today. Enjoy your day.'))
    return
  }

  const sorted = [...tasks].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
  const lines = sorted.map((t) => (t.time ? `${t.title} at ${formatTimeLabel(t.time)}` : t.title))
  const intro = `You have ${tasks.length} task${tasks.length === 1 ? '' : 's'} today.`
  const text = `${intro} ${lines.join('. ')}.`

  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utter(text))
}
