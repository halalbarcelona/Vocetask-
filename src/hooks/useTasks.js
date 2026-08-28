import { useCallback, useEffect, useRef, useState } from 'react'
import { todayISO } from '../utils/dateUtils'
import { supabase, supabaseConfigured } from '../lib/supabaseClient'
import { buildSnapshot, diffForPush, mergeRemoteIntoLocal, snapshotKey } from '../utils/sync'

const STORAGE_KEY = 'aura-tasks'
const SNAPSHOT_KEY = 'aura-sync-snapshot'
// Debounces the push side of sync so a burst of local changes (bulk actions,
// undo-then-redo) coalesces into one network round trip reflecting the final
// state, rather than one call per intermediate change.
const PUSH_DEBOUNCE_MS = 800

// Fills in every field a task is expected to have. Data can arrive from an
// older build, a hand-edited backup, or a restore of a file we didn't write —
// and a single missing `category` used to crash the whole app, since
// CategoryChip calls .toLowerCase() on it.
function normalizeTask(task) {
  if (!task || typeof task !== 'object') return null
  return {
    id: task.id ?? generateId(),
    title: typeof task.title === 'string' ? task.title : '',
    date: typeof task.date === 'string' ? task.date : '',
    time: typeof task.time === 'string' ? task.time : '',
    category: typeof task.category === 'string' && task.category ? task.category : 'Personal',
    done: Boolean(task.done),
    createdAt: task.createdAt ?? new Date().toISOString(),
    order: Number.isFinite(task.order) ? task.order : 24 * 60,
    recurrence: task.recurrence ?? 'none',
    recurrenceDays: Array.isArray(task.recurrenceDays) ? task.recurrenceDays : [],
    completedDates: Array.isArray(task.completedDates) ? task.completedDates : [],
    subtasks: Array.isArray(task.subtasks) ? task.subtasks.filter(Boolean) : [],
    priority: task.priority ?? 'none',
    notes: typeof task.notes === 'string' ? task.notes : '',
    reminderLeadMinutes: Number.isFinite(task.reminderLeadMinutes) ? task.reminderLeadMinutes : 0,
    labels: Array.isArray(task.labels) ? task.labels.filter((l) => typeof l === 'string' && l) : [],
    // Groups a task within its own list (e.g. "Work" / "Doing"), the way
    // Todoist sections group tasks within a project. Empty means ungrouped.
    section: typeof task.section === 'string' ? task.section : '',
    durationMinutes: Number.isFinite(task.durationMinutes) ? task.durationMinutes : 0,
    // Device-local only — deliberately left out of toRemoteRow/fromRemoteRow
    // below, so it never rides along in the sync payload.
    voiceNote: typeof task.voiceNote === 'string' ? task.voiceNote : null,
    // When a one-off task was actually marked done — distinct from its due
    // `date`, which is when it was supposed to happen. Weekly Review needs
    // the former; using the latter would count a task finished today but
    // overdue from last week as "completed last week". Local-only for now,
    // same reasoning as voiceNote: additive fields ride for free locally,
    // but going into the sync payload means a live schema migration, which
    // this pass is deliberately not risking unsupervised.
    completedAt: typeof task.completedAt === 'string' ? task.completedAt : null,
    // Minutes actually spent, accumulated from completed Focus sessions —
    // separate from durationMinutes (the upfront estimate). Local-only, same
    // reasoning as voiceNote/completedAt.
    actualMinutes: Number.isFinite(task.actualMinutes) ? task.actualMinutes : 0,
    // Ids of other tasks that must be done before this one can be. Local-only
    // — a cross-device id could dangle if the referenced task hasn't synced
    // yet, and openBlockerFor already treats a missing id as resolved, so
    // nothing breaks by keeping this device-scoped for now.
    blockedBy: Array.isArray(task.blockedBy) ? task.blockedBy.filter((id) => typeof id === 'string') : [],
  }
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeTask).filter(Boolean)
  } catch {
    return []
  }
}

