import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'aura-categories'

// Personal/Work keep their existing signature colors (the same greens/oranges
// already used for their chips and the checkbox priority rings) so upgrading
// this hook never visibly changes the two categories almost every account
// already has. Anything else cycles through this palette, same as labels.
const DEFAULT_COLORS = { Personal: '#2f7d5b', Work: '#b4530f' }
const PALETTE = ['#4b3fd4', '#1f7a8c', '#8a7a1a', '#8e3f9e', '#b5406a', '#2f7d5b', '#b4530f', '#c8372b']

const DEFAULT_CATEGORIES = [
  { name: 'Personal', color: DEFAULT_COLORS.Personal },
  { name: 'Work', color: DEFAULT_COLORS.Work },
]

function colorFor(name, index) {
  return DEFAULT_COLORS[name] ?? PALETTE[index % PALETTE.length]
}

// Reads either shape: the original plain string[] this key used to hold, or
// the {name, color}[] shape it holds now — so nobody's existing categories
// (or their tasks, which reference these by name only) are lost on upgrade.
function loadCategories() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CATEGORIES
    return parsed.map((entry, i) =>
      typeof entry === 'string'
        ? { name: entry, color: colorFor(entry, i) }
        : { name: entry.name, color: entry.color ?? colorFor(entry.name, i) },
    )
  } catch {
    return DEFAULT_CATEGORIES
  }
}

export function useCategories() {
  const [categoryList, setCategoryList] = useState(loadCategories)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categoryList))
  }, [categoryList])

  const addCategory = useCallback((name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setCategoryList((prev) =>
      prev.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())
        ? prev
        : [...prev, { name: trimmed, color: colorFor(trimmed, prev.length) }],
    )
  }, [])

  const removeCategory = useCallback((name) => {
    setCategoryList((prev) => (prev.length > 1 ? prev.filter((c) => c.name !== name) : prev))
  }, [])

  const colorForCategory = useCallback(
    (name) => categoryList.find((c) => c.name.toLowerCase() === (name ?? '').toLowerCase())?.color ?? '#8a8a94',
    [categoryList],
  )

  // Every existing caller (Confirm's category picker, quick-add parsing,
  // filters, stats) only ever needed the name — keeping this a plain
  // string[] means none of them need to change.
  return {
    categories: categoryList.map((c) => c.name),
    addCategory,
    removeCategory,
    colorForCategory,
  }
}
