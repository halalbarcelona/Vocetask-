import { createContext, useContext } from 'react'
import { usePremium } from './usePremium'

const PremiumContext = createContext(null)

export function PremiumProvider({ children }) {
  const value = usePremium()
  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>
}

export function usePremiumContext() {
  const ctx = useContext(PremiumContext)
  if (!ctx) throw new Error('usePremiumContext must be used within a PremiumProvider')
  return ctx
}
