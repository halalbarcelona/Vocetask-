const RESCHEDULE_PATTERNS = [/^(?:move|reschedule|push)\s+(.+?)\s+to\s+(today|tomorrow)$/i]

const COMPLETE_PATTERNS = [
  /^mark\s+(.+?)\s+as\s+(?:done|complete|completed|finished)\s*$/i,
  /^mark\s+(.+?)\s+(?:done|complete|completed|finished)\s*$/i,
  /^(?:complete|finish)\s+(.+)$/i,
]

const DELETE_PATTERNS = [/^(?:delete|remove|cancel)\s+(.+)$/i]

// Distinguishes "manage an existing task by voice" commands ("mark call mom
// as done", "delete groceries", "move meeting to tomorrow") from a plain
// new-task dictation, which falls through as type: 'create'.
export function parseVoiceAction(rawTranscript) {
  const transcript = rawTranscript.trim()

  for (const re of RESCHEDULE_PATTERNS) {
    const match = transcript.match(re)
    if (match) return { type: 'reschedule', phrase: match[1].trim(), newDay: match[2].toLowerCase() }
  }
  for (const re of COMPLETE_PATTERNS) {
    const match = transcript.match(re)
    if (match) return { type: 'complete', phrase: match[1].trim() }
  }
  for (const re of DELETE_PATTERNS) {
    const match = transcript.match(re)
    if (match) return { type: 'delete', phrase: match[1].trim() }
  }
  return { type: 'create' }
}

const STOPWORDS = new Set(['the', 'a', 'an', 'my', 'that', 'this', 'one'])

function normalize(s) {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .join(' ')
    .trim()
}

// Fuzzy-matches a spoken phrase ("call mom", "the groceries one") against
// existing task titles. Exact/substring matches win outright; otherwise
// picks the task with the highest word-overlap ratio, if any clears 40%.
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
      score = overlap / Math.max(phraseWords.size, titleWords.size)
    }

    if (score > bestScore) {
      bestScore = score
      best = task
    }
  }

  return bestScore >= 0.4 ? best : null
}
