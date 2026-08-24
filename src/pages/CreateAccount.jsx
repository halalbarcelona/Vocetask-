import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccountContext } from '../hooks/AccountContext'
import { UserIcon } from '../components/icons'
import { markAccountJustCreated } from '../components/OnboardingTour'
import { useUILangContext } from '../hooks/UILangContext'

export default function CreateAccount() {
  const navigate = useNavigate()
  const { createAccount } = useAccountContext()
  const { t } = useUILangContext()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const canSubmit = name.trim().length > 0 && email.trim().length > 0

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canSubmit) return
    createAccount({ name, email })
    markAccountJustCreated()
    navigate('/', { replace: true })
  }

  return (
    <div className="screen">
      <main className="screen__content screen__content--center" style={{ paddingTop: 56 }}>
        <div className="paywall-hero__icon">
          <UserIcon />
        </div>
        <h1 className="paywall-hero__title">{t('welcomeTitle')}</h1>
        <p className="paywall-hero__subtitle">{t('welcomeSubtitle')}</p>

        <form className="card confirm-card" style={{ width: '100%', textAlign: 'left' }} onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">{t('name')}</span>
            <input
              type="text"
              className="field__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('yourName')}
              autoComplete="name"
            />
          </label>

          <label className="field">
            <span className="field__label">{t('email')}</span>
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
            {t('createAccount')}
          </button>
        </form>

        <p className="record-hint" style={{ marginTop: 4 }}>{t('stayLocalHint')}</p>
      </main>
    </div>
  )
}
