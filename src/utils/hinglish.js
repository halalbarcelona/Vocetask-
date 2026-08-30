// Shared Hinglish vocabulary for the voice parser and the voice-action
// parser. Everything here is plain data + pure helpers so both can reuse it,
// and so the whole engine stays free, offline and instant — no API calls.

// Devanagari digits map onto ASCII so the rest of the parser only ever sees
// western numerals.
const DEVANAGARI_DIGITS = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' }

// Spoken Hindi numbers, 1–12 (enough for clock hours) plus the common
// romanisation variants people actually type and that speech engines emit.
export const HINDI_NUMBERS = {
  ek: 1, एक: 1,
  do: 2, दो: 2,
  teen: 3, तीन: 3,
  char: 4, chaar: 4, चार: 4,
  panch: 5, paanch: 5, पांच: 5, पाँच: 5,
  che: 6, chhe: 6, chah: 6, छह: 6, छे: 6,
  saat: 7, सात: 7,
  aath: 8, आठ: 8,
  nau: 9, नौ: 9,
  das: 10, दस: 10,
  gyarah: 11, gyara: 11, ग्यारह: 11,
  barah: 12, bara: 12, बारह: 12,
}

// Weekday name → JS getDay() index.
export const WEEKDAYS = {
  sunday: 0, sun: 0, ravivaar: 0, ravivar: 0, itvaar: 0, itwar: 0, रविवार: 0,
  monday: 1, mon: 1, somvaar: 1, somvar: 1, somwar: 1, सोमवार: 1,
  tuesday: 2, tue: 2, mangalvaar: 2, mangalvar: 2, mangalwar: 2, मंगलवार: 2,
  wednesday: 3, wed: 3, budhvaar: 3, budhvar: 3, budhwar: 3, बुधवार: 3,
  thursday: 4, thu: 4, guruvaar: 4, guruvar: 4, guruwar: 4, brihaspativaar: 4, गुरुवार: 4,
  friday: 5, fri: 5, shukravaar: 5, shukravar: 5, shukrawar: 5, शुक्रवार: 5,
  saturday: 6, sat: 6, shanivaar: 6, shanivar: 6, shaniwar: 6, शनिवार: 6,
}

export const MONTHS = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
  september: 8, sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10,
  december: 11, dec: 11,
}

// Period-of-day words. Spoken Hindi has no am/pm, so these disambiguate the
// clock hour instead.
export const PERIOD_WORDS = {
  subah: 'am', savere: 'am', sawere: 'am', morning: 'am', सुबह: 'am', सवेरे: 'am',
  dopahar: 'pm', afternoon: 'pm', दोपहर: 'pm',
  shaam: 'pm', sham: 'pm', evening: 'pm', शाम: 'pm',
  raat: 'pm', night: 'pm', रात: 'pm',
}

// Fractional hour words: "sawa nau" = 9:15, "sade nau" = 9:30,
// "paune das" = 9:45 (a quarter *before* ten). dedh/dhai are standalone.
export const FRACTION_WORDS = {
  sawa: { minutes: 15, hourShift: 0 }, सवा: { minutes: 15, hourShift: 0 },
  sade: { minutes: 30, hourShift: 0 }, saade: { minutes: 30, hourShift: 0 },
  sadhe: { minutes: 30, hourShift: 0 }, साढ़े: { minutes: 30, hourShift: 0 },
  paune: { minutes: 45, hourShift: -1 }, पौने: { minutes: 45, hourShift: -1 },
}

// Standalone half-hour words that already encode their own hour.
export const STANDALONE_TIMES = {
  dedh: { hour: 1, minute: 30 }, डेढ़: { hour: 1, minute: 30 },
  dhai: { hour: 2, minute: 30 }, dhaai: { hour: 2, minute: 30 }, ढाई: { hour: 2, minute: 30 },
}

export const PRIORITY_WORDS = {
  urgent: 'high', zaroori: 'high', zaruri: 'high', जरूरी: 'high', ज़रूरी: 'high',
  important: 'high', asap: 'high', high: 'high', 'high priority': 'high',
  medium: 'medium', 'medium priority': 'medium', 'normal priority': 'medium',
  low: 'low', 'low priority': 'low', 'not urgent': 'low',
}

// Words that strongly imply a work context. Everything else stays Personal.
const WORK_HINTS = [
  'office', 'meeting', 'client', 'boss', 'project', 'deadline', 'report',
  'presentation', 'kaam', 'काम', 'ऑफिस', 'standup', 'interview', 'email', 'मीटिंग',
]

export function inferCategory(text) {
  const lower = text.toLowerCase()
  return WORK_HINTS.some((hint) => lower.includes(hint)) ? 'Work' : 'Personal'
}

// Converts Devanagari digits to ASCII and collapses whitespace, so every
// downstream regex only has to handle one numeral system.
export function normalizeDigits(text) {
  return text.replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS[d] ?? d).replace(/\s+/g, ' ')
}

// Resolves a spoken number word or numeral to an integer, or null.
export function toNumber(token) {
  if (!token) return null
  const cleaned = token.toLowerCase().trim()
  if (/^\d+$/.test(cleaned)) return Number(cleaned)
  return HINDI_NUMBERS[cleaned] ?? null
}

// Builds an alternation group from object keys, longest-first so that
// "saade" is tried before "sade" and never leaves a stray fragment behind.
export function alternation(keys) {
  return [...keys].sort((a, b) => b.length - a.length).join('|')
}

// Levenshtein distance, used to forgive speech-to-text near-misses when
// matching a spoken phrase to an existing task title.
export function editDistance(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    prev = curr
  }
  return prev[b.length]
}

// 0–1 similarity derived from edit distance.
export function similarity(a, b) {
  const longest = Math.max(a.length, b.length)
  return longest === 0 ? 1 : 1 - editDistance(a, b) / longest
}
