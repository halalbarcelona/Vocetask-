import { createContext, useContext } from 'react'
import { useLabels } from './useLabels'

const LabelsContext = createContext(null)

export function LabelsProvider({ children }) {
  const value = useLabels()
  return <LabelsContext.Provider value={value}>{children}</LabelsContext.Provider>
}

export function useLabelsContext() {
  const ctx = useContext(LabelsContext)
  if (!ctx) throw new Error('useLabelsContext must be used within a LabelsProvider')
  return ctx
}
