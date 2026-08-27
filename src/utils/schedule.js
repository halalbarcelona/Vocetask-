import { isDueOn } from './recurrence'

// Fallback window for anyone who hasn't set working hours in Settings —
// waking hours, not literal work hours, so a suggestion still makes sense
// for personal errands in the evening.
const DEFAULT_DAY_START_MINUTES = 8 * 60
const DEFAULT_DAY_END_MINUTES = 21 * 60
const SLOT_STEP_MINUTES = 15

function toMinutes(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function toTimeString(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Busy intervals for the given date: every other task already scheduled
// there with a time and a duration, sorted and merged so overlaps don't
// throw off the free-slot search.
function busyIntervals(tasks, date, excludeTaskId) {
  const intervals = tasks
    .filter((t) => t.id !== excludeTaskId && t.time && t.durationMinutes > 0 && isDueOn(t, date))
    .map((t) => {
      const start = toMinutes(t.time)
      return { start, end: start + t.durationMinutes }
    })
    .sort((a, b) => a.start - b.start)

  const merged = []
  for (const interval of intervals) {
    const last = merged[merged.length - 1]
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end)
    } else {
      merged.push({ ...interval })
    }
  }
  return merged
}

// Finds the earliest open slot on `date` that fits `durationMinutes`,
// starting the search no earlier than `notBefore` minutes-of-day (so
// "today" doesn't suggest a slot that's already passed). Returns a "HH:MM"
// string, or null if the day's booked solid.
export function suggestSlot(
  tasks,
  date,
  durationMinutes,
  { excludeTaskId, notBefore, dayStartMinutes = DEFAULT_DAY_START_MINUTES, dayEndMinutes = DEFAULT_DAY_END_MINUTES } = {},
) {
  if (!durationMinutes || durationMinutes <= 0) return null
  const busy = busyIntervals(tasks, date, excludeTaskId)
  const earliestStart = Math.max(dayStartMinutes, notBefore ?? 0)

  let cursor = earliestStart
  for (const interval of busy) {
    if (cursor + durationMinutes <= interval.start) break
    cursor = Math.max(cursor, interval.end)
  }
  cursor = Math.ceil(cursor / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES

  if (cursor + durationMinutes > dayEndMinutes) return null
  return toTimeString(cursor)
}
