import { normalizeDigits, similarity } from './hinglish'

// Day words the reschedule patterns accept. The caller resolves these through
// the same date logic the task parser uses, so weekday names and Devanagari
// work here too — not just today/tomorrow.
const DAY_PHRASE =
  '(today|tonight|tomorrow|aaj|kal|parso|parson|narso|आज|कल|परसों|monday|tuesday|wednesday|thursday|friday|saturday|sunday|[a-z]+(?:vaar|var|war))'

// Hindi puts the verb at the end ("gym ka kaam ho gaya"); English puts it at
// the front ("mark gym as done"). Both shapes are covered, most-specific first.
const RESCHEDULE_PATTERNS = [
  new RegExp(`^(?:move|reschedule|push|shift)\\s+(.+?)\\s+to\\s+${DAY_PHRASE}$`, 'iu'),
  new RegExp(
    `^(.+?)\\s+(?:ko\\s+)?${DAY_PHRASE}\\s*(?:pe|par|ko)?\\s*(?:shift kar do|shift karo|kar do|karo|badal do|postpone)$`,
    'iu',
  ),
]

const COMPLETE_PATTERNS = [
  /^mark\s+(.+?)\s+as\s+(?:done|complete|completed|finished)\s*$/iu,
  /^mark\s+(.+?)\s+(?:done|complete|completed|finished)\s*$/iu,
  /^(?:complete|finish)\s+(.+)$/iu,
  // "gym ho gaya", "gym ka kaam ho gaya", "gym wala kar liya"
  /^(.+?)\s+(?:ho gaya|ho gayi|hogaya|kar liya|kar li|complete kar diya|हो गया|पूरा हो गया)\s*(?:hai)?\s*$/iu,
]

const DELETE_PATTERNS = [
  /^(?:delete|remove|cancel)\s+(.+)$/iu,
  // "gym hata do", "gym delete kar do", "gym cancel kar do"
  /^(.+?)\s+(?:ko\s+)?(?:hata do|hatao|mita do|delete kar do|delete karo|cancel kar do|cancel karo|remove kar do|हटा दो|मिटा दो)\s*$/iu,
]

// Distinguishes "manage an existing task by voice" commands from a plain
// new-task dictation, which falls through as type: 'create'.
export function parseVoiceAction(rawTranscript) {
  const transcript = normalizeDigits(rawTranscript.trim())

  for (const re of RESCHEDULE_PATTERNS) {
    const match = transcript.match(re)
    if (match?.[1]?.trim()) {
      return { type: 'reschedule', phrase: match[1].trim(), newDay: (match[2] || '').toLowerCase().trim() }
    }
  }

  for (const re of COMPLETE_PATTERNS) {
    const match = transcript.match(re)
    if (match?.[1]?.trim()) return { type: 'complete', phrase: match[1].trim() }
  }

  for (const re of DELETE_PATTERNS) {
    const match = transcript.match(re)
    if (match?.[1]?.trim()) return { type: 'delete', phrase: match[1].trim() }
  }

  return { type: 'create' }
}

// Words carrying no identifying weight when deciding which task was meant.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'my', 'that', 'this', 'one',
  'ka', 'ki', 'ke', 'ko', 'wala', 'wali', 'vala', 'kaam',
])

function normalize(s) {
  return normalizeDigits(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .join(' ')
    .trim()
}

// Fuzzy-matches a spoken phrase against existing task titles. Exact and
// substring matches win outright; otherwise we take the better of word
// overlap and edit-distance similarity, so a transcription near-miss
// ("call mummi" vs "Call mummy") still lands on the right task — word
// overlap alone scores that zero, since one wrong letter kills the match.
export function findBestMatchingTask(phrase, tasks) {
  const normPhrase = normalize(phrase)
  if (!normPhrase) return null
  const phraseWords = new Set(normPhrase.split(/\s+/).filter(Boolean))

  let best = null
  let bestScore = 0

  for (const task of tasks) {
    const normTitle = normalize(task.title)
    if (!normTitle) continue

    if (normTitle === normPhrase) return task

    let score
    if (normTitle.includes(normPhrase) || normPhrase.includes(normTitle)) {
      score = 0.9
    } else {
      const titleWords = new Set(normTitle.split(/\s+/).filter(Boolean))
      const overlap = [...phraseWords].filter((w) => titleWords.has(w)).length
      const overlapScore = overlap / Math.max(phraseWords.size, titleWords.size)
      score = Math.max(overlapScore, similarity(normPhrase, normTitle))
    }

    if (score > bestScore) {
      bestScore = score
      best = task
    }
  }

  return bestScore >= 0.5 ? best : null
}
