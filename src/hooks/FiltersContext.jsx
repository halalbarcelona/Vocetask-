import { createContext, useContext } from 'react'
import { useFilters } from './useFilters'

const FiltersContext = createContext(null)

export function FiltersProvider({ children }) {
  const value = useFilters()
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
}

export function useFiltersContext() {
  const ctx = useContext(FiltersContext)
  if (!ctx) throw new Error('useFiltersContext must be used within a FiltersProvider')
  return ctx
}
