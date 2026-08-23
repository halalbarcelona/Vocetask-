import { isDueOn, isOverdue } from './recurrence'

// Empty array / 'any' on any axis means "no constraint on that axis" — a
// brand-new filter matches everything until the user narrows it down.
export function emptyCriteria() {
  return { categories: [], labels: [], priority: [], done: 'any', due: 'any' }
}

// Pure so it can be reused anywhere a task needs testing against saved
// criteria (Home's applied-filter view, and the builder's live preview
// count) without duplicating the logic.
export function matchesFilter(task, criteria, todayISO) {
  const c = { ...emptyCriteria(), ...criteria }

  if (c.categories.length > 0 && !c.categories.includes(task.category)) return false

  if (c.labels.length > 0) {
    const taskLabels = task.labels ?? []
    if (!c.labels.some((l) => taskLabels.includes(l))) return false
  }

  if (c.priority.length > 0 && !c.priority.includes(task.priority ?? 'none')) return false

  const isRecurring = Boolean(task.recurrence && task.recurrence !== 'none')
  const doneToday = isRecurring ? (task.completedDates ?? []).includes(todayISO) : task.done
  if (c.done === 'done' && !doneToday) return false
  if (c.done === 'pending' && doneToday) return false

  if (c.due === 'today' && !isDueOn(task, todayISO)) return false
  if (c.due === 'overdue' && !isOverdue(task, todayISO)) return false
  if (c.due === 'upcoming' && !(task.date && task.date > todayISO)) return false

  return true
}
