import { useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import LockedOverlay from '../components/LockedOverlay'
import { BackIcon } from '../components/icons'
import {
  computeStreak,
  computeLongestStreak,
  completionRate,
  categoryBreakdown,
  mostProductiveDayOfWeek,
  mostProductiveTimeOfDay,
  estimateAccuracy,
} from '../utils/stats'

export default function Stats() {
  const navigate = useNavigate()
  const { tasks } = useTasksContext()
  const { isPremium } = usePremiumContext()

  const streak = computeStreak(tasks)
  const longestStreak = computeLongestStreak(tasks)
  const rate = completionRate(tasks, 7)
  const breakdown = categoryBreakdown(tasks)
  const maxCount = Math.max(1, ...breakdown.map(([, count]) => count))
  const bestDay = mostProductiveDayOfWeek(tasks)
  const bestTime = mostProductiveTimeOfDay(tasks)
  const accuracy = estimateAccuracy(tasks)

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

        {(bestDay || bestTime) && (
          <section className="settings-group">
            <h2 className="section-title">When you get things done</h2>
            <div className="card">
              {bestDay && (
                <div className="stat-bar-row">
                  <span className="stat-bar-row__label">Most productive day</span>
                  <span className="stat-bar-row__count">{bestDay}</span>
                </div>
              )}
              {bestTime && (
                <div className="stat-bar-row">
                  <span className="stat-bar-row__label">Most productive time</span>
                  <span className="stat-bar-row__count">{bestTime}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {accuracy && (
          <section className="settings-group">
            <h2 className="section-title">Time estimates</h2>
            <div className="card">
              <div className="stat-bar-row">
                <span className="stat-bar-row__label">
                  Based on {accuracy.sampleSize} task{accuracy.sampleSize === 1 ? '' : 's'} logged via Focus
                </span>
                <span className="stat-bar-row__count">
                  {accuracy.ratioPercent === 100
                    ? 'On target'
                    : accuracy.ratioPercent > 100
                      ? `${accuracy.ratioPercent - 100}% over`
                      : `${100 - accuracy.ratioPercent}% under`}
                </span>
              </div>
            </div>
          </section>
        )}
        </LockedOverlay>
      </main>
    </div>
  )
}
