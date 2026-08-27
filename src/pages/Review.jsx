import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import LockedOverlay from '../components/LockedOverlay'
import TaskItem from '../components/TaskItem'
import { BackIcon } from '../components/icons'
import { isOverdue, isDueOn } from '../utils/recurrence'
import { formatDateLabel, todayISO, toISODate } from '../utils/dateUtils'
import {
  computeStreak,
  computeLongestStreak,
  completionRate,
  categoryBreakdown,
  completedInLastDays,
  habitStreak,
  habitCompletionRate,
} from '../utils/stats'

// Every number here reads off something the app already tracks — nothing
// here is invented to fill a chart. A postponement counter or a "your
// estimates run 20% short" line would need history this app doesn't record
// yet, so they're left out rather than faked.
export default function Review() {
  const navigate = useNavigate()
  const { tasks, toggleDone, toggleSubtask, setDraftTask, updateTask } = useTasksContext()
  const { isPremium } = usePremiumContext()
  const today = todayISO()

  const handleEdit = (task) => {
    setDraftTask({ ...task })
    navigate('/confirm')
  }
  const handleSnooze = (id, newDate) => updateTask(id, { date: newDate })

  const overdue = useMemo(
    () => tasks.filter((t) => isOverdue(t, today)).sort((a, b) => a.date.localeCompare(b.date)),
    [tasks, today],
  )

  const completed = useMemo(() => completedInLastDays(tasks, 7), [tasks])

  const upcoming = useMemo(() => {
    const days = []
    const cursor = new Date()
    for (let i = 0; i < 7; i++) {
      cursor.setDate(cursor.getDate() + 1)
      days.push(toISODate(cursor))
    }
    return tasks
      .filter((t) => days.some((d) => isDueOn(t, d)) && !t.done)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5)
  }, [tasks])

  // Deliberately excludes anything already overdue — that has its own
  // section right above, in full, and repeating it here would just be the
  // same list twice under a different heading.
  const suggested = useMemo(() => {
    return tasks
      .filter(
        (t) => !t.done && t.priority === 'high' && t.date > today && t.date <= toISODate(new Date(Date.now() + 7 * 86400000)),
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5)
  }, [tasks, overdue, today])

  const habits = tasks
    .filter((t) => t.recurrence && t.recurrence !== 'none')
    .map((t) => ({ task: t, streak: habitStreak(t), rate: habitCompletionRate(t, 7) }))
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 4)

  const streak = computeStreak(tasks)
  const longestStreak = computeLongestStreak(tasks)
  const rate = completionRate(tasks, 7)
  const breakdown = categoryBreakdown(tasks).slice(0, 5)
  const maxCount = Math.max(1, ...breakdown.map(([, count]) => count))

  return (
    <div className="screen">
      <header className="page-header">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Go back">
          <BackIcon />
        </button>
        <h1 className="page-header__title">Weekly review</h1>
        <span className="icon-button icon-button--spacer" />
      </header>

      <main className="screen__content">
        <LockedOverlay
          locked={!isPremium}
          title="See your week clearly"
          subtitle="Unlock Premium for a real weekly review — not just a streak count."
        >
          <div className="stat-tile-row">
            <div className="card stat-tile">
              <p className="stat-tile__value">{completed.length}</p>
              <p className="stat-tile__label">Completed, last 7 days</p>
            </div>
            <div className="card stat-tile">
              <p className="stat-tile__value">{overdue.length}</p>
              <p className="stat-tile__label">Overdue right now</p>
            </div>
            <div className="card stat-tile">
              <p className="stat-tile__value">{rate}%</p>
              <p className="stat-tile__label">7-day completion</p>
            </div>
          </div>

          <section className="settings-group">
            <h2 className="section-title">Streaks</h2>
            <div className="card">
              <div className="stat-bar-row">
                <span className="stat-bar-row__label">Current</span>
                <span className="stat-bar-row__count">{streak}-day</span>
              </div>
              <div className="stat-bar-row">
                <span className="stat-bar-row__label">Longest ever</span>
                <span className="stat-bar-row__count">{longestStreak}-day</span>
              </div>
            </div>
          </section>

          {overdue.length > 0 && (
            <section className="settings-group">
              <h2 className="section-title section-title--danger">Still overdue</h2>
              <div className="task-list">
                {overdue.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={toggleDone}
                    onEdit={handleEdit}
                    onToggleSubtask={toggleSubtask}
                    onSnooze={handleSnooze}
                    isPremium={isPremium}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="settings-group">
            <h2 className="section-title">High priority, coming up</h2>
            {suggested.length === 0 ? (
              <p className="empty-state__hint">No high-priority tasks coming up — a genuinely clear week.</p>
            ) : (
              <div className="task-list">
                {suggested.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={toggleDone}
                    onEdit={handleEdit}
                    onToggleSubtask={toggleSubtask}
                    onSnooze={handleSnooze}
                    isPremium={isPremium}
                  />
                ))}
              </div>
            )}
          </section>

          {habits.length > 0 && (
            <section className="settings-group">
              <h2 className="section-title">Habit performance</h2>
              <div className="task-list">
                {habits.map(({ task, streak: s, rate: r }) => (
                  <div key={task.id} className="card habit-card">
                    <div className="habit-card__row">
                      <p className="habit-card__title">{task.title || 'Untitled task'}</p>
                    </div>
                    <div className="habit-card__stats">
                      <span className="habit-card__stat">{s}-day streak</span>
                      <span className="habit-card__stat">{r}% last 7 days</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="settings-group">
            <h2 className="section-title">Biggest lists</h2>
            <div className="card">
              {breakdown.length === 0 ? (
                <p className="empty-state__hint">No tasks yet.</p>
              ) : (
                breakdown.map(([category, count]) => (
                  <div className="stat-bar-row" key={category}>
                    <span className="stat-bar-row__label">{category}</span>
                    <span className="stat-bar-row__track">
                      <span className="stat-bar-row__fill" style={{ width: `${(count / maxCount) * 100}%` }} />
                    </span>
                    <span className="stat-bar-row__count">{count}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          {upcoming.length > 0 && (
            <section className="settings-group">
              <h2 className="section-title">Coming up</h2>
              <div className="card">
                {upcoming.map((task) => (
                  <div className="stat-bar-row" key={task.id}>
                    <span className="stat-bar-row__label">{task.title || 'Untitled task'}</span>
                    <span className="stat-bar-row__count">{formatDateLabel(task.date)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </LockedOverlay>
      </main>
    </div>
  )
}
