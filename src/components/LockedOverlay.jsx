import { useNavigate } from 'react-router-dom'
import { LockIcon } from './icons'
import { usePremiumContext } from '../hooks/PremiumContext'

// Wraps real, already-rendered content and puts it behind glass rather than
// redirecting away. Seeing your own data just out of reach is a much
// stronger pull than a generic "this is a premium feature" wall.
export default function LockedOverlay({ locked, title, subtitle, children }) {
  const navigate = useNavigate()
  const { trialAvailable, trialDays, startTrial } = usePremiumContext()

  if (!locked) return children

  return (
    <div className="locked">
      <div className="locked__content" aria-hidden="true">
        {children}
      </div>
      <div className="locked__overlay">
        <div className="locked__badge">
          <LockIcon width={18} height={18} />
        </div>
        <p className="locked__title">{title}</p>
        {subtitle && <p className="locked__subtitle">{subtitle}</p>}
        {/* Someone standing in front of a locked feature is exactly who the
            trial is for — asking them to pay first wastes the moment. */}
        {trialAvailable ? (
          <button type="button" className="button button--primary" onClick={startTrial}>
            Try free for {trialDays} days
          </button>
        ) : (
          <button type="button" className="button button--primary" onClick={() => navigate('/upgrade')}>
            Unlock with Premium
          </button>
        )}
      </div>
    </div>
  )
}
