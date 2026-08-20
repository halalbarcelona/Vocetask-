import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePremiumContext } from '../hooks/PremiumContext'
import { CheckIcon } from '../components/icons'

export default function UpgradeSuccess() {
  const navigate = useNavigate()
  const { activatePremium } = usePremiumContext()

  useEffect(() => {
    activatePremium()
  }, [activatePremium])

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
