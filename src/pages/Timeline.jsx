import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import LockedOverlay from '../components/LockedOverlay'
import TaskItem from '../components/TaskItem'
import { BackIcon } from '../components/icons'
import { isDueOn, isOverdue } from '../utils/recurrence'
import { formatDateLabel, todayISO, toISODate } from '../utils/dateUtils'

const DAYS_AHEAD = 30

// Where Upcoming deliberately shows exactly 7 days (blank ones included) for
// a "week at a glance", Timeline is the longer-range view: everything
// overdue, then every day out to a month that actually has something on it.
// Empty future days are skipped entirely — at 30 days out, showing 23 "Nothing
// planned" placeholders would bury the days that matter.
export default function Timeline() {
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

  const days = useMemo(() => {
    const list = []
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const iso = toISODate(d)
      const dayTasks = tasks
        .filter((t) => isDueOn(t, iso))
        .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
      if (dayTasks.length === 0 && i !== 0) continue
      list.push({ iso, tasks: dayTasks })
    }
    return list
  }, [tasks])

  const isEmpty = overdue.length === 0 && days.every((d) => d.tasks.length === 0)

  return (
    <div className="screen">
      <header className="page-header">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Go back">
          <BackIcon />
        </button>
        <h1 className="page-header__title">Timeline</h1>
        <span className="icon-button icon-button--spacer" />
      </header>

      <main className="screen__content">
        <LockedOverlay
          locked={!isPremium}
          title="See a month ahead in one scroll"
          subtitle="Unlock Premium for the full timeline — overdue through the next 30 days."
        >
          {isEmpty && <p className="empty-state__hint">Nothing overdue or planned for the next 30 days.</p>}

          {overdue.length > 0 && (
            <section>
              <h2 className="section-title section-title--danger">Overdue</h2>
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

          {days.map((day) => (
            <section key={day.iso}>
              <h2 className="section-title">{formatDateLabel(day.iso)}</h2>
              <div className="task-list">
                {day.tasks.map((task) => (
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
          ))}
        </LockedOverlay>
      </main>
    </div>
  )
}
