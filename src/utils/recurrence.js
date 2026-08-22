import { isoToDate } from './dateUtils'

// A one-time task whose date has passed and that was never completed.
// Recurring tasks are excluded — they're due again on their own schedule,
// so they're never "overdue" in a way the user needs to chase.
export function isOverdue(task, todayISO) {
  if (!task.date || task.date >= todayISO) return false
  if (task.recurrence && task.recurrence !== 'none') return false
  return !task.done
}

export function isDueOn(task, dateISO) {
  if (!task.date || task.date > dateISO) return false
  if (!task.recurrence || task.recurrence === 'none') return task.date === dateISO
  if (task.recurrence === 'daily') return true
  if (task.recurrence === 'weekly') {
    return isoToDate(task.date).getDay() === isoToDate(dateISO).getDay()
  }
  if (task.recurrence === 'monthly') {
    return isoToDate(task.date).getDate() === isoToDate(dateISO).getDate()
  }
  if (task.recurrence === 'custom') {
    const days = task.recurrenceDays ?? []
    return days.includes(isoToDate(dateISO).getDay())
  }
  return task.date === dateISO
}
