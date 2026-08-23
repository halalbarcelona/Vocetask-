import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccountContext } from '../hooks/AccountContext'
import { UserIcon } from '../components/icons'

export default function CreateAccount() {
  const navigate = useNavigate()
  const { createAccount } = useAccountContext()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const canSubmit = name.trim().length > 0 && email.trim().length > 0

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canSubmit) return
    createAccount({ name, email })
    navigate('/', { replace: true })
  }

  return (
    <div className="screen">
      <main className="screen__content screen__content--center" style={{ paddingTop: 56 }}>
        <div className="paywall-hero__icon">
          <UserIcon />
        </div>
        <h1 className="paywall-hero__title">Welcome to Aura Task</h1>
        <p className="paywall-hero__subtitle">
          Create your account and every Premium feature is yours free for 7 days — no card needed.
        </p>

        <form className="card confirm-card" style={{ width: '100%', textAlign: 'left' }} onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">Name</span>
            <input
              type="text"
              className="field__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </label>

          <label className="field">
            <span className="field__label">Email</span>
            <input
              type="email"
              className="field__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <button type="submit" className="button button--primary button--wide" disabled={!canSubmit}>
            Create account
          </button>
        </form>

        <p className="record-hint" style={{ marginTop: 4 }}>
          Everything stays on this device — no data leaves your browser except when you upgrade.
        </p>
      </main>
    </div>
  )
}
