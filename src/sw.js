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
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Tapping the notification should bring an existing tab to the front rather
// than always spawning a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/Vocetask-/') && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow('/Vocetask-/')
      return undefined
    }),
  )
})
