import { precacheAndRoute } from 'workbox-precaching'

// The app shell, same as before — injectManifest just means this file is
// hand-written instead of auto-generated, so it can also handle push events
// below. self.__WB_MANIFEST is replaced at build time with the real file list.
precacheAndRoute(self.__WB_MANIFEST)

// registerType is 'prompt' (see vite.config.js / UpdatePrompt.jsx) — the app
// decides when to activate a waiting worker, via this message, rather than
// the worker skipping waiting on its own the moment it's installed.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// The whole reason this app needs a custom service worker at all: a push
// message can arrive with no page open anywhere, so the *worker* is what has
// to show the notification, not any in-page JavaScript.
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'Aura Task'
  const options = {
    body: payload.body || '',
    icon: '/Vocetask-/icons/icon-192.png',
    badge: '/Vocetask-/icons/icon-192.png',
    data: { taskId: payload.taskId || null },
  }

  // Premium-only: the server (send-reminders) decides this, not the
  // client — a push payload is whatever the server put in it, so gating
  // happens there, not by checking premium state here.
  if (payload.premium && payload.taskId) {
    options.actions = [
      { action: 'done', title: 'Mark done' },
      { action: 'snooze', title: 'Snooze 10m' },
    ]
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Tapping the notification (or one of its action buttons) should bring an
// existing tab to the front rather than always spawning a new one. An
// action button routes through /quick-action so the mutation happens
// without the person having to find and tap the task themselves — the
// service worker has no authenticated Supabase session of its own to make
// the change directly, so opening/focusing the app (which does) is the
// only reliable way to act on it.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const { taskId } = event.notification.data || {}
  const path =
    event.action && taskId
      ? `/Vocetask-/quick-action?task=${encodeURIComponent(taskId)}&action=${event.action}`
      : '/Vocetask-/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/Vocetask-/') && 'focus' in client) {
          client.postMessage({ type: 'QUICK_ACTION', taskId, action: event.action })
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(path)
      return undefined
    }),
  )
})
