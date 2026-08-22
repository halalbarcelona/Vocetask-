import { useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { useTemplates } from '../hooks/useTemplates'
import { CheckIcon, LockIcon } from '../components/icons'
import { computeStreak } from '../utils/stats'
import { pickUpsellReason, summarizeTrialUsage } from '../utils/upsell'

export default function TrialEnded() {
  const navigate = useNavigate()
  const { tasks } = useTasksContext()
  const { templates } = useTemplates()

  const usage = summarizeTrialUsage(tasks, templates)
  const streak = computeStreak(tasks)
  const reason = pickUpsellReason(tasks)

  // Only show counts they actually built up — a row of zeroes would
  // undercut the point instead of making it.
  const stats = [
    { value: usage.total, label: 'tasks captured' },
    { value: usage.recurring, label: 'recurring tasks' },
    { value: usage.subtasks, label: 'subtasks' },
    { value: usage.prioritized, label: 'prioritized' },
    { value: usage.templates, label: 'templates' },
    { value: streak, label: 'day streak' },
  ].filter((s) => s.value > 0)

  return (
    <div className="screen">
      <main className="screen__content" style={{ paddingTop: 40 }}>
        <div className="paywall-hero">
          <div className="paywall-hero__icon">
            <LockIcon width={28} height={28} />
          </div>
          <h1 className="paywall-hero__title">Your 7 days on Premium are up</h1>
          <p className="paywall-hero__subtitle">
            Here's what you built with it. Everything stays — but the Premium tools that made it are
            locked from now on.
          </p>
        </div>

        {stats.length > 0 && (
          <div className="card trial-recap">
            {stats.map((stat) => (
              <div className="trial-recap__row" key={stat.label}>
                <span className="trial-recap__value">{stat.value}</span>
                <span className="trial-recap__label">{stat.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="card upsell-card">
          <p className="upsell-card__feature">
            <CheckIcon /> {reason.feature}
          </p>
          <p className="upsell-card__message">{reason.message}</p>
        </div>

        <p className="paywall-hero__badge" style={{ display: 'block', textAlign: 'center' }}>
          One payment · Yours forever · No subscription
        </p>

        <div className="confirm-actions" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="button button--primary button--wide"
            onClick={() => navigate('/upgrade')}
          >
            Keep Premium
          </button>
          <button type="button" className="button button--ghost button--wide" onClick={() => navigate('/')}>
            Continue on Free
          </button>
        </div>
      </main>
    </div>
  )
}
