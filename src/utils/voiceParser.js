import { toISODate, todayISO } from './dateUtils'
import {
  FRACTION_WORDS,
  HINDI_NUMBERS,
  MONTHS,
  PERIOD_WORDS,
  PRIORITY_WORDS,
  STANDALONE_TIMES,
  WEEKDAYS,
  alternation,
  inferCategory,
  normalizeDigits,
  toNumber,
} from './hinglish'

// JS \b is defined on [A-Za-z0-9_], so it never matches next to Devanagari.
// These delimiters work in both scripts; L is consumed (not a lookbehind, for
// older-Safari compatibility) and put back when the match is removed.
const L = '(?:^|[\\s,.])'
const R = '(?=$|[\\s,.!?])'

const NUM = `\\d{1,2}|${alternation(Object.keys(HINDI_NUMBERS))}`
const PERIOD = alternation(Object.keys(PERIOD_WORDS))
const FRACTION = alternation(Object.keys(FRACTION_WORDS))
const STANDALONE = alternation(Object.keys(STANDALONE_TIMES))
const WEEKDAY = alternation(Object.keys(WEEKDAYS))
const MONTH = alternation(Object.keys(MONTHS))

// --- time patterns, tried in order (most specific first) ---------------------

const AMPM_RE = /\b(?:at\s+)?(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i
const HOUR24_RE = /\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/
// "9 bajkar 20 minute" — X hours and Y minutes
const BAJKAR_RE = new RegExp(`${L}(?:(${PERIOD})\\s+)?(${NUM})\\s*bajkar\\s+(${NUM})\\s*(?:minute|min)?${R}`, 'iu')
// "sawa nau", "sade 9 baje", "paune das"
const FRACTION_RE = new RegExp(`${L}(?:(${PERIOD})\\s+)?(${FRACTION})\\s+(${NUM})\\s*(?:baje|बजे)?(?:\\s+(${PERIOD}))?${R}`, 'iu')
// "dedh baje", "dhai baje"
const STANDALONE_RE = new RegExp(`${L}(?:(${PERIOD})\\s+)?(${STANDALONE})\\s*(?:baje|बजे)${R}`, 'iu')
// plain "9 baje", "subah 9 baje", "9 baje raat"
const BAJE_RE = new RegExp(`${L}(?:(${PERIOD})\\s+)?(${NUM})\\s*(?:baje|बजे)(?:\\s+(${PERIOD}))?${R}`, 'iu')

// --- day patterns ------------------------------------------------------------

const DAY_WORD_RE = new RegExp(`${L}(today|tonight|tomorrow|aaj|kal|parso|parson|narso|आज|कल|परसों)${R}`, 'iu')
const WEEKDAY_RE = new RegExp(`${L}(?:(agle|next|is|this|iss)\\s+)?(${WEEKDAY})${R}`, 'iu')
// "2 din baad", "teen hafte baad"
const RELATIVE_RE = new RegExp(
  `${L}(${NUM})\\s*(din|day|days|hafte|hafta|week|weeks|mahine|mahina|month|months|दिन|हफ़्ते|हफ्ते|महीने|महीना)` +
    `(?:\\s+(?:baad|bad|later|me|mein|में|बाद))?${R}`,
  'iu',
)
const NEXT_PERIOD_RE = /\b(agle|next)\s+(hafte|hafta|week|mahine|mahina|month)\b/i
// "15 tarikh", "15 January", "15 Jan"
const TARIKH_RE = new RegExp(`${L}(\\d{1,2})\\s*(?:tarikh|तारीख़|तारीख)${R}`, 'iu')
const DATE_MONTH_RE = new RegExp(`\\b(\\d{1,2})\\s*(?:st|nd|rd|th)?\\s+(${MONTH})\\b`, 'i')

// --- recurrence --------------------------------------------------------------

const RECUR_WEEKDAY_RE = new RegExp(`${L}(?:har|every|हर)\\s+(${WEEKDAY})${R}`, 'iu')
const RECUR_MONTHLY_RE = new RegExp(`${L}(?:har|every|हर)\\s*(?:mahine|mahina|month|महीने)${R}`, 'iu')
const RECUR_WEEKLY_RE = new RegExp(`${L}(every ?week|weekly|har ?hafte|har hafta|हर हफ़्ते|हर हफ्ते)${R}`, 'iu')
// रोज़/हफ़्ते/तारीख़ carry a nukta that the hi-IN model writes and the plain
// spelling does not, so both forms are listed rather than stripping the dot out
// of the user's own words.
const RECUR_DAILY_RE = new RegExp(`${L}(every ?day|daily|har ?roz|roz|har din|हर रोज़|हर रोज|रोज़|रोज|हर दिन)${R}`, 'iu')

const PRIORITY_RE = new RegExp(`${L}(${alternation(Object.keys(PRIORITY_WORDS))})${R}`, 'iu')

function clockTo24(hour, minute, period) {
  let h = Number(hour) % 12
  if (period === 'pm') h += 12
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

// No period word was spoken. Small numbers are overwhelmingly evening in
// casual use ("5 baje milte hain"), larger ones morning.
function guessPeriod(hour) {
  const h = Number(hour) % 12
  // 7-11 read as morning; 12 and 1-6 read as afternoon/evening. Users who
  // mean otherwise say a period word ("raat 8 baje"), which wins over this.
  return h >= 7 && h <= 11 ? 'am' : 'pm'
}

function resolvePeriod(explicit, hour) {
  if (explicit) return PERIOD_WORDS[explicit.toLowerCase()]
  return guessPeriod(hour)
}

function dateFromOffset(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

// Next occurrence of a weekday. Saying a weekday name that matches today
// means the one coming up, not this morning.
function dateForWeekday(targetDay) {
  const d = new Date()
  const delta = (targetDay - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + delta)
  return toISODate(d)
}

function extractTime(text) {
  const remaining = text

  const bajkar = remaining.match(BAJKAR_RE)
  if (bajkar) {
    const hour = toNumber(bajkar[2])
    const minute = toNumber(bajkar[3])
    if (hour !== null && minute !== null) {
      return {
        time: clockTo24(hour, minute, resolvePeriod(bajkar[1], hour)),
        remaining: remaining.replace(bajkar[0], ' '),
      }
    }
  }

  const fraction = remaining.match(FRACTION_RE)
  if (fraction) {
    const spec = FRACTION_WORDS[fraction[2].toLowerCase()]
    const base = toNumber(fraction[3])
    if (spec && base !== null) {
      // paune shifts back an hour: "paune das" is 9:45, not 10:45.
      const hour = ((base + spec.hourShift + 11) % 12) + 1
      const period = resolvePeriod(fraction[1] || fraction[4], hour)
      return { time: clockTo24(hour, spec.minutes, period), remaining: remaining.replace(fraction[0], ' ') }
    }
  }

  const standalone = remaining.match(STANDALONE_RE)
  if (standalone) {
    const spec = STANDALONE_TIMES[standalone[2].toLowerCase()]
    const period = resolvePeriod(standalone[1], spec.hour)
    return { time: clockTo24(spec.hour, spec.minute, period), remaining: remaining.replace(standalone[0], ' ') }
  }

  const ampm = remaining.match(AMPM_RE)
  if (ampm) {
    return {
      time: clockTo24(ampm[1], ampm[2] || 0, ampm[3].toLowerCase()),
      remaining: remaining.replace(ampm[0], ' '),
    }
  }

  const baje = remaining.match(BAJE_RE)
  if (baje) {
    const hour = toNumber(baje[2])
    if (hour !== null) {
      return {
        time: clockTo24(hour, 0, resolvePeriod(baje[1] || baje[3], hour)),
        remaining: remaining.replace(baje[0], ' '),
      }
    }
  }

  const hour24 = remaining.match(HOUR24_RE)
  if (hour24) {
    return {
      time: `${hour24[1].padStart(2, '0')}:${hour24[2]}`,
      remaining: remaining.replace(hour24[0], ' '),
    }
  }

  return { time: '', remaining }
}

function extractDate(text) {
  const remaining = text

  const dateMonth = remaining.match(DATE_MONTH_RE)
  if (dateMonth) {
    const day = Number(dateMonth[1])
    const month = MONTHS[dateMonth[2].toLowerCase()]
    const now = new Date()
    let year = now.getFullYear()
    if (new Date(year, month, day) < new Date(now.getFullYear(), now.getMonth(), now.getDate())) year += 1
    return { date: toISODate(new Date(year, month, day)), remaining: remaining.replace(dateMonth[0], ' ') }
  }

  const tarikh = remaining.match(TARIKH_RE)
  if (tarikh) {
    const day = Number(tarikh[1])
    const now = new Date()
    let d = new Date(now.getFullYear(), now.getMonth(), day)
    // A date already past this month means they mean next month.
    if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      d = new Date(now.getFullYear(), now.getMonth() + 1, day)
    }
    return { date: toISODate(d), remaining: remaining.replace(tarikh[0], ' ') }
  }

  const nextPeriod = remaining.match(NEXT_PERIOD_RE)
  if (nextPeriod) {
    if (/mahin|month/i.test(nextPeriod[2])) {
      const d = new Date()
      d.setMonth(d.getMonth() + 1)
      return { date: toISODate(d), remaining: remaining.replace(nextPeriod[0], ' ') }
    }
    return { date: dateFromOffset(7), remaining: remaining.replace(nextPeriod[0], ' ') }
  }

  const relative = remaining.match(RELATIVE_RE)
  if (relative) {
    const n = toNumber(relative[1])
    if (n !== null) {
      const unit = relative[2].toLowerCase()
      const multiplier = /haft|week/.test(unit) ? 7 : /mahin|month/.test(unit) ? 30 : 1
      return { date: dateFromOffset(n * multiplier), remaining: remaining.replace(relative[0], ' ') }
    }
  }

  const dayWord = remaining.match(DAY_WORD_RE)
  if (dayWord) {
    const word = dayWord[1].toLowerCase()
    // "kal" is literally both yesterday and tomorrow; for a to-do app the
    // forward reading is the only useful one.
    const offset =
      word === 'tomorrow' || word === 'kal' || word === 'कल'
        ? 1
        : word === 'parso' || word === 'parson' || word === 'परसों'
          ? 2
          : word === 'narso'
            ? 3
            : 0
    return { date: dateFromOffset(offset), remaining: remaining.replace(dayWord[0], ' ') }
  }

  const weekday = remaining.match(WEEKDAY_RE)
  if (weekday) {
    return {
      date: dateForWeekday(WEEKDAYS[weekday[2].toLowerCase()]),
      remaining: remaining.replace(weekday[0], ' '),
    }
  }

  return { date: todayISO(), remaining }
}

function extractRecurrence(text) {
  const remaining = text

  const weekdayRecur = remaining.match(RECUR_WEEKDAY_RE)
  if (weekdayRecur) {
    return {
      recurrence: 'custom',
      recurrenceDays: [WEEKDAYS[weekdayRecur[1].toLowerCase()]],
      remaining: remaining.replace(weekdayRecur[0], ' '),
    }
  }

  const monthly = remaining.match(RECUR_MONTHLY_RE)
  if (monthly) return { recurrence: 'monthly', recurrenceDays: [], remaining: remaining.replace(monthly[0], ' ') }

  const weekly = remaining.match(RECUR_WEEKLY_RE)
  if (weekly) return { recurrence: 'weekly', recurrenceDays: [], remaining: remaining.replace(weekly[0], ' ') }

  const daily = remaining.match(RECUR_DAILY_RE)
  if (daily) return { recurrence: 'daily', recurrenceDays: [], remaining: remaining.replace(daily[0], ' ') }

  return { recurrence: 'none', recurrenceDays: [], remaining }
}

// Filler words that carry no task meaning once date/time have been pulled out.
// Built with the same script-agnostic delimiters as everything else: JS \b is
// defined on [A-Za-z0-9_] and so never matches beside Devanagari, which is why
// "15 तारीख को बिजली का बिल" used to keep its stray को.
const FILLER_WORDS = [
  'karna hai', 'karni hai', 'karna', 'karni', 'hai', 'ko', 'par', 'pe', 'me', 'mein', 'mujhe',
  'remind', 'reminder', 'set', 'add',
  'करना है', 'करनी है', 'करना', 'करनी', 'है', 'को', 'पर', 'पे', 'में', 'मुझे',
]
const FILLER_RE = new RegExp(`(?:^|[\\s,.])(?:${alternation(FILLER_WORDS)})(?=$|[\\s,.!?])`, 'giu')

export function parseVoiceCommand(rawTranscript) {
  const transcript = normalizeDigits(rawTranscript.trim())

  // Recurrence runs first: "har somvaar" would otherwise be eaten by the
  // plain weekday matcher and collapse into a one-off date.
  const rec = extractRecurrence(transcript)
  const timeResult = extractTime(rec.remaining)
  const dateResult = extractDate(timeResult.remaining)

  let remaining = dateResult.remaining

  let priority = 'none'
  const priorityMatch = remaining.match(PRIORITY_RE)
  if (priorityMatch) {
    priority = PRIORITY_WORDS[priorityMatch[1].toLowerCase()]
    remaining = remaining.replace(priorityMatch[0], ' ')
  }

  const category = inferCategory(transcript)

  const title = remaining
    .replace(FILLER_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.\-—]+|[\s,.\-—]+$/g, '')
    .trim()

  return {
    title: title ? title[0].toUpperCase() + title.slice(1) : '',
    date: dateResult.date,
    time: timeResult.time,
    category,
    recurrence: rec.recurrence,
    recurrenceDays: rec.recurrenceDays,
    priority,
  }
}

// How much structure we managed to pull out of a transcript. Used to pick
// between competing speech-recognition alternatives — the candidate that
// yields a real title plus a time/date is almost always the right one.
export function parseConfidence(rawTranscript) {
  const parsed = parseVoiceCommand(rawTranscript)
  let score = 0
  if (parsed.title) score += 1
  if (parsed.time) score += 2
  if (parsed.date !== todayISO()) score += 1
  if (parsed.recurrence !== 'none') score += 1
  if (parsed.priority !== 'none') score += 0.5
  return score
}
