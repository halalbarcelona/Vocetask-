import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const CommandPaletteContext = createContext(null)

export function CommandPaletteProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((v) => !v), [])

  // Ctrl/Cmd+K from anywhere — including while a text input is focused,
  // matching every other app that uses this shortcut (Linear, Notion, VS
  // Code). Every other key is left alone so it never steals typing.
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <CommandPaletteContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </CommandPaletteContext.Provider>
  )
}

export function useCommandPaletteContext() {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) throw new Error('useCommandPaletteContext must be used within a CommandPaletteProvider')
  return ctx
}
