import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'aura-templates'

function generateId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `template-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function loadTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function useTemplates() {
  const [templates, setTemplates] = useState(loadTemplates)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  }, [templates])

  const saveTemplate = useCallback((task, name) => {
    const template = {
      id: generateId(),
      name: name?.trim() || task.title || 'Untitled template',
      title: task.title ?? '',
      category: task.category ?? 'Personal',
      time: task.time ?? '',
      recurrence: task.recurrence ?? 'none',
      recurrenceDays: task.recurrenceDays ?? [],
      priority: task.priority ?? 'none',
      subtasks: task.subtasks ?? [],
      notes: task.notes ?? '',
    }
    setTemplates((prev) => [...prev, template])
    return template
  }, [])

  const removeTemplate = useCallback((id) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { templates, saveTemplate, removeTemplate }
}