function loadSnapshot() {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

// Local (camelCase) <-> remote (snake_case) row shape. Kept as plain data
// conversion, no I/O — the actual network calls live in useTasks below.
function toRemoteRow(task, userId) {
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    date: task.date,
    time: task.time,
    category: task.category,
    done: task.done,
    created_at: task.createdAt,
    order_key: task.order,
    recurrence: task.recurrence,
    recurrence_days: task.recurrenceDays,
    completed_dates: task.completedDates,
    subtasks: task.subtasks,
    priority: task.priority,
    notes: task.notes,
    reminder_lead_minutes: task.reminderLeadMinutes,
    labels: task.labels,
    section: task.section,
    duration_minutes: task.durationMinutes,
  }
}

function fromRemoteRow(row) {
  return {
    ...normalizeTask({
      id: row.id,
      title: row.title,
      date: row.date,
      time: row.time,
      category: row.category,
      done: row.done,
      createdAt: row.created_at,
      order: row.order_key,
      recurrence: row.recurrence,
      recurrenceDays: row.recurrence_days,
      completedDates: row.completed_dates,
      subtasks: row.subtasks,
      priority: row.priority,
      notes: row.notes,
      reminderLeadMinutes: row.reminder_lead_minutes,
      labels: row.labels,
      section: row.section,
      durationMinutes: row.duration_minutes,
    }),
    _remoteUpdatedAt: row.updated_at,
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

// userId is optional. Without it (the default — no account has signed in to
// sync), this hook behaves exactly as it always has: local-only, no network
// calls of any kind. Passing a signed-in user's id turns on a pull-on-sign-in
// + debounced-push-on-every-change sync loop against Supabase, additive to
// the existing local persistence, which keeps working unchanged as the
// offline cache either way.
export function useTasks(userId) {
  const [tasks, setTasks] = useState(loadTasks)
  const [draftTask, setDraftTask] = useState(null)
  const [syncStatus, setSyncStatus] = useState('idle') // idle | syncing | synced | error
  const [syncError, setSyncError] = useState('')
  const tasksRef = useRef(tasks)
  const snapshotRef = useRef(loadSnapshot())
  const pushTimerRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
    tasksRef.current = tasks
  }, [tasks])

  const persistSnapshot = useCallback((next) => {
    snapshotRef.current = next
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next))
    } catch {
      // Non-fatal — worst case the next cycle re-derives it from scratch,
      // which just costs a few redundant upserts, not correctness.
    }
  }, [])

  // Pulls this user's rows, merges them against the current local list (see
  // utils/sync.js for the merge rule), and adopts the result as the new
  // local state. Runs once per sign-in — catching remote changes made while
  // this device was closed is what "open the app" is for; a second device
  // left open at the same time needs its own reopen to see updates too,
  // since there's no realtime subscription in this first version.
  const pullAndMerge = useCallback(async () => {
    if (!userId || !supabaseConfigured) return
    setSyncStatus('syncing')
    try {
      const { data, error } = await supabase.from('tasks').select('*').eq('user_id', userId)
      if (error) throw error
      const rows = data ?? []
      const remoteTasks = rows.map(fromRemoteRow)
      const merged = mergeRemoteIntoLocal(tasksRef.current, remoteTasks, snapshotRef.current)
      const remoteUpdatedAtById = Object.fromEntries(rows.map((row) => [row.id, row.updated_at]))
      // Snapshot is written before setTasks so the debounced push effect
      // that fires from this same state change sees the post-merge snapshot,
      // not the pre-pull one — otherwise it would immediately re-upload
      // whatever the merge just adopted from the server.
      persistSnapshot(buildSnapshot(merged, remoteUpdatedAtById))
      setTasks(merged)
      setSyncStatus('synced')
      setSyncError('')
    } catch (err) {
      setSyncStatus('error')
      setSyncError(err?.message ?? 'Sync failed')
    }
  }, [userId, persistSnapshot])

  const pushChanges = useCallback(
    async (currentTasks) => {
      if (!userId || !supabaseConfigured) return
      const { upserts, deletes } = diffForPush(currentTasks, snapshotRef.current)
      if (upserts.length === 0 && deletes.length === 0) return

      setSyncStatus('syncing')
      try {
        if (upserts.length > 0) {
          const { data, error } = await supabase
            .from('tasks')
            .upsert(
              upserts.map((task) => toRemoteRow(task, userId)),
              { onConflict: 'id' },
            )
            .select('id, updated_at')
          if (error) throw error
          const next = { ...snapshotRef.current }
          for (const row of data ?? []) {
            const task = currentTasks.find((t) => t.id === row.id)
            if (task) next[row.id] = { remoteUpdatedAt: row.updated_at, localJSON: snapshotKey(task) }
          }
          persistSnapshot(next)
        }
        if (deletes.length > 0) {
          const { error } = await supabase.from('tasks').delete().in('id', deletes)
          if (error) throw error
          const next = { ...snapshotRef.current }
          for (const id of deletes) delete next[id]
          persistSnapshot(next)
        }
        setSyncStatus('synced')
        setSyncError('')
      } catch (err) {
        setSyncStatus('error')
        setSyncError(err?.message ?? 'Sync failed')
      }
    },
    [userId, persistSnapshot],
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (userId) pullAndMerge()
  }, [userId])

  useEffect(() => {
    if (!userId) return undefined
    clearTimeout(pushTimerRef.current)
    pushTimerRef.current = setTimeout(() => pushChanges(tasks), PUSH_DEBOUNCE_MS)
    return () => clearTimeout(pushTimerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, userId])

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
      labels: task.labels ?? [],
      section: task.section ?? '',
      durationMinutes: task.durationMinutes ?? 0,
      voiceNote: task.voiceNote ?? null,
      completedAt: task.done ? new Date().toISOString() : null,
      blockedBy: task.blockedBy ?? [],
    }
    setTasks((prev) => [...prev, newTask])
    return newTask
  }, [])

  const updateTask = useCallback((id, updates) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        // Any path that flips `done` — Confirm's edit form, Board's drag —
        // gets the same completedAt bookkeeping as toggleDone, so Weekly
        // Review sees an accurate completion date regardless of which
        // screen someone completed the task from.
        if (!('done' in updates) || updates.done === t.done) return { ...t, ...updates }
        return { ...t, ...updates, completedAt: updates.done ? new Date().toISOString() : null }
      }),
    )
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
          const date = forDate ?? todayISO()
          const dates = t.completedDates ?? []
          const has = dates.includes(date)
          return { ...t, completedDates: has ? dates.filter((d) => d !== date) : [...dates, date] }
        }
        const done = !t.done
        return { ...t, done, completedAt: done ? new Date().toISOString() : null }
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
      const additions = importedTasks
        .map(normalizeTask)
        .filter((t) => t && !existingIds.has(t.id))
      return [...prev, ...additions]
    })
  }, [])

  const bulkRemoveTasks = useCallback((ids) => {
    const idSet = new Set(ids)
    setTasks((prev) => prev.filter((t) => !idSet.has(t.id)))
  }, [])

  const bulkMarkDone = useCallback((ids) => {
    const idSet = new Set(ids)
    const today = todayISO()
    setTasks((prev) =>
      prev.map((t) => {
        if (!idSet.has(t.id)) return t
        if (t.recurrence && t.recurrence !== 'none') {
          const dates = t.completedDates ?? []
          return dates.includes(today) ? t : { ...t, completedDates: [...dates, today] }
        }
        return t.done ? t : { ...t, done: true, completedAt: new Date().toISOString() }
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
    syncStatus,
    syncError,
    syncNow: pullAndMerge,
  }
}
