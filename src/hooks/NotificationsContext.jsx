import { createContext, useContext } from 'react'
import { useNotifications } from './useNotifications'
import { usePushNotifications } from './usePushNotifications'
import { useTasksContext } from './TasksContext'

const NotificationsContext = createContext(null)

// Mounted once at the app root (see App.jsx) rather than inside Settings —
// useNotifications schedules setTimeout-based reminders in a useEffect, and a
// hook only lives as long as the component that calls it. Calling it from
// Settings meant every scheduled reminder was cancelled the instant the user
// navigated away from the Settings screen, which is the normal case: nobody
// leaves Settings open. Reminders never actually fired.
export function NotificationsProvider({ children }) {
  const { tasks } = useTasksContext()
  const inTab = useNotifications(tasks)
  const push = usePushNotifications()
  return <NotificationsContext.Provider value={{ inTab, push }}>{children}</NotificationsContext.Provider>
}

export function useNotificationsContext() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotificationsContext must be used within a NotificationsProvider')
  return ctx
}
