import { useMemo, useState } from 'react'
import { useTasksContext } from '../hooks/TasksContext'
import TaskItem from '../components/TaskItem'
import BottomTabBar from '../components/BottomTabBar'
import { ChevronIcon } from '../components/icons'
import {
  buildMonthGrid,
  formatDateLabel,
  monthLabel,
  todayISO,
  toISODate,
  weekdayLabels,
} from '../utils/dateUtils'

export default function Calendar() {
  const { tasks, toggleDone } = useTasksContext()
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(todayISO())

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const today = todayISO()

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month])

  const tasksByDate = useMemo(() => {
    const map = new Map()
    for (const task of tasks) {
      if (!map.has(task.date)) map.set(task.date, [])
      map.get(task.date).push(task)
    }
    return map
  }, [tasks])

  const selectedDayTasks = (tasksByDate.get(selectedDate) || [])
    .slice()
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))

  const upcomingGroups = useMemo(() => {
    const upcoming = tasks
      .filter((t) => t.date >= today)
      .slice()
      .sort((a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')))

    const groups = []
    let lastDate = null
    for (const task of upcoming) {
      if (task.date !== lastDate) {
        groups.push({ date: task.date, tasks: [] })
        lastDate = task.date
      }
      groups[groups.length - 1].tasks.push(task)
    }
    return groups
  }, [tasks, today])

  const changeMonth = (delta) => {
    setCursor(new Date(year, month + delta, 1))
  }

  return (
    <div className="screen">
      <header className="page-header">
        <h1 className="page-header__title">Calendar</h1>
      </header>

      <div className="segmented">
        <button
          type="button"
          className={`segmented__item${view === 'month' ? ' segmented__item--active' : ''}`}
          onClick={() => setView('month')}
        >
          Month
        </button>
        <button
          type="button"
          className={`segmented__item${view === 'tasks' ? ' segmented__item--active' : ''}`}
          onClick={() => setView('tasks')}
        >
          Tasks
        </button>
      </div>

      <main className="screen__content">
        {view === 'month' ? (
          <>
            <div className="month-nav">
              <button type="button" className="icon-button" onClick={() => changeMonth(-1)} aria-label="Previous month">
                <ChevronIcon style={{ transform: 'rotate(180deg)' }} />
              </button>
              <span className="month-nav__label">{monthLabel(year, month)}</span>
              <button type="button" className="icon-button" onClick={() => changeMonth(1)} aria-label="Next month">
                <ChevronIcon />
              </button>
            </div>

            <div className="calendar-grid">
              {weekdayLabels().map((label) => (
                <span key={label} className="calendar-grid__weekday">
                  {label}
                </span>
              ))}

              {grid.map((date) => {
                const iso = toISODate(date)
                const inMonth = date.getMonth() === month
                const hasTasks = tasksByDate.has(iso)
                const classes = [
                  'calendar-day',
                  !inMonth ? 'calendar-day--muted' : '',
                  iso === today ? 'calendar-day--today' : '',
                  iso === selectedDate ? 'calendar-day--selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <button key={iso} type="button" className={classes} onClick={() => setSelectedDate(iso)}>
                    <span>{date.getDate()}</span>
                    {hasTasks && <span className="calendar-day__dot" />}
                  </button>
                )
              })}
            </div>

            <section>
              <h2 className="section-title">{formatDateLabel(selectedDate)}</h2>
              {selectedDayTasks.length === 0 ? (
                <div className="empty-state">
                  <p>No tasks on this day.</p>
                </div>
              ) : (
                <div className="task-list">
                  {selectedDayTasks.map((task) => (
                    <TaskItem key={task.id} task={task} onToggle={toggleDone} />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <section>
            {upcomingGroups.length === 0 ? (
              <div className="empty-state">
                <p>No upcoming tasks.</p>
              </div>
            ) : (
              upcomingGroups.map((group) => (
                <div key={group.date} className="task-group">
                  <h2 className="section-title">{formatDateLabel(group.date)}</h2>
                  <div className="task-list">
                    {group.tasks.map((task) => (
                      <TaskItem key={task.id} task={task} onToggle={toggleDone} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        )}
      </main>

      <BottomTabBar />
    </div>
  )
}
