import { useTasksContext } from '../hooks/TasksContext'
import { usePreferencesContext } from '../hooks/PreferencesContext'
import { suggestSlot } from '../utils/schedule'
import { formatTimeLabel, toISODate, todayISO, tomorrowISO } from '../utils/dateUtils'

const NEXT_SLOT_SEARCH_DAYS = 14

// "I don't have time for this today" needs real options, never a silent
// move — every button here computes an actual date (and sometimes time)
// from the task's own duration and the user's working hours, so nothing
// offered is a slot that doesn't really exist.
export default function RescheduleMenu({ task, onReschedule }) {
  const { tasks } = useTasksContext()
  const { workStartMinutes, workEndMinutes } = usePreferencesContext()

  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const today = todayISO()

  const laterTodayTime =
    task.date === today
      ? suggestSlot(tasks, today, task.durationMinutes || 15, {
          excludeTaskId: task.id,
          notBefore: nowMinutes + 5,
          dayStartMinutes: workStartMinutes,
          dayEndMinutes: workEndMinutes,
        })
      : null

  // Only searched for tasks with a real duration — without one, "next
  // available slot" has nothing concrete to fit against.
  let nextSlot = null
  if (task.durationMinutes > 0) {
    for (let i = 1; i <= NEXT_SLOT_SEARCH_DAYS; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const iso = toISODate(d)
      const time = suggestSlot(tasks, iso, task.durationMinutes, {
        excludeTaskId: task.id,
        dayStartMinutes: workStartMinutes,
        dayEndMinutes: workEndMinutes,
      })
      if (time) {
        nextSlot = { date: iso, time }
        break
      }
    }
  }

  return (
    <div className="task-card__snooze-row">
      {laterTodayTime && (
        <button
          type="button"
          className="task-card__snooze-btn"
          onClick={() => onReschedule(today, laterTodayTime)}
        >
          Later today ({formatTimeLabel(laterTodayTime)})
        </button>
      )}
      <button type="button" className="task-card__snooze-btn" onClick={() => onReschedule(tomorrowISO())}>
        Tomorrow
      </button>
      {nextSlot && (
        <button
          type="button"
          className="task-card__snooze-btn"
          onClick={() => onReschedule(nextSlot.date, nextSlot.time)}
        >
          Next free slot — {formatTimeLabel(nextSlot.time)}
        </button>
      )}
      <button
        type="button"
        className="task-card__snooze-btn"
        onClick={() => {
          const d = new Date()
          d.setDate(d.getDate() + 7)
          onReschedule(toISODate(d))
        }}
      >
        1 week
      </button>
      <label className="task-card__snooze-btn task-card__snooze-btn--date">
        Custom date
        <input
          type="date"
          className="task-card__snooze-date-input"
          onChange={(e) => e.target.value && onReschedule(e.target.value)}
          aria-label="Pick a custom reschedule date"
        />
      </label>
    </div>
  )
}
