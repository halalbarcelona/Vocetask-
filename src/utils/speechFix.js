// Repairs the specific ways a speech engine mangles Hinglish.
//
// Chrome's recogniser runs one acoustic+language model at a time. On en-IN it
// hears Hindi words and snaps them to the nearest English word it knows, and
// it does this *consistently*: "nau baje" comes back as "no budget", "kal
// subah" as "call suba". Those are not random errors, they are a small, stable
// substitution table — which means they can be undone offline, for free.
//
// The hard constraint is that a correction must never damage a transcript that
// was already right. "Call mummy" has to survive a rule that turns "call" into
// "kal". So every rule here is anchored to context that only occurs in a time
// or date expression: a number beside it, a period-of-day word after it, an
// explicit clock word. A rule that cannot be anchored is left out, however
// tempting — a wrong "fix" is worse than the original mis-hearing, because the
// user can at least see and edit the original.

// English number words, needed because the engine writes "nine" where the
// Hindi parser expects a numeral. Only ever applied next to a clock word.
const ENGLISH_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
}

const NUMBER_WORD = Object.keys(ENGLISH_NUMBERS).join('|')

// What the engine writes when it hears "baje". "budget" is the single most
// common one on en-IN; the rest are romanisation drift.
const BAJE_MISHEARD = 'budget|budge|bajay|bajey|bajji|baji|bache|bajje|bajke|badje|bhaje'

// Period-of-day words, in every spelling the engine produces. Used both as a
// correction target and as the anchor that makes the day-word rules safe.
const PERIOD_ANCHOR = 'subah|suba|subha|sub ah|soba|sawere|savere|morning|dopahar|do pahar|afternoon|shaam|sham|shame|evening|raat|raath|night'

// A rule is [pattern, replacement]. Order matters: earlier rules normalise the
// anchors that later rules depend on.
const RULES = [
  // --- clock word -----------------------------------------------------------
  // "9 budget" / "nau bajay" -> "9 baje". Anchored on a preceding number, which
  // is what makes it safe: a bare "budget" is left alone.
  [new RegExp(`(\\d{1,2}|${NUMBER_WORD}|ek|do|teen|char|chaar|panch|paanch|che|chhe|saat|aath|nau|das|gyarah|barah)\\s+(?:${BAJE_MISHEARD})\\b`, 'gi'),
    (_m, n) => `${n} baje`],

  // "bajkar" variants — "9 baj kar 20", "9 budget car 20".
  [/\b(\d{1,2})\s*(?:baj\s*kar|budget\s*car|baj\s*car)\s*(\d{1,2})\b/gi, '$1 bajkar $2'],

  // --- period of day --------------------------------------------------------
  [/\bsub\s?ah\b|\bsubha\b|\bsuba\b|\bsoba\b/gi, 'subah'],
  [/\bshame\b(?=\s+(?:ko|\d|ek|do|teen|char|panch|che|saat|aath|nau|das))/gi, 'shaam'],
  [/\bdo\s+pahar\b|\bdopeher\b/gi, 'dopahar'],
  [/\braath\b/gi, 'raat'],

  // --- day words ------------------------------------------------------------
  // "call subah" -> "kal subah". Anchored on a following period word: English
  // never says "call morning", so "Call mummy" and "call the bank" survive.
  [new RegExp(`\\bcall\\s+(?=(?:${PERIOD_ANCHOR})\\b)`, 'gi'), 'kal '],
  // "call ko 9 baje" — same word, anchored on a clock instead.
  [/\bcall\s+(?=\d{1,2}\s*baje\b)/gi, 'kal '],
  // "kaal"/"cal" are only ever "kal" — no English word collides.
  [/\bkaal\b|\bcaal\b/gi, 'kal'],
  // "parso" heard as a name or split in two.
  [/\bparsons\b|\bparson's\b|\bper\s?so\b|\bpar\s?so\b/gi, 'parso'],
  [/\bnar\s?so\b|\bnarson\b/gi, 'narso'],
  // "aaj" heard as the letter or as "age".
  [new RegExp(`\\baj\\s+(?=(?:${PERIOD_ANCHOR})\\b)`, 'gi'), 'aaj '],

  // --- fractional hours -----------------------------------------------------
  // These only ever precede an hour, so anchor them on a following number.
  [new RegExp(`\\b(?:swa|sava|sawa)\\s+(?=\\d|${NUMBER_WORD}|ek|do|teen|char|panch|che|saat|aath|nau|das)`, 'gi'), 'sawa '],
  [new RegExp(`\\b(?:sarhe|sadhey|saday|sadde|sathe)\\s+(?=\\d|${NUMBER_WORD}|ek|do|teen|char|panch|che|saat|aath|nau|das)`, 'gi'), 'sade '],
  [new RegExp(`\\b(?:pone|poune|puney)\\s+(?=(?:\\d|${NUMBER_WORD}|ek|do|teen|char|panch|che|saat|aath|nau|das)\\s*(?:baje|बजे))`, 'gi'), 'paune '],

  // --- recurrence -----------------------------------------------------------
  // "har roz" heard as "her rose" / "hair rose".
  [/\b(?:her|hair|hare)\s+(?=roz|rose|din|hafte|week|month|mahine)/gi, 'har '],
  [/\bhar\s+rose\b/gi, 'har roz'],
  [/\bhar\s+(?:hafta|hafte|after)\b/gi, 'har hafte'],
]

// Applied after the rules above, once the anchors are normalised: a number word
// sitting directly before a clock word becomes a numeral, because every time
// pattern in the parser is built around numerals.
const NUMBER_WORD_RE = new RegExp(`\\b(${NUMBER_WORD})\\b(?=\\s*(?:baje|बजे|am|pm|a\\.m\\.|p\\.m\\.|o'?clock))`, 'gi')

// "at 9 o'clock" / "at 9 pm" are already understood; "o'clock" on its own is
// not, and it means exactly what "baje" means.
// The leading "at" comes along, because the parser's baje pattern has no
// English preposition in it and would otherwise leave "at" stranded in the title.
const OCLOCK_RE = /\b(?:at\s+)?(\d{1,2})\s*o'?\s?clock\b/gi

/**
 * Rewrites a raw speech transcript into the form the parser expects.
 * Safe to call on text that needs no correction — it returns it unchanged.
 */
export function fixSpeech(rawTranscript) {
  if (!rawTranscript) return ''

  let text = String(rawTranscript)
  for (const [pattern, replacement] of RULES) {
    text = text.replace(pattern, replacement)
  }
  text = text.replace(NUMBER_WORD_RE, (_m, word) => String(ENGLISH_NUMBERS[word.toLowerCase()]))
  text = text.replace(OCLOCK_RE, '$1 baje')

  return text.replace(/\s+/g, ' ').trim()
}
