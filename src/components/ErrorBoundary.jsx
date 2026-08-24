import { Component } from 'react'
import { LockIcon } from './icons'

// Without this, any uncaught render error anywhere in the tree unmounts the
// whole app and leaves a blank white screen — the worst possible outcome for
// a to-do app someone opened mid-task. Catches it and offers a way back
// instead. Tasks themselves are never touched here; they live in
// localStorage independently of React's render tree, so a reload recovers
// them exactly as they were.
export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Aura Task crashed:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="screen">
        <main className="screen__content screen__content--center">
          <div className="empty-state">
            <LockIcon width={28} height={28} className="empty-state__icon" />
            <p>Something went wrong.</p>
            <p className="empty-state__hint">
              Your tasks are safe — they’re saved on this device. Reloading usually fixes this.
            </p>
            <button
              type="button"
              className="button button--primary"
              style={{ marginTop: 16 }}
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </main>
      </div>
    )
  }
}
