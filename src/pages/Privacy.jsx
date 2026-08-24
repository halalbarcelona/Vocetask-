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
        <h1 className="page-header__title">Privacy policy</h1>
        <span className="icon-button icon-button--spacer" />
      </header>

      <main className="screen__content">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <p className="field__label">Your tasks stay on this device</p>
            <p className="record-hint">
              Aura Task stores your tasks, categories, labels, and settings only in this browser's
              local storage. They're never uploaded or backed up anywhere — deleting your account or
              clearing your browser data removes them for good.
            </p>
          </div>

          <div>
            <p className="field__label">Your account</p>
            <p className="record-hint">
              Your name and email are also stored locally, on this device only. If you upgrade to
              Premium, your email is sent to our backend so it can confirm your purchase — that's the
              only account data that ever leaves this device, and it's stored separately from your
              tasks, which our backend never sees.
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
