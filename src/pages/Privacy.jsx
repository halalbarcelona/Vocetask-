import { useNavigate } from 'react-router-dom'
import { BackIcon } from '../components/icons'

export default function Privacy() {
  const navigate = useNavigate()

  return (
    <div className="screen">
      <header className="page-header">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Go back">
          <BackIcon />
        </button>
        <h1 className="page-header__title">Privacy Policy</h1>
        <span className="icon-button icon-button--spacer" />
      </header>

      <main className="screen__content">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <p className="field__label">Your data stays on this device</p>
            <p className="record-hint">
              Aura Task stores your account, tasks, and settings only in this browser's local
              storage. Nothing is uploaded to a server, and there is no account database — deleting
              your account or clearing your browser data removes it for good.
            </p>
          </div>

          <div>
            <p className="field__label">Voice input</p>
            <p className="record-hint">
              When you record a task by voice, audio is processed by your browser's built-in speech
              recognition. Aura Task itself never stores or transmits your audio.
            </p>
          </div>

          <div>
            <p className="field__label">Payments</p>
            <p className="record-hint">
              Upgrading to Premium hands off to Stripe's secure checkout. Aura Task does not see or
              store your card details — Stripe handles that entirely.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
