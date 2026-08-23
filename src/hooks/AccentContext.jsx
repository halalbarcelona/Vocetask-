import { createContext, useContext } from 'react'
import { useAccent } from './useAccent'

const AccentContext = createContext(null)

export function AccentProvider({ children }) {
  const value = useAccent()
  return <AccentContext.Provider value={value}>{children}</AccentContext.Provider>
}

export function useAccentContext() {
  const ctx = useContext(AccentContext)
  if (!ctx) throw new Error('useAccentContext must be used within an AccentProvider')
  return ctx
}
