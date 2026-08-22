import { createContext, useContext } from 'react'
import { useCategories } from './useCategories'

const CategoriesContext = createContext(null)

export function CategoriesProvider({ children }) {
  const value = useCategories()
  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>
}

export function useCategoriesContext() {
  const ctx = useContext(CategoriesContext)
  if (!ctx) throw new Error('useCategoriesContext must be used within a CategoriesProvider')
  return ctx
}
