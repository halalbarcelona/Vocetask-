import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import { useToast } from '../hooks/useToast'
import TaskItem from '../components/TaskItem'
import Toast from '../components/Toast'
import BottomTabBar from '../components/BottomTabBar'
import { MicIcon, PlusIcon, SearchIcon, SpeakerIcon } from '../components/icons'
import { todayISO } from '../utils/dateUtils'
import { remainingFreeTasks } from '../utils/plan'
import { isDueOn } from '../utils/recurrence'
import { computeStreak } from '../utils/stats'
import { speakDailyRecap } from '../utils/speak'

export default function Home() {
  const navigate = useNavigate()
  const location = useLocation()
  const { tasks, toggleDone, setDraftTask, removeTask, restoreTask, reorderTask, toggleSubtask } =
    useTasksContext()
  const { isPremium } = usePremiumContext()
  const { toast, showToast, dismissToast } = useToast()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (location.state?.toast) {
      showToast(location.state.toast, {
        actionLabel: location.state.undoTask ? 'Undo' : undefined,
        onAction: location.state.undoTask ? () => restoreTask(location.state.undoTask) : undefined,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const today = todayISO()
  const isSearching = query.trim().length > 0

  const todayTasks = tasks
    .filter((t) => isDueOn(t, today))
    .sort((a, b) => a.order - b.order)

  const searchResults = isSearching
    ? tasks
        .filter((t) => t.title.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')))
    : []

  const visibleTasks = isSearching ? searchResults : todayTasks
  const todayTaskIds = todayTasks.map((t) => t.id)
  const streak = computeStreak(tasks)

  const remaining = isPremium ? Infinity : remainingFreeTasks(tasks)
  const outOfCredits = remaining <= 0

  const handleMicTap = () => {
    if (outOfCredits) {
      navigate('/upgrade')
      return
    }
    navigate('/record')
  }

  const handleManualAdd = () => {
    if (outOfCredits) {
      navigate('/upgrade')
      return
    }
    setDraftTask({ title: '', date: today, time: '', category: 'Personal', source: 'manual' })
    navigate('/confirm')
  }

  const handleDelete = (task) => {
    removeTask(task.id)
    showToast(`Deleted "${task.title || 'Untitled task'}"`, {
      actionLabel: 'Undo',
      onAction: () => restoreTask(task),
    })
  }

  const handleSpeakRecap = () => speakDailyRecap(todayTasks)

  return (
    <div className="screen">
      <header className="page-header">
        <h1 className="page-header__title">Aura Task</h1>
        <div className="page-header__actions">
          <button
            type="button"
            className="icon-button"
            onClick={handleSpeakRecap}
            aria-label="Read today's tasks aloud"
          >
            <SpeakerIcon />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={handleManualAdd}
            aria-label="Add a task manually"
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            className="icon-button icon-button--accent"
            onClick={handleMicTap}
            aria-label="Record a task with your voice"
          >
            <MicIcon />
          </button>
        </div>
      </header>

      <main className="screen__content">
        {!isPremium && (
          <p className="plan-hint">
            {remaining > 0
              ? `${remaining} free task${remaining === 1 ? '' : 's'} left today`
              : "You've used today's free tasks — upgrade for unlimited."}
          </p>
        )}

        {streak > 0 && (
          <p className="streak-banner">
            <span className="streak-banner__flame">🔥</span>
            {streak}-day streak
          </p>
        )}

        <div className="search-bar">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search tasks…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <section>
          <h2 className="section-title">{isSearching ? 'Search Results' : 'Today'}</h2>

          {visibleTasks.length === 0 ? (
            <div className="empty-state">
              <p>{isSearching ? 'No matching tasks.' : 'No tasks for today yet.'}</p>
              {!isSearching && (
                <p className="empty-state__hint">
                  {outOfCredits ? 'Upgrade for more.' : 'Tap the mic or + to add one.'}
                </p>
              )}
            </div>
          ) : (
            <div className="task-list">
              {visibleTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={toggleDone}
                  onDelete={handleDelete}
                  onToggleSubtask={toggleSubtask}
                  onReorder={isSearching ? undefined : (id, dir) => reorderTask(id, dir, todayTaskIds)}
                  isFirst={!isSearching && todayTaskIds.indexOf(task.id) === 0}
                  isLast={!isSearching && todayTaskIds.indexOf(task.id) === todayTaskIds.length - 1}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <Toast toast={toast} onDismiss={dismissToast} />
      <BottomTabBar />
    </div>
  )
}
