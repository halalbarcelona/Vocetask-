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
