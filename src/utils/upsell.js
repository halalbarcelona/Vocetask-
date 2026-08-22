import { todayISO } from './dateUtils'

const STOPWORDS = new Set(['the', 'a', 'an', 'my', 'to', 'for', 'and', 'of'])

function normalize(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .join(' ')
    .trim()
}

// Finds a task title the user has typed several times — the single clearest
// sign that Recurring would save them real effort.
function mostRepeatedTitle(tasks) {
  const counts = new Map()
  for (const task of tasks) {
    const key = normalize(task.title)
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best = null
  for (const [title, count] of counts) {
    if (count >= 3 && (!best || count > best.count)) best = { title, count }
  }
  return best
}

function busiestDayCount(tasks) {
  const counts = new Map()
  for (const task of tasks) {
    if (!task.date) continue
    counts.set(task.date, (counts.get(task.date) ?? 0) + 1)
  }
  return Math.max(0, ...counts.values())
}

// Picks the most relevant reason to upgrade based on what this person
// actually does, rather than pitching a generic feature list. Ordered by
// how convincing the signal is.
export function pickUpsellReason(tasks) {
  const repeated = mostRepeatedTitle(tasks)
  if (repeated) {
    return {
      feature: 'Recurring tasks',
      message: `You've added "${repeated.title}" ${repeated.count} times. With Recurring you'd set it once.`,
    }
  }

  const busiest = busiestDayCount(tasks)
  if (busiest >= 8) {
    return {
      feature: 'Bulk actions & priorities',
      message: `Your busiest day had ${busiest} tasks. Priorities and bulk actions make days like that manageable.`,
    }
  }

  const longTitle = tasks.find((t) => (t.title || '').split(/\s+/).length >= 7)
  if (longTitle) {
    return {
      feature: 'Subtasks',
      message: `"${longTitle.title}" looks like several steps. Subtasks break it down.`,
    }
  }

  const overdueCount = tasks.filter((t) => t.date && t.date < todayISO() && !t.done).length
  if (overdueCount >= 3) {
    return {
      feature: 'Snooze & reminders',
      message: `${overdueCount} tasks slipped past their date. Snooze and timed reminders keep them from piling up.`,
    }
  }

  return {
    feature: 'Everything',
    message: 'Recurring tasks, subtasks, priorities, templates and your productivity report — all in one payment.',
  }
}

// Counts what the user actually did with Premium, for the trial recap.
export function summarizeTrialUsage(tasks, templates = []) {
  const recurring = tasks.filter((t) => t.recurrence && t.recurrence !== 'none').length
  const subtasks = tasks.reduce((n, t) => n + (t.subtasks?.length ?? 0), 0)
  const notes = tasks.filter((t) => (t.notes || '').trim()).length
  const prioritized = tasks.filter((t) => t.priority && t.priority !== 'none').length
  return { recurring, subtasks, notes, prioritized, templates: templates.length, total: tasks.length }
}
