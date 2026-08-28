import { isDueOn, isOverdue } from './recurrence'
import { openBlockerFor } from './dependencies'
import { formatTimeLabel } from './dateUtils'

function isTaskDone(task, today) {
  return task.recurrence && task.recurrence !== 'none' ? (task.completedDates ?? []).includes(today) : task.done
}

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

const PRIORITY_SCORE = { high: 30, medium: 15, low: 0, none: 0 }
const PRIORITY_REASON = { high: 'High priority', medium: 'Medium priority' }

// Scores one candidate and returns the reasons that actually contributed —
// every reason shown to the user maps to a real point of the score, so the
// explanation can never claim something that didn't factor in.
function scoreCandidate(task, today, nowMinutes, availableMinutes) {
  let score = 0
  const reasons = []

  if (isOverdue(task, today)) {
    score += 100
    reasons.push('Overdue')
  } else if (task.time && timeToMinutes(task.time) < nowMinutes) {
    // Due today, at a time that's already passed — not "overdue" by the
    // date-based rule, but just as pressing.
    score += 60
    reasons.push(`Was due at ${formatTimeLabel(task.time)}`)
  }

  const priorityScore = PRIORITY_SCORE[task.priority] ?? 0
  if (priorityScore > 0) {
    score += priorityScore
    reasons.push(PRIORITY_REASON[task.priority])
  }

  if (task.time && !reasons.some((r) => r.startsWith('Was due') || r === 'Overdue')) {
    const minutesUntil = timeToMinutes(task.time) - nowMinutes
    if (minutesUntil >= 0) {
      const proximityBonus = Math.max(0, 20 - Math.floor(minutesUntil / 30))
      if (proximityBonus > 0) {
        score += proximityBonus
        reasons.push(`Due today at ${formatTimeLabel(task.time)}`)
      }
    }
  }

  if (task.durationMinutes > 0 && availableMinutes != null) {
    if (task.durationMinutes <= availableMinutes) {
      score += 20
      reasons.push(`Fits your remaining time today (${task.durationMinutes} min)`)
    } else {
      score -= 15
    }
  }

  if (reasons.length === 0) {
    reasons.push('Due today')
  }

  return { score, reasons }
}

// The single most worth-doing-right-now task, deterministically, with the
// reasons that produced the pick — never a guess, and never anything that
// isn't already tracked on the task itself. Returns null when there's
// nothing eligible (everything done, blocked, or not due today/overdue).
//
// nowMinutes/workEndMinutes are injectable for testing; in the app they
// default to the real clock and the user's working-hours preference.
export function nextBestAction(
  tasks,
  today,
  { nowMinutes = new Date().getHours() * 60 + new Date().getMinutes(), workEndMinutes = 21 * 60 } = {},
) {
  const availableMinutes = Math.max(0, workEndMinutes - nowMinutes)

  const candidates = tasks.filter((task) => {
    if (isTaskDone(task, today)) return false
    if (!isOverdue(task, today) && !isDueOn(task, today)) return false
    if (openBlockerFor(task, tasks, today)) return false
    return true
  })

  if (candidates.length === 0) return null

  const scored = candidates.map((task) => ({ task, ...scoreCandidate(task, today, nowMinutes, availableMinutes) }))
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const aKey = `${a.task.date}${a.task.time || '99:99'}`
    const bKey = `${b.task.date}${b.task.time || '99:99'}`
    return aKey.localeCompare(bKey)
  })

  const { task, reasons } = scored[0]
  return { task, reasons }
}
