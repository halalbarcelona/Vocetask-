function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Todoist-style typed shorthand: #List, @label, !priority. Tokens are only
// ever matched against names that already exist — an unrecognized tag is left
// as literal title text rather than silently creating a category or label,
// which would let a free account route around the Premium gate on creating
// either of those through the UI.
export function parseQuickAddSyntax(text, { categories = [], labels = [] } = {}) {
  let title = text
  let category = null
  const foundLabels = []
  let priority = null

  for (const name of [...categories].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`#${escapeRegExp(name)}(?=\\s|$)`, 'i')
    if (re.test(title)) {
      category = name
      title = title.replace(re, ' ')
      break
    }
  }

  for (const name of [...labels].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`@${escapeRegExp(name)}(?=\\s|$)`, 'i')
    if (re.test(title)) {
      foundLabels.push(name)
      title = title.replace(re, ' ')
    }
  }

  const priorityMatch = title.match(/!(high|medium|low)\b/i)
  if (priorityMatch) {
    priority = priorityMatch[1].toLowerCase()
    title = title.replace(priorityMatch[0], ' ')
  }

  return {
    title: title.replace(/\s+/g, ' ').trim(),
    category,
    labels: foundLabels,
    priority,
  }
}
