import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'aura-categories'
const DEFAULT_CATEGORIES = ['Personal', 'Work']

function loadCategories() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CATEGORIES
  } catch {
    return DEFAULT_CATEGORIES
  }
}

export function useCategories() {
  const [categories, setCategories] = useState(loadCategories)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories))
  }, [categories])

  const addCategory = useCallback((name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setCategories((prev) => (prev.some((c) => c.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed]))
  }, [])

  const removeCategory = useCallback((name) => {
    setCategories((prev) => (prev.length > 1 ? prev.filter((c) => c !== name) : prev))
  }, [])

  return { categories, addCategory, removeCategory }
}
