import { isoToDate } from './dateUtils'

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
