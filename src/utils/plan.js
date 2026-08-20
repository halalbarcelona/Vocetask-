import { toISODate, todayISO } from './dateUtils'

export const FREE_DAILY_TASK_LIMIT = 3

export function tasksCreatedToday(tasks) {
  const today = todayISO()
  return tasks.filter((t) => t.createdAt && toISODate(new Date(t.createdAt)) === today).length
}

export function remainingFreeTasks(tasks) {
  return Math.max(0, FREE_DAILY_TASK_LIMIT - tasksCreatedToday(tasks))
}
