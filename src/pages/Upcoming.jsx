import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import LockedOverlay from '../components/LockedOverlay'
import TaskItem from '../components/TaskItem'
import { BackIcon } from '../components/icons'
import { isDueOn } from '../utils/recurrence'
import { formatDateLabel, toISODate } from '../utils/dateUtils'
import { formatDuration } from '../utils/duration'

const DAYS_AHEAD = 7

// Unlike Calendar's Tasks tab — which only lists dates that already have
// something on them — this shows every one of the next 7 days, blank ones
// included, so a genuinely empty Thursday is visible as breathing room
// rather than looking identical to a Thursday nobody has planned yet.
export default function Upcoming() {
  const navigate = useNavigate()
  const { tasks, toggleDone, toggleSubtask, setDraftTask, updateTask } = useTasksContext()
  const { isPremium } = usePremiumContext()

  const handleEdit = (task) => {
    setDraftTask({ ...task })
    navigate('/confirm')
  }

  const handleReschedule = (id, date, time) => updateTask(id, time ? { date, time } : { date })

  const days = useMemo(() => {
    const list = []
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const iso = toISODate(d)
      const dayTasks = tasks
        .filter((t) => isDueOn(t, iso))
        .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
      const isDone = (t) =>
        t.recurrence && t.recurrence !== 'none' ? (t.completedDates ?? []).includes(iso) : t.done
      const totalMinutes = dayTasks
        .filter((t) => !isDone(t))
        .reduce((sum, t) => sum + (t.durationMinutes || 0), 0)
      list.push({ iso, tasks: dayTasks, totalMinutes })
    }
    return list
  }, [tasks])

  return (
    <div className="screen">
      <header className="page-header">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Go back">
          <BackIcon />
        </button>
        <h1 className="page-header__title">Upcoming</h1>
        <span className="icon-button icon-button--spacer" />
      </header>

      <main className="screen__content">
        <LockedOverlay
          locked={!isPremium}
          title="See your whole week at a glance"
          subtitle="Unlock Premium for the 7-day view and workload per day."
        >
          {days.map((day) => (
            <section key={day.iso}>
              <div className="section-title-row">
                <h2 className="section-title">{formatDateLabel(day.iso)}</h2>
                {day.totalMinutes > 0 && (
                  <span className="upcoming-day__load">{formatDuration(day.totalMinutes)} planned</span>
                )}
              </div>
              {day.tasks.length === 0 ? (
                <p className="empty-state__hint">Nothing planned.</p>
              ) : (
                <div className="task-list">
                  {day.tasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={toggleDone}
                      onEdit={handleEdit}
                      onToggleSubtask={toggleSubtask}
                      onReschedule={handleReschedule}
                      isPremium={isPremium}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </LockedOverlay>
      </main>
    </div>
  )
}
