import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useToast } from '../hooks/useToast'
import Toast from './Toast'

// registerType is 'prompt' (see vite.config.js) specifically so a new build
// never silently takes over mid-session — the user sees this and chooses
// when to reload, rather than the app swapping itself under their feet.
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export default function UpdatePrompt() {
  const { toast, showToast, dismissToast } = useToast()
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!needRefresh) return
    showToast('A new version of Aura Task is ready.', {
      actionLabel: 'Refresh',
      onAction: () => updateServiceWorker(true),
      duration: ONE_DAY_MS,
    })
  }, [needRefresh, showToast, updateServiceWorker])

  return <Toast toast={toast} onDismiss={dismissToast} />
}
