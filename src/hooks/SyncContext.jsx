import { createContext, useContext } from 'react'
import { useSync } from './useSync'

const SyncContext = createContext(null)

export function SyncProvider({ children }) {
  const value = useSync()
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSyncContext() {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSyncContext must be used within a SyncProvider')
  return ctx
}
