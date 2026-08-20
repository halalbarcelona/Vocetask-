import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'aura-account'

function loadAccount() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function useAccount() {
  const [account, setAccount] = useState(loadAccount)

  useEffect(() => {
    if (account) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(account))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [account])

  const createAccount = useCallback(({ name, email }) => {
    setAccount({ name: name.trim(), email: email.trim() })
  }, [])

  const updateAccount = useCallback((updates) => {
    setAccount((prev) => (prev ? { ...prev, ...updates } : prev))
  }, [])

  const logOut = useCallback(() => setAccount(null), [])

  return {
    account,
    hasAccount: Boolean(account),
    createAccount,
    updateAccount,
    logOut,
  }
}
