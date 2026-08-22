import { formatTimeLabel } from './dateUtils'

export const supportsSpeechSynthesis = typeof window !== 'undefined' && 'speechSynthesis' in window

export function speakDailyRecap(tasks) {
  if (!supportsSpeechSynthesis) return

  if (tasks.length === 0) {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance('You have no tasks today. Enjoy your day.'))
    return
  }

  const sorted = [...tasks].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
  const lines = sorted.map((t) => (t.time ? `${t.title} at ${formatTimeLabel(t.time)}` : t.title))
  const intro = `You have ${tasks.length} task${tasks.length === 1 ? '' : 's'} today.`
  const text = `${intro} ${lines.join('. ')}.`

  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
}
