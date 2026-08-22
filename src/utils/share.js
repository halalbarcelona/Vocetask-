import { formatTimeLabel } from './dateUtils'

export function buildTodaySummary(todayTasks) {
  if (todayTasks.length === 0) return "Today's list on Aura Task: nothing scheduled."
  const lines = todayTasks.map((t) => {
    const time = t.time ? ` (${formatTimeLabel(t.time)})` : ''
    const done = t.done ? '✓ ' : ''
    return `${done}${t.title || 'Untitled task'}${time}`
  })
  return `Today's list — Aura Task:\n${lines.join('\n')}`
}

// Uses the Web Share sheet when available (mobile browsers), otherwise
// copies to the clipboard so the caller can show a toast instead.
export async function shareText(text) {
  if (navigator.share) {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch {
      return 'cancelled'
    }
  }
  await navigator.clipboard.writeText(text)
  return 'copied'
}
