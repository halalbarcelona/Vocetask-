import { dayAfterTomorrowISO, todayISO, tomorrowISO } from './dateUtils'

const AMPM_TIME_RE = /\b(?:at\s+)?(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i
const HOUR24_TIME_RE = /\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/

// Hindi/Hinglish "X baje" (o'clock), optionally paired with a period-of-day
// word on either side ("subah 9 baje", "9 baje raat"). No am/pm marker exists
// in spoken Hindi, so a period word resolves it; without one we fall back to
// a rough heuristic (see BAJE_DEFAULT_IS_PM below).
const PERIOD_WORD_RE = 'subah|savere|dopahar|shaam|sham|raat'
const BAJE_TIME_RE = new RegExp(
  `\\b(?:(${PERIOD_WORD_RE})\\s+)?(\\d{1,2})\\s*baje(?:\\s+(${PERIOD_WORD_RE}))?\\b`,
  'i',
)

const DAY_WORD_RE = /\b(today|tonight|tomorrow)\b/i
const HINDI_DAY_WORD_RE = /\b(aaj|kal|parso)\b/i

const RECURRENCE_DAILY_RE = /\b(every ?day|daily|har ?roz|roz|har din)\b/i
const RECURRENCE_WEEKLY_RE = /\b(every ?week|weekly|har ?hafte|har hafta)\b/i

function to24Hour(hour, minute, period) {
  let h = Number(hour) % 12
  if (period.toLowerCase() === 'pm') h += 12
  return `${String(h).padStart(2, '0')}:${minute || '00'}`
}

function periodToHour(hour, periodWord) {
  const h = Number(hour) % 12
  const isPM = /dopahar|shaam|sham|raat/i.test(periodWord)
  return isPM ? h + 12 : h
}

// No period word given for "X baje" — assume evening for small numbers
// (most common casual usage, e.g. "5 baje milna hai"), morning otherwise.
function bajeDefaultHour(hour) {
  const h = Number(hour) % 12
  if (h === 0) return 12
  if (h >= 1 && h <= 6) return h + 12
  return h
}

export function parseVoiceCommand(rawTranscript) {
  const transcript = rawTranscript.trim()
  let remaining = transcript
  let time = ''

  const ampmMatch = remaining.match(AMPM_TIME_RE)
  const bajeMatch = remaining.match(BAJE_TIME_RE)

  if (ampmMatch) {
    time = to24Hour(ampmMatch[1], ampmMatch[2], ampmMatch[3])
    remaining = remaining.replace(ampmMatch[0], ' ')
  } else if (bajeMatch) {
    const periodWord = bajeMatch[1] || bajeMatch[3]
    const hour = periodWord ? periodToHour(bajeMatch[2], periodWord) : bajeDefaultHour(bajeMatch[2])
    time = `${String(hour).padStart(2, '0')}:00`
    remaining = remaining.replace(bajeMatch[0], ' ')
  } else {
    const hour24Match = remaining.match(HOUR24_TIME_RE)
    if (hour24Match) {
      time = `${hour24Match[1].padStart(2, '0')}:${hour24Match[2]}`
      remaining = remaining.replace(hour24Match[0], ' ')
    }
  }

  let date = todayISO()
  const dayMatch = remaining.match(DAY_WORD_RE)
  const hindiDayMatch = remaining.match(HINDI_DAY_WORD_RE)

  if (dayMatch) {
    date = dayMatch[1].toLowerCase() === 'tomorrow' ? tomorrowISO() : todayISO()
    remaining = remaining.replace(dayMatch[0], ' ')
  } else if (hindiDayMatch) {
    const word = hindiDayMatch[1].toLowerCase()
    date = word === 'kal' ? tomorrowISO() : word === 'parso' ? dayAfterTomorrowISO() : todayISO()
    remaining = remaining.replace(hindiDayMatch[0], ' ')
  }

  let recurrence = 'none'
  const dailyMatch = remaining.match(RECURRENCE_DAILY_RE)
  const weeklyMatch = remaining.match(RECURRENCE_WEEKLY_RE)
  if (dailyMatch) {
    recurrence = 'daily'
    remaining = remaining.replace(dailyMatch[0], ' ')
  } else if (weeklyMatch) {
    recurrence = 'weekly'
    remaining = remaining.replace(weeklyMatch[0], ' ')
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
    recurrence,
  }
}
