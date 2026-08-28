import { isoToDate, toISODate } from './dateUtils'
import { isDueOn, isOverdue } from './recurrence'

function completionDatesSet(tasks) {
  const dates = new Set()
  for (const task of tasks) {
    if (task.recurrence && task.recurrence !== 'none') {
      for (const d of task.completedDates ?? []) dates.add(d)
    } else if (task.done && task.date) {
      dates.add(task.date)
    }
  }
  return dates
}

// Counts consecutive days ending today (or yesterday, so a streak doesn't
// vanish before the user has had a chance to do today's tasks) where at
// least one task was completed.
export function computeStreak(tasks) {
  const dates = completionDatesSet(tasks)
  if (dates.size === 0) return 0

  const cursor = new Date()
  if (!dates.has(toISODate(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!dates.has(toISODate(cursor))) return 0
  }

  let streak = 0
  while (dates.has(toISODate(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

// Longest run of consecutive completion-days ever recorded, not just the
// one ending today/yesterday.
export function computeLongestStreak(tasks) {
  const dates = completionDatesSet(tasks)
  if (dates.size === 0) return 0

  const sorted = [...dates].sort()
  let longest = 1
  let current = 1

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1])
    const next = new Date(sorted[i])
    const dayDiff = Math.round((next - prev) / (24 * 60 * 60 * 1000))
    if (dayDiff === 1) {
      current += 1
      longest = Math.max(longest, current)
    } else {
      current = 1
    }
  }
  return longest
}

// % of days in the last `days` days (including today) that had at least
// one task completed.
export function completionRate(tasks, days = 7) {
  const dates = completionDatesSet(tasks)
  const cursor = new Date()
  let hit = 0
  for (let i = 0; i < days; i++) {
    if (dates.has(toISODate(cursor))) hit += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return Math.round((hit / days) * 100)
}

// Per-habit versions of computeStreak/completionRate below — a single
// recurring task's own run, rather than "was anything at all done that day"
// across the whole list. A one-off task has no habit streak, so callers
// should only call these for tasks with recurrence !== 'none'.
export function habitStreak(task) {
  const dates = new Set(task.completedDates ?? [])
  if (dates.size === 0) return 0

  const cursor = new Date()
  if (!dates.has(toISODate(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!dates.has(toISODate(cursor))) return 0
  }

  let streak = 0
  while (dates.has(toISODate(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

// % of the days this habit was actually due, in the last `days` days, that
// it got done — due-days only, so a weekly habit isn't punished for the six
// days a week it was never scheduled on.
export function habitCompletionRate(task, days = 7) {
  const dates = new Set(task.completedDates ?? [])
  const cursor = new Date()
  let due = 0
  let done = 0
  for (let i = 0; i < days; i++) {
    const iso = toISODate(cursor)
    if (isDueOn(task, iso)) {
      due += 1
      if (dates.has(iso)) done += 1
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return due === 0 ? 0 : Math.round((done / due) * 100)
}

// Counts tasks per category (all tasks, not just today's).
export function categoryBreakdown(tasks) {
  const counts = new Map()
  for (const task of tasks) {
    const category = task.category || 'Personal'
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

// Tasks actually finished in the last `days` days (default 7), by when they
// were completed — not their due date. A one-off task relies on
// `completedAt`; a recurring task's own `completedDates` already records
// exactly this. Older data with no completedAt (from before that field
// existed) can't be placed in the window and is left out rather than
// guessed at.
export function completedInLastDays(tasks, days = 7) {
  const cursor = new Date()
  const cutoff = toISODate(cursor)
  cursor.setDate(cursor.getDate() - (days - 1))
  const windowStart = toISODate(cursor)

  const completed = []
  for (const task of tasks) {
    if (task.recurrence && task.recurrence !== 'none') {
      const hits = (task.completedDates ?? []).filter((d) => d >= windowStart && d <= cutoff)
      for (const date of hits) completed.push({ task, date })
    } else if (task.done && task.completedAt) {
      const date = toISODate(new Date(task.completedAt))
      if (date >= windowStart && date <= cutoff) completed.push({ task, date })
    }
  }
  return completed.sort((a, b) => b.date.localeCompare(a.date))
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
// Requiring a handful of data points before naming a "most productive" day
// or time keeps a brand-new account from getting told its most productive
// day is Tuesday off a single completed task.
const MIN_SAMPLES = 5

// Every completion date this app can see, one-off and recurring alike —
// day-of-week doesn't need a time, so completedDates (dates only) count
// here even though they can't feed the time-of-day version below.
function allCompletionDates(tasks) {
  const dates = []
  for (const task of tasks) {
    if (task.recurrence && task.recurrence !== 'none') {
      dates.push(...(task.completedDates ?? []))
    } else if (task.done && task.completedAt) {
      dates.push(toISODate(new Date(task.completedAt)))
    }
  }
  return dates
}

// Returns the weekday name with the most completions ever recorded, or null
// if there isn't enough history yet to say anything meaningful.
export function mostProductiveDayOfWeek(tasks) {
  const dates = allCompletionDates(tasks)
  if (dates.length < MIN_SAMPLES) return null
  const counts = new Array(7).fill(0)
  for (const iso of dates) counts[isoToDate(iso).getDay()] += 1
  const best = counts.indexOf(Math.max(...counts))
  return counts[best] === 0 ? null : WEEKDAY_NAMES[best]
}

const TIME_BUCKETS = [
  { label: 'Night (9pm–5am)', from: 21, to: 5 },
  { label: 'Morning (5am–12pm)', from: 5, to: 12 },
  { label: 'Afternoon (12pm–5pm)', from: 12, to: 17 },
  { label: 'Evening (5pm–9pm)', from: 17, to: 21 },
]

function bucketFor(hour) {
  return TIME_BUCKETS.find(({ from, to }) => (from < to ? hour >= from && hour < to : hour >= from || hour < to))
}

// Only one-off tasks carry a real timestamp (completedAt) — completedDates
// on recurring tasks is date-only, so recurring completions can't say
// anything about time of day and are correctly left out here.
export function mostProductiveTimeOfDay(tasks) {
  const hours = tasks
    .filter((t) => (!t.recurrence || t.recurrence === 'none') && t.done && t.completedAt)
    .map((t) => new Date(t.completedAt).getHours())
  if (hours.length < MIN_SAMPLES) return null
  const counts = new Map()
  for (const hour of hours) {
    const bucket = bucketFor(hour).label
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

// Compares logged Focus-timer minutes against the upfront estimate, only
// across tasks that actually have both — most tasks never touch the Focus
// timer, so this stays silent rather than averaging in a bunch of zeros.
export function estimateAccuracy(tasks) {
  const pairs = tasks.filter((t) => t.durationMinutes > 0 && t.actualMinutes > 0)
  if (pairs.length < MIN_SAMPLES) return null
  const totalEstimated = pairs.reduce((sum, t) => sum + t.durationMinutes, 0)
  const totalActual = pairs.reduce((sum, t) => sum + t.actualMinutes, 0)
  const ratioPercent = Math.round((totalActual / totalEstimated) * 100)
  return { sampleSize: pairs.length, ratioPercent }
}

function isTaskDone(task, today) {
  return task.recurrence && task.recurrence !== 'none' ? (task.completedDates ?? []).includes(today) : task.done
}

// One deterministic line, or none — never a fake AI voice, and never
// forced when nothing actually needs saying. Home's streak banner already
// covers streaks, so this deliberately doesn't repeat that signal; it only
// surfaces the two things a day-to-day glance at Home can't already see:
// how much high-priority load is sitting on today, and whether overdue
// work has piled up enough to be worth a deliberate look.
export function dailyInsight(tasks, today) {
  const highPriorityToday = tasks.filter((t) => t.priority === 'high' && !isTaskDone(t, today) && isDueOn(t, today)).length
  if (highPriorityToday > 0) {
    return `${highPriorityToday} high-priority task${highPriorityToday === 1 ? '' : 's'} due today.`
  }
  const overdueCount = tasks.filter((t) => isOverdue(t, today)).length
  if (overdueCount >= 3) {
    return `${overdueCount} tasks are overdue — worth a quick triage.`
  }
  return null
}
