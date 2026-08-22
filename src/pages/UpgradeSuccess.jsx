import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePremiumContext } from '../hooks/PremiumContext'
import { useAccountContext } from '../hooks/AccountContext'
import { supabaseConfigured } from '../lib/supabaseClient'
import { CheckIcon } from '../components/icons'

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 20000

export default function UpgradeSuccess() {
  const navigate = useNavigate()
  const { activatePremium, syncFromBackend } = usePremiumContext()
  const { account } = useAccountContext()
  // Without a configured backend there's nothing to verify against yet, so
  // fall back to the old unconditional unlock rather than blocking a real
  // purchase on infrastructure that isn't wired up.
  const [status, setStatus] = useState(supabaseConfigured ? 'checking' : 'confirmed')

  useEffect(() => {
    if (!supabaseConfigured) {
      activatePremium()
      return undefined
    }

    if (!account?.email) {
      setStatus('timeout')
      return undefined
    }

    let cancelled = false
    const startedAt = Date.now()

    const check = async () => {
      const confirmed = await syncFromBackend(account.email)
      if (cancelled) return
      if (confirmed) {
        setStatus('confirmed')
      } else if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        setStatus('timeout')
      } else {
        setTimeout(check, POLL_INTERVAL_MS)
      }
    }

    check()
    return () => {
      cancelled = true
    }
  }, [account?.email, activatePremium, syncFromBackend])

  if (status === 'checking') {
    return (
      <div className="screen">
        <main className="screen__content screen__content--center" style={{ paddingTop: 80 }}>
          <div className="paywall-hero__icon">
            <CheckIcon width={28} height={28} />
          </div>
          <h1 className="paywall-hero__title">Confirming your payment…</h1>
          <p className="paywall-hero__subtitle">This usually takes a few seconds.</p>
        </main>
      </div>
    )
  }

  if (status === 'timeout') {
    return (
      <div className="screen">
        <main className="screen__content screen__content--center" style={{ paddingTop: 80 }}>
          <h1 className="paywall-hero__title">Still processing</h1>
          <p className="paywall-hero__subtitle">
            Your payment went through, but confirmation is taking longer than usual. Check back
            shortly — Premium will unlock automatically once it's confirmed.
          </p>
          <button type="button" className="button button--primary button--wide" onClick={() => navigate('/')}>
            Continue to Aura Task
          </button>
        </main>
      </div>
    )
  }

  return (
    <div className="screen">
      <main className="screen__content screen__content--center" style={{ paddingTop: 80 }}>
        <div className="paywall-hero__icon paywall-hero__icon--success">
          <CheckIcon width={28} height={28} />
        </div>
        <h1 className="paywall-hero__title">You’re on Premium</h1>
        <p className="paywall-hero__subtitle">Voice tasks and unlimited entries are unlocked.</p>
        <button type="button" className="button button--primary button--wide" onClick={() => navigate('/')}>
          Continue to Aura Task
        </button>
      </main>
    </div>
  )
}
