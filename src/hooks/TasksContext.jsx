import { createContext, useContext } from 'react'
import { useTasks } from './useTasks'
import { useSyncContext } from './SyncContext'

const TasksContext = createContext(null)

export function TasksProvider({ children }) {
  // Requires SyncProvider as an ancestor — App.jsx nests them in that order.
  // A signed-out account passes userId: null through, and useTasks stays
  // exactly as local-only as it's always been.
  const { userId } = useSyncContext()
  const value = useTasks(userId)
  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
}

export function useTasksContext() {
  const ctx = useContext(TasksContext)
  if (!ctx) throw new Error('useTasksContext must be used within a TasksProvider')
  return ctx
}
