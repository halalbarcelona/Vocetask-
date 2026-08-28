import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { usePreferencesContext } from '../hooks/PreferencesContext'
import { useUILangContext } from '../hooks/UILangContext'
import RescheduleMenu from './RescheduleMenu'
import { CheckIcon, TimerIcon } from './icons'
import { nextBestAction } from '../utils/nextAction'
import { formatDuration } from '../utils/duration'
import { todayISO } from '../utils/dateUtils'

const DISMISS_KEY = 'aura-nba-dismissed'

function loadDismissed() {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) ?? 'null')
  } catch {
    return null
  }
}

// Answers "what should I do next?" with one task, deterministically picked
// (see utils/nextAction.js) and explained rather than dropped on the user
// as an unexplained "AI" pick. Dismissing it only suppresses that specific
// task for the rest of today — if the recommendation changes to a
// different task, it reappears.
export default function NextBestActionCard() {
  const navigate = useNavigate()
  const { tasks, toggleDone, updateTask } = useTasksContext()
  const { workEndMinutes } = usePreferencesContext()
  const { t } = useUILangContext()
  const [showReschedule, setShowReschedule] = useState(false)
  const [dismissed, setDismissed] = useState(loadDismissed)

  const today = todayISO()
  const result = nextBestAction(tasks, today, { workEndMinutes })

  if (!result) return null
  if (dismissed && dismissed.date === today && dismissed.taskId === result.task.id) return null

  const { task, reasons } = result

  const handleDismiss = () => {
    const next = { date: today, taskId: task.id }
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next))
    setDismissed(next)
  }

  const handleComplete = () => toggleDone(task.id)

  const handleStartFocus = () => navigate('/focus', { state: { taskId: task.id } })

  const handleReschedule = (date, time) => {
    updateTask(task.id, time ? { date, time } : { date })
    setShowReschedule(false)
  }

  return (
    <section className="nba-card">
      <p className="nba-card__eyebrow">{t('nextUp')}</p>
      <p className="nba-card__title">{task.title || 'Untitled task'}</p>
      <p className="nba-card__meta">
        {task.durationMinutes > 0 ? formatDuration(task.durationMinutes) : null}
        {task.durationMinutes > 0 && task.priority !== 'none' ? ' · ' : null}
        {task.priority !== 'none' ? `${task.priority} priority` : null}
      </p>
      <ul className="nba-card__reasons">
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <div className="nba-card__actions">
        <button type="button" className="button button--primary button--compact" onClick={handleStartFocus}>
          <TimerIcon width={14} height={14} /> {t('startFocus')}
        </button>
        <button type="button" className="nba-card__ghost-btn" onClick={handleComplete}>
          <CheckIcon width={13} height={13} /> {t('complete')}
        </button>
        <button type="button" className="nba-card__ghost-btn" onClick={() => setShowReschedule((v) => !v)}>
          {t('reschedule')}
        </button>
        <button type="button" className="nba-card__ghost-btn" onClick={handleDismiss}>
          {t('dismiss')}
        </button>
      </div>
      {showReschedule && <RescheduleMenu task={task} onReschedule={handleReschedule} />}
    </section>
  )
}
