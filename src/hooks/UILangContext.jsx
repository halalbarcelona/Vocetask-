import { createContext, useContext } from 'react'
import { useUILang } from './useUILang'

const UILangContext = createContext(null)

export function UILangProvider({ children }) {
  const value = useUILang()
  return <UILangContext.Provider value={value}>{children}</UILangContext.Provider>
}

export function useUILangContext() {
  const ctx = useContext(UILangContext)
  if (!ctx) throw new Error('useUILangContext must be used within a UILangProvider')
  return ctx
}
