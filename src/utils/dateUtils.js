export function toISODate(d) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayISO() {
  return toISODate(new Date())
}

export function tomorrowISO() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return toISODate(d)
}

export function dayAfterTomorrowISO() {
  const d = new Date()
  d.setDate(d.getDate() + 2)
  return toISODate(d)
}

export function isoToDate(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function monthLabel(year, month) {
  return `${MONTH_LABELS[month]} ${year}`
}

// weekStartsOn: 0 = Sunday (default), 1 = Monday.
export function weekdayLabels(weekStartsOn = 0) {
  return weekStartsOn === 1 ? [...WEEKDAY_LABELS.slice(1), WEEKDAY_LABELS[0]] : WEEKDAY_LABELS
}

// Returns a 6x7 grid of Date objects covering the full weeks that contain
// every day of the given month, so the calendar grid is always complete.
export function buildMonthGrid(year, month, weekStartsOn = 0) {
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = (firstOfMonth.getDay() - weekStartsOn + 7) % 7
  const gridStart = new Date(year, month, 1 - startOffset)

  const days = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    days.push(d)
  }
  return days
}

export function formatDateLabel(iso) {
  const date = isoToDate(iso)
  const today = todayISO()
  const tomorrow = tomorrowISO()
  if (iso === today) return 'Today'
  if (iso === tomorrow) return 'Tomorrow'
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatTimeLabel(time) {
  if (!time) return ''
  const [hourStr, minuteStr] = time.split(':')
  const hour = Number(hourStr)
  const period = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12}:${minuteStr} ${period}`
}
