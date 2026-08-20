import { createContext, useContext } from 'react'
import { useAccount } from './useAccount'

const AccountContext = createContext(null)

export function AccountProvider({ children }) {
  const value = useAccount()
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccountContext() {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccountContext must be used within an AccountProvider')
  return ctx
}
