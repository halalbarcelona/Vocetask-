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

function defaultOrder(time) {
  if (!time) return 24 * 60
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
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
      createdAt: new Date().toISOString(),
      order: defaultOrder(task.time) + Math.random() * 0.01,
      recurrence: task.recurrence ?? 'none',
      recurrenceDays: task.recurrenceDays ?? [],
      completedDates: [],
      subtasks: task.subtasks ?? [],
      priority: task.priority ?? 'none',
      notes: task.notes ?? '',
      reminderLeadMinutes: task.reminderLeadMinutes ?? 0,
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

  // Re-inserts a full task object as-is (same id, fields) — pairs with
  // removeTask for an "Undo delete" affordance.
  const restoreTask = useCallback((task) => {
    setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [...prev, task]))
  }, [])

  const toggleDone = useCallback((id, forDate) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        if (t.recurrence && t.recurrence !== 'none') {
          const date = forDate ?? new Date().toISOString().slice(0, 10)
          const dates = t.completedDates ?? []
          const has = dates.includes(date)
          return { ...t, completedDates: has ? dates.filter((d) => d !== date) : [...dates, date] }
        }
        return { ...t, done: !t.done }
      }),
    )
  }, [])

  const reorderTask = useCallback((id, direction, siblingIds) => {
    setTasks((prev) => {
      const index = siblingIds.indexOf(id)
      const swapWith = direction === 'up' ? index - 1 : index + 1
      if (index === -1 || swapWith < 0 || swapWith >= siblingIds.length) return prev
      const otherId = siblingIds[swapWith]
      const byId = new Map(prev.map((t) => [t.id, t]))
      const a = byId.get(id)
      const b = byId.get(otherId)
      if (!a || !b) return prev
      return prev.map((t) => {
        if (t.id === id) return { ...t, order: b.order }
        if (t.id === otherId) return { ...t, order: a.order }
        return t
      })
    })
  }, [])

  const addSubtask = useCallback((taskId, title) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: [...(t.subtasks ?? []), { id: generateId(), title, done: false }] }
          : t,
      ),
    )
  }, [])

  const toggleSubtask = useCallback((taskId, subtaskId) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: (t.subtasks ?? []).map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)),
            }
          : t,
      ),
    )
  }, [])

  const removeSubtask = useCallback((taskId, subtaskId) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, subtasks: (t.subtasks ?? []).filter((s) => s.id !== subtaskId) } : t,
      ),
    )
  }, [])

  const clearDraft = useCallback(() => setDraftTask(null), [])

  const clearAllTasks = useCallback(() => setTasks([]), [])

  // Adds tasks from a backup file, skipping any id already present so a
  // restore can never silently overwrite or duplicate existing tasks.
  const importTasks = useCallback((importedTasks) => {
    setTasks((prev) => {
      const existingIds = new Set(prev.map((t) => t.id))
      const additions = importedTasks.filter((t) => t?.id && !existingIds.has(t.id))
      return [...prev, ...additions]
    })
  }, [])

  const bulkRemoveTasks = useCallback((ids) => {
    const idSet = new Set(ids)
    setTasks((prev) => prev.filter((t) => !idSet.has(t.id)))
  }, [])

  const bulkMarkDone = useCallback((ids) => {
    const idSet = new Set(ids)
    const today = new Date().toISOString().slice(0, 10)
    setTasks((prev) =>
      prev.map((t) => {
        if (!idSet.has(t.id)) return t
        if (t.recurrence && t.recurrence !== 'none') {
          const dates = t.completedDates ?? []
          return dates.includes(today) ? t : { ...t, completedDates: [...dates, today] }
        }
        return { ...t, done: true }
      }),
    )
  }, [])

  return {
    tasks,
    addTask,
    updateTask,
    removeTask,
    restoreTask,
    toggleDone,
    reorderTask,
    addSubtask,
    toggleSubtask,
    removeSubtask,
    draftTask,
    setDraftTask,
    clearDraft,
    clearAllTasks,
    importTasks,
    bulkRemoveTasks,
    bulkMarkDone,
  }
}
