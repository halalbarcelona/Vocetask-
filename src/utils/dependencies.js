// Whether a task counts as "done" for blocking purposes — recurring tasks
// use today's occurrence, same rule TaskItem and Home already use elsewhere.
function isBlockerResolved(task, today) {
  return task.recurrence && task.recurrence !== 'none' ? (task.completedDates ?? []).includes(today) : task.done
}

// The first still-open blocker for a task, or null if it isn't blocked (no
// blockers set, or every blocker is already done — including a blocker that
// was since deleted, which can't ever resolve and shouldn't hold anything
// hostage forever).
export function openBlockerFor(task, tasks, today) {
  const ids = task.blockedBy ?? []
  if (ids.length === 0) return null
  for (const id of ids) {
    const blocker = tasks.find((t) => t.id === id)
    if (blocker && !isBlockerResolved(blocker, today)) return blocker
  }
  return null
}
