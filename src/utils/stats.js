import { toISODate } from './dateUtils'

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

// Counts tasks per category (all tasks, not just today's).
export function categoryBreakdown(tasks) {
  const counts = new Map()
  for (const task of tasks) {
    const category = task.category || 'Personal'
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}
