function pad(n) {
  return String(n).padStart(2, '0')
}

function escapeText(s) {
  return String(s).replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, '\\n')
}

function formatStamp(date) {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

const ICS_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

// Maps our recurrence model onto an RFC5545 RRULE. Without this a daily task
// exported as a single one-off event, which is not what the user set up.
function recurrenceRule(task) {
  switch (task.recurrence) {
    case 'daily':
      return 'RRULE:FREQ=DAILY'
    case 'weekly':
      return 'RRULE:FREQ=WEEKLY'
    case 'monthly':
      return 'RRULE:FREQ=MONTHLY'
    case 'custom': {
      const days = (task.recurrenceDays ?? []).map((d) => ICS_DAYS[d]).filter(Boolean)
      return days.length ? `RRULE:FREQ=WEEKLY;BYDAY=${days.join(',')}` : null
    }
    default:
      return null
  }
}

// Builds a floating-time (no timezone) .ics file — good enough for a
// client-only app with no timezone data attached to tasks. Calendar apps
// interpret floating times as local to whichever device imports them.
export function buildICS(tasks) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Aura Task//EN']
  const now = formatStamp(new Date())

  for (const task of tasks) {
    if (!task.date) continue
    const datePart = task.date.replace(/-/g, '')
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${task.id}@aura-task`)
    lines.push(`DTSTAMP:${now}`)
    if (task.time) {
      const [h, m] = task.time.split(':')
      lines.push(`DTSTART:${datePart}T${pad(h)}${pad(m)}00`)
    } else {
      lines.push(`DTSTART;VALUE=DATE:${datePart}`)
    }
    const rule = recurrenceRule(task)
    if (rule) lines.push(rule)
    lines.push(`SUMMARY:${escapeText(task.title || 'Untitled task')}`)
    lines.push(`CATEGORIES:${escapeText(task.category || 'Personal')}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadICS(tasks, filename = 'aura-task.ics') {
  const content = buildICS(tasks)
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
