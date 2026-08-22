import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import { useToast } from '../hooks/useToast'
import TaskItem from '../components/TaskItem'
import Toast from '../components/Toast'
import BottomTabBar from '../components/BottomTabBar'
import { CheckIcon, MicIcon, PlusIcon, SearchIcon, SpeakerIcon, TrashIcon } from '../components/icons'
import { todayISO } from '../utils/dateUtils'
import { remainingFreeTasks } from '../utils/plan'
import { isDueOn } from '../utils/recurrence'
import { computeStreak } from '../utils/stats'
import { speakDailyRecap } from '../utils/speak'

const PRIORITY_RANK = { high: 3, medium: 2, low: 1, none: 0 }

const SpeechRecognitionAPI =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined

export default function Home() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    tasks,
    toggleDone,
    setDraftTask,
    removeTask,
    restoreTask,
    reorderTask,
    toggleSubtask,
    updateTask,
    bulkRemoveTasks,
    bulkMarkDone,
  } = useTasksContext()
  const { isPremium } = usePremiumContext()
  const { toast, showToast, dismissToast } = useToast()
  const [query, setQuery] = useState('')
  const [sortByPriority, setSortByPriority] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)

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

  let todayTasks = tasks.filter((t) => isDueOn(t, today)).sort((a, b) => a.order - b.order)
  if (isPremium && sortByPriority) {
    todayTasks = [...todayTasks].sort(
      (a, b) => (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0),
    )
  }

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

  const handleSnooze = (id, newDate) => updateTask(id, { date: newDate })

  const handleSpeakRecap = () => speakDailyRecap(todayTasks)

  const handleTogglePrioritySort = () => {
    if (!isPremium) {
      navigate('/upgrade')
      return
    }
    setSortByPriority((v) => !v)
  }

  const handleToggleSelectMode = () => {
    if (!isPremium) {
      navigate('/upgrade')
      return
    }
    setSelectMode((v) => !v)
    setSelectedIds([])
  }

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const handleBulkComplete = () => {
    bulkMarkDone(selectedIds)
    setSelectedIds([])
    setSelectMode(false)
  }

  const handleBulkDelete = () => {
    bulkRemoveTasks(selectedIds)
    setSelectedIds([])
    setSelectMode(false)
    showToast(`Deleted ${selectedIds.length} task(s)`)
  }

  const handleVoiceSearch = () => {
    if (!isPremium || !SpeechRecognitionAPI) {
      if (!isPremium) navigate('/upgrade')
      return
    }
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? ''
      setQuery(text)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  return (
    <div className="screen">
      <header className="page-header">
        <h1 className="page-header__title">Aura Task</h1>
        <div className="page-header__actions">
          <button
            type="button"
            className={`icon-button${selectMode ? ' icon-button--accent' : ''}`}
            onClick={handleToggleSelectMode}
            aria-label="Select multiple tasks"
          >
            <CheckIcon width={18} height={18} />
          </button>
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
          <button
            type="button"
            className={`search-bar__mic${listening ? ' search-bar__mic--active' : ''}`}
            onClick={handleVoiceSearch}
            aria-label="Search by voice"
          >
            <MicIcon width={16} height={16} />
          </button>
        </div>

        <section>
          <div className="section-title-row">
            <h2 className="section-title">{isSearching ? 'Search Results' : 'Today'}</h2>
            {!isSearching && (
              <button
                type="button"
                className={`sort-toggle${sortByPriority ? ' sort-toggle--active' : ''}`}
                onClick={handleTogglePrioritySort}
              >
                Sort by priority
              </button>
            )}
          </div>

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
                  onSnooze={handleSnooze}
                  isPremium={isPremium}
                  onReorder={
                    isSearching || sortByPriority ? undefined : (id, dir) => reorderTask(id, dir, todayTaskIds)
                  }
                  isFirst={!isSearching && todayTaskIds.indexOf(task.id) === 0}
                  isLast={!isSearching && todayTaskIds.indexOf(task.id) === todayTaskIds.length - 1}
                  selectMode={selectMode}
                  selected={selectedIds.includes(task.id)}
                  onToggleSelect={handleToggleSelect}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {selectMode && selectedIds.length > 0 && (
        <div className="bulk-action-bar">
          <span className="bulk-action-bar__count">{selectedIds.length} selected</span>
          <div className="bulk-action-bar__actions">
            <button type="button" className="button button--primary button--compact" onClick={handleBulkComplete}>
              <CheckIcon width={14} height={14} /> Complete
            </button>
            <button type="button" className="button button--danger button--compact" onClick={handleBulkDelete}>
              <TrashIcon width={14} height={14} /> Delete
            </button>
          </div>
        </div>
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
      <BottomTabBar />
    </div>
  )
}
