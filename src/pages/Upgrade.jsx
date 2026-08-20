import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackIcon, CheckIcon, LockIcon, MicIcon } from '../components/icons'

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
const STRIPE_BUY_BUTTON_ID = import.meta.env.VITE_STRIPE_BUY_BUTTON_ID
const STRIPE_CONFIGURED = Boolean(STRIPE_PUBLISHABLE_KEY && STRIPE_BUY_BUTTON_ID)

const FEATURES = [
  { label: 'Tasks', free: '3 a day', premium: 'Unlimited' },
  { label: 'Voice entry', free: '—', premium: 'Included' },
  { label: 'Support', free: '—', premium: 'Priority' },
]

function useStripeBuyButtonScript() {
  const [ready, setReady] = useState(Boolean(window.customElements?.get('stripe-buy-button')))

  useEffect(() => {
    if (!STRIPE_CONFIGURED || ready) return undefined

    const existing = document.querySelector('script[data-stripe-buy-button]')
    if (existing) {
      existing.addEventListener('load', () => setReady(true))
      return undefined
    }

    const script = document.createElement('script')
    script.src = 'https://js.stripe.com/v3/buy-button.js'
    script.async = true
    script.dataset.stripeBuyButton = 'true'
    script.addEventListener('load', () => setReady(true))
    document.head.appendChild(script)

    return undefined
  }, [ready])

  return ready
}

export default function Upgrade() {
  const navigate = useNavigate()
  const stripeReady = useStripeBuyButtonScript()

  return (
    <div className="screen">
      <header className="page-header">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Go back">
          <BackIcon />
        </button>
        <h1 className="page-header__title">Aura Premium</h1>
        <span className="icon-button icon-button--spacer" />
      </header>

      <main className="screen__content">
        <div className="paywall-hero">
          <div className="paywall-hero__icon">
            <MicIcon width={28} height={28} />
          </div>
          <h2 className="paywall-hero__title">Unlock voice tasks</h2>
          <p className="paywall-hero__subtitle">
            Speaking your tasks is a Premium feature. Upgrade for unlimited tasks and voice entry.
          </p>
        </div>

        <div className="card plan-table">
          <div className="plan-table__row plan-table__row--header">
            <span />
            <span>Free</span>
            <span>Premium</span>
          </div>
          {FEATURES.map((row) => (
            <div className="plan-table__row" key={row.label}>
              <span className="plan-table__label">{row.label}</span>
              <span className="plan-table__free">{row.free}</span>
              <span className="plan-table__premium">
                <CheckIcon /> {row.premium}
              </span>
            </div>
          ))}
        </div>

        {STRIPE_CONFIGURED ? (
          <div className="stripe-buy-button-wrap">
            {stripeReady ? (
              <stripe-buy-button
                buy-button-id={STRIPE_BUY_BUTTON_ID}
                publishable-key={STRIPE_PUBLISHABLE_KEY}
              />
            ) : (
              <p className="record-hint">Loading checkout…</p>
            )}
          </div>
        ) : (
          <div className="empty-state">
            <LockIcon />
            <p style={{ marginTop: 8 }}>Payments aren’t set up yet.</p>
            <p className="empty-state__hint">
              Add your Stripe publishable key and Buy Button ID to enable upgrades.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
