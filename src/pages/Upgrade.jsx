import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackIcon, CheckIcon, LockIcon, MicIcon } from '../components/icons'
import { useAccountContext } from '../hooks/AccountContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import { useTasksContext } from '../hooks/TasksContext'
import { pickUpsellReason } from '../utils/upsell'

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
const STRIPE_BUY_BUTTON_ID = import.meta.env.VITE_STRIPE_BUY_BUTTON_ID
const STRIPE_CONFIGURED = Boolean(STRIPE_PUBLISHABLE_KEY && STRIPE_BUY_BUTTON_ID)

const FEATURES = [
  { label: 'Tasks (voice + manual)', free: 'Unlimited', premium: 'Unlimited' },
  { label: 'Recurring tasks', free: '—', premium: 'Any schedule' },
  { label: 'Subtasks / checklists', free: '—', premium: 'Included' },
  { label: 'Voice actions (done, delete, reschedule)', free: '—', premium: 'Included' },
  { label: 'Calendar export (.ics)', free: '—', premium: 'Included' },
  { label: 'Priority levels + sort', free: '—', premium: 'Included' },
  { label: 'Custom categories', free: '—', premium: 'Unlimited' },
  { label: 'Notes on tasks', free: '—', premium: 'Included' },
  { label: 'Bulk select & actions', free: '—', premium: 'Included' },
  { label: 'Snooze a task', free: '—', premium: 'Included' },
  { label: 'Reminder lead time', free: '—', premium: 'Included' },
  { label: 'Task templates', free: '—', premium: 'Included' },
  { label: 'Voice search', free: '—', premium: 'Included' },
  { label: 'Productivity report', free: '—', premium: 'Included' },
  { label: 'Backup & restore (.json)', free: '—', premium: 'Included' },
  { label: 'Share today’s list', free: '—', premium: 'Included' },
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
  const { account } = useAccountContext()
  const { tasks } = useTasksContext()
  const { trialActive, trialDaysLeft } = usePremiumContext()
  const reason = pickUpsellReason(tasks)

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
          <h2 className="paywall-hero__title">
            {trialActive ? `Keep Premium after day ${7 - trialDaysLeft + 1}` : 'Unlock everything, once'}
          </h2>
          <p className="paywall-hero__subtitle">
            Tasks are always unlimited and free. Premium adds the depth — recurring tasks, subtasks,
            priorities, templates, reports and more.
          </p>
          <p className="paywall-hero__badge">One-time payment · Yours forever · No subscription</p>
        </div>

        <div className="card upsell-card">
          <p className="upsell-card__feature">
            <CheckIcon /> {reason.feature}
          </p>
          <p className="upsell-card__message">{reason.message}</p>
        </div>

        <p className="price-anchor">
          Other to-do apps charge <strong>every year, forever</strong>. Aura Premium is one payment.
        </p>

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
                client-reference-id={account?.email}
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
