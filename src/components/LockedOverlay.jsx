import { useNavigate } from 'react-router-dom'
import { LockIcon } from './icons'

// Wraps real, already-rendered content and puts it behind glass rather than
// redirecting away. Seeing your own data just out of reach is a much
// stronger pull than a generic "this is a premium feature" wall.
export default function LockedOverlay({ locked, title, subtitle, children }) {
  const navigate = useNavigate()

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
        <button type="button" className="button button--primary" onClick={() => navigate('/upgrade')}>
          Unlock with Premium
        </button>
      </div>
    </div>
  )
}
