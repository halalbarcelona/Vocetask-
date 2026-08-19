import { createContext, useContext } from 'react'
import { useTasks } from './useTasks'

const TasksContext = createContext(null)

export function TasksProvider({ children }) {
  const value = useTasks()
  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
}

export function useTasksContext() {
  const ctx = useContext(TasksContext)
  if (!ctx) throw new Error('useTasksContext must be used within a TasksProvider')
  return ctx
}
