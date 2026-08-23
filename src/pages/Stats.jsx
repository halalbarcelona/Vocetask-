import { useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import LockedOverlay from '../components/LockedOverlay'
import { BackIcon } from '../components/icons'
import { computeStreak, computeLongestStreak, completionRate, categoryBreakdown } from '../utils/stats'

export default function Stats() {
  const navigate = useNavigate()
  const { tasks } = useTasksContext()
  const { isPremium } = usePremiumContext()

  const streak = computeStreak(tasks)
  const longestStreak = computeLongestStreak(tasks)
  const rate = completionRate(tasks, 7)
  const breakdown = categoryBreakdown(tasks)
  const maxCount = Math.max(1, ...breakdown.map(([, count]) => count))

  return (
    <div className="screen">
      <header className="page-header">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Go back">
          <BackIcon />
        </button>
        <h1 className="page-header__title">Productivity report</h1>
        <span className="icon-button icon-button--spacer" />
      </header>

      <main className="screen__content">
        <LockedOverlay
          locked={!isPremium}
          title="This is your real report"
          subtitle="Unlock Premium to see your streaks and breakdown any time."
        >
        <div className="stat-tile-row">
          <div className="card stat-tile">
            <p className="stat-tile__value">{streak}</p>
            <p className="stat-tile__label">Current streak</p>
          </div>
          <div className="card stat-tile">
            <p className="stat-tile__value">{longestStreak}</p>
            <p className="stat-tile__label">Longest streak</p>
          </div>
          <div className="card stat-tile">
            <p className="stat-tile__value">{rate}%</p>
            <p className="stat-tile__label">Last 7 days</p>
          </div>
        </div>

        <section className="settings-group">
          <h2 className="section-title">Tasks by Category</h2>
          <div className="card">
            {breakdown.length === 0 ? (
              <p className="empty-state__hint">No tasks yet.</p>
            ) : (
              breakdown.map(([category, count]) => (
                <div className="stat-bar-row" key={category}>
                  <span className="stat-bar-row__label">{category}</span>
                  <span className="stat-bar-row__track">
                    <span
                      className="stat-bar-row__fill"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </span>
                  <span className="stat-bar-row__count">{count}</span>
                </div>
              ))
            )}
          </div>
        </section>
        </LockedOverlay>
      </main>
    </div>
  )
}
