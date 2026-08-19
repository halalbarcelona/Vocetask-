import { todayISO, tomorrowISO } from './dateUtils'

const AMPM_TIME_RE = /\b(?:at\s+)?(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i
const HOUR24_TIME_RE = /\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/
const DAY_WORD_RE = /\b(today|tonight|tomorrow)\b/i

function to24Hour(hour, minute, period) {
  let h = Number(hour) % 12
  if (period.toLowerCase() === 'pm') h += 12
  return `${String(h).padStart(2, '0')}:${minute || '00'}`
}

// Parses a raw voice transcript into a draft task shape. Time detection
// tries "3pm" / "3:30 pm" style phrases first, then falls back to 24h
// "HH:mm", since am/pm phrasing is what natural speech mostly produces.
export function parseVoiceCommand(rawTranscript) {
  const transcript = rawTranscript.trim()
  let remaining = transcript
  let time = ''

  const ampmMatch = remaining.match(AMPM_TIME_RE)
  if (ampmMatch) {
    time = to24Hour(ampmMatch[1], ampmMatch[2], ampmMatch[3])
    remaining = remaining.replace(ampmMatch[0], ' ')
  } else {
    const hour24Match = remaining.match(HOUR24_TIME_RE)
    if (hour24Match) {
      time = `${hour24Match[1].padStart(2, '0')}:${hour24Match[2]}`
      remaining = remaining.replace(hour24Match[0], ' ')
    }
  }

  let date = todayISO()
  const dayMatch = remaining.match(DAY_WORD_RE)
  if (dayMatch) {
    date = dayMatch[1].toLowerCase() === 'tomorrow' ? tomorrowISO() : todayISO()
    remaining = remaining.replace(dayMatch[0], ' ')
  }

  const title = remaining
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
    .trim()

  const cleanTitle = title ? title[0].toUpperCase() + title.slice(1) : ''

  return {
    title: cleanTitle,
    date,
    time,
    category: 'Personal',
  }
}
