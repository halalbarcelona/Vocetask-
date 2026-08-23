import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'aura-labels'

// Cycled through for whichever label gets created next, so users never have
// to pick a color themselves — Todoist does the same.
const PALETTE = ['#c8372b', '#b4530f', '#8a7a1a', '#2f7d5b', '#1f7a8c', '#4b3fd4', '#8e3f9e', '#b5406a']

function loadLabels() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((l) => l && typeof l.name === 'string') : []
  } catch {
    return []
  }
}

export function useLabels() {
  const [labels, setLabels] = useState(loadLabels)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(labels))
  }, [labels])

  // Registers a label if it isn't known yet, and returns its canonical name —
  // callers pass whatever a user typed, matching is case-insensitive so
  // "Urgent" and "urgent" are the same label.
  const addLabel = useCallback((name) => {
    const trimmed = name.trim()
    if (!trimmed) return null
    setLabels((prev) => {
      if (prev.some((l) => l.name.toLowerCase() === trimmed.toLowerCase())) return prev
      const color = PALETTE[prev.length % PALETTE.length]
      return [...prev, { name: trimmed, color }]
    })
    return trimmed
  }, [])

  const removeLabel = useCallback((name) => {
    setLabels((prev) => prev.filter((l) => l.name !== name))
  }, [])

  const colorFor = useCallback(
    (name) => labels.find((l) => l.name.toLowerCase() === name.toLowerCase())?.color ?? '#8a8a94',
    [labels],
  )

  return { labels, addLabel, removeLabel, colorFor }
}
