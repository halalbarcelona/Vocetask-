import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import LockedOverlay from '../components/LockedOverlay'
import { BackIcon, CheckIcon } from '../components/icons'
import { isDueOn } from '../utils/recurrence'
import { todayISO } from '../utils/dateUtils'

const MODES = [
  { value: 'focus', label: 'Focus', minutes: 25 },
  { value: 'short', label: 'Short break', minutes: 5 },
  { value: 'long', label: 'Long break', minutes: 15 },
]

function formatClock(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// A running session is anchored to a real end timestamp rather than ticked
// down one second at a time, so backgrounding the tab (throttled timers)
// never leaves the display drifting from the actual time remaining.
export default function Focus() {
  const navigate = useNavigate()
  const { tasks, updateTask } = useTasksContext()
  const { isPremium } = usePremiumContext()
  const [mode, setMode] = useState('focus')
  const [taskId, setTaskId] = useState('')
  const [endAt, setEndAt] = useState(null)
  const [remaining, setRemaining] = useState(MODES[0].minutes * 60)
  const [sessionsDone, setSessionsDone] = useState(0)
  const [lastLogged, setLastLogged] = useState(null)
  const intervalRef = useRef(null)
  const taskIdRef = useRef(taskId)
  taskIdRef.current = taskId
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks

  const today = todayISO()
  const activeTasks = useMemo(
    () =>
      tasks.filter(
        (t) => isDueOn(t, today) && !(t.recurrence && t.recurrence !== 'none' ? (t.completedDates ?? []).includes(today) : t.done),
      ),
    [tasks, today],
  )

  const modeMinutes = MODES.find((m) => m.value === mode).minutes
  const isRunning = endAt !== null

  useEffect(() => {
    if (!isRunning) return undefined
    intervalRef.current = setInterval(() => {
      const left = Math.max(0, Math.round((endAt - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) {
        setEndAt(null)
        if (mode === 'focus') {
          setSessionsDone((n) => n + 1)
          // Only a naturally-completed session counts — pausing or resetting
          // early never logs partial time, keeping the bookkeeping honest.
          const activeTaskId = taskIdRef.current
          if (activeTaskId) {
            const current = tasksRef.current.find((t) => t.id === activeTaskId)
            if (current) {
              updateTask(activeTaskId, { actualMinutes: (current.actualMinutes ?? 0) + modeMinutes })
              setLastLogged({ title: current.title || 'Untitled task', minutes: modeMinutes })
            }
          }
        }
      }
    }, 250)
    return () => clearInterval(intervalRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, endAt, mode])

  const switchMode = (value) => {
    setMode(value)
    setEndAt(null)
    setRemaining(MODES.find((m) => m.value === value).minutes * 60)
  }

  const start = () => setEndAt(Date.now() + remaining * 1000)
  const pause = () => {
    setRemaining(Math.max(0, Math.round((endAt - Date.now()) / 1000)))
    setEndAt(null)
  }
  const reset = () => {
    setEndAt(null)
    setRemaining(modeMinutes * 60)
  }

  const percentLeft = remaining / (modeMinutes * 60)
  const circumference = 2 * Math.PI * 80

  return (
    <div className="screen">
      <header className="page-header">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Go back">
          <BackIcon />
        </button>
        <h1 className="page-header__title">Focus</h1>
        <span className="icon-button icon-button--spacer" />
      </header>

      <main className="screen__content screen__content--center">
        <LockedOverlay
          locked={!isPremium}
          title="Stay on one task at a time"
          subtitle="Unlock Premium for the focus timer."
        >
          <div className="chip-row" style={{ justifyContent: 'center' }}>
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                className={`filter-chip${mode === m.value ? ' filter-chip--active' : ''}`}
                onClick={() => switchMode(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="focus-ring">
            <svg viewBox="0 0 180 180" width="220" height="220">
              <circle cx="90" cy="90" r="80" className="focus-ring__track" />
              <circle
                cx="90"
                cy="90"
                r="80"
                className="focus-ring__progress"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - percentLeft)}
                transform="rotate(-90 90 90)"
              />
            </svg>
            <span className="focus-ring__time">{formatClock(remaining)}</span>
          </div>

          {mode === 'focus' && activeTasks.length > 0 && (
            <label className="field" style={{ width: '100%' }}>
              <span className="field__label">Working on</span>
              <select className="field__input" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                <option value="">Just focusing — no task picked</option>
                {activeTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title || 'Untitled task'}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="confirm-actions">
            {isRunning ? (
              <button type="button" className="button button--primary button--wide" onClick={pause}>
                Pause
              </button>
            ) : (
              <button type="button" className="button button--primary button--wide" onClick={start}>
                {remaining === modeMinutes * 60 ? 'Start' : 'Resume'}
              </button>
            )}
            <button type="button" className="button button--ghost button--wide" onClick={reset}>
              Reset
            </button>
          </div>

          {sessionsDone > 0 && (
            <p className="record-hint">
              <CheckIcon width={13} height={13} /> {sessionsDone} focus session{sessionsDone === 1 ? '' : 's'} today
            </p>
          )}

          {lastLogged && (
            <p className="record-hint">
              Logged {lastLogged.minutes} min to "{lastLogged.title}"
            </p>
          )}
        </LockedOverlay>
      </main>
    </div>
  )
}
