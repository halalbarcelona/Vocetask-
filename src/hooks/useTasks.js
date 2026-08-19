import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'aura-tasks'

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function generateId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `task-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function useTasks() {
  const [tasks, setTasks] = useState(loadTasks)
  const [draftTask, setDraftTask] = useState(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  const addTask = useCallback((task) => {
    const newTask = {
      id: generateId(),
      title: task.title ?? '',
      date: task.date ?? '',
      time: task.time ?? '',
      category: task.category ?? 'Personal',
      done: false,
    }
    setTasks((prev) => [...prev, newTask])
    return newTask
  }, [])

  const updateTask = useCallback((id, updates) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)))
  }, [])

  const removeTask = useCallback((id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toggleDone = useCallback((id) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }, [])

  const clearDraft = useCallback(() => setDraftTask(null), [])

  return {
    tasks,
    addTask,
    updateTask,
    removeTask,
    toggleDone,
    draftTask,
    setDraftTask,
    clearDraft,
  }
}
