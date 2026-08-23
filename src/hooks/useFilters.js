import { useCallback, useEffect, useState } from 'react'
import { emptyCriteria } from '../utils/filters'

const STORAGE_KEY = 'aura-filters'

function generateId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `filter-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function loadFilters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((f) => f && typeof f.name === 'string')
      .map((f) => ({ id: f.id ?? generateId(), name: f.name, criteria: { ...emptyCriteria(), ...f.criteria } }))
  } catch {
    return []
  }
}

export function useFilters() {
  const [filters, setFilters] = useState(loadFilters)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
  }, [filters])

  const saveFilter = useCallback((name, criteria, id) => {
    setFilters((prev) => {
      if (id && prev.some((f) => f.id === id)) {
        return prev.map((f) => (f.id === id ? { ...f, name, criteria } : f))
      }
      return [...prev, { id: generateId(), name, criteria }]
    })
  }, [])

  const removeFilter = useCallback((id) => {
    setFilters((prev) => prev.filter((f) => f.id !== id))
  }, [])

  return { filters, saveFilter, removeFilter }
}
