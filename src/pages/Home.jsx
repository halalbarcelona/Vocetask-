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
import { isDueOn, isOverdue } from '../utils/recurrence'
import { computeStreak } from '../utils/stats'
import { speakDailyRecap } from '../utils/speak'
import { checkMilestone } from '../utils/milestones'

const PRIORITY_RANK = { high: 3, medium: 2, low: 1, none: 0 }

// Shown in the first-run empty state so the Hinglish parsing — the thing that
// makes this app different — gets discovered instead of sitting undiscovered.
const VOICE_EXAMPLES = [
  'kal subah 9 baje call mummy',
  'aaj shaam 6 baje gym',
  'Team meeting tomorrow at 3pm',
]

const SpeechRecognitionAPI =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined

export default function Home() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    tasks,
    addTask,
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
  const { isPremium, isPaid, trialActive, trialExpired, trialDaysLeft } = usePremiumContext()
  const { toast, showToast, dismissToast } = useToast()
  const [query, setQuery] = useState('')
  const [sortByPriority, setSortByPriority] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [listening, setListening] = useState(false)
  const [quickAdd, setQuickAdd] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
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

  // Send them to the recap once, the first time they open the app after the
  // trial lapses. The flag keeps it from reappearing on every visit.
  useEffect(() => {
    if (trialExpired && !isPaid && !localStorage.getItem('aura-trial-recap-seen')) {
      localStorage.setItem('aura-trial-recap-seen', 'true')
      navigate('/trial-ended')
    }
  }, [trialExpired, isPaid, navigate])

  // Celebrate real progress, and only then mention Premium — people buy
  // when they feel good about the app, not when it blocks them.
  useEffect(() => {
    const milestone = checkMilestone(tasks, computeStreak(tasks))
    if (!milestone) return
    showToast(milestone.message, {
      actionLabel: isPaid ? undefined : 'See Premium',
      onAction: isPaid ? undefined : () => navigate('/upgrade'),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks])

  const today = todayISO()
  const isSearching = query.trim().length > 0

  const matchesCategory = (t) => categoryFilter === 'All' || t.category === categoryFilter

  let todayTasks = tasks
    .filter((t) => isDueOn(t, today) && matchesCategory(t))
    .sort((a, b) => a.order - b.order)
  if (isPremium && sortByPriority) {
    todayTasks = [...todayTasks].sort(
      (a, b) => (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0),
    )
  }

  // Split today's list so finished work collapses to the bottom and the
  // active list stays short.
  const isTaskDone = (t) =>
    t.recurrence && t.recurrence !== 'none' ? (t.completedDates ?? []).includes(today) : t.done
  const activeToday = todayTasks.filter((t) => !isTaskDone(t))
  const doneToday = todayTasks.filter(isTaskDone)

  const overdueTasks = tasks
    .filter((t) => isOverdue(t, today) && matchesCategory(t))
    .sort((a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')))

  const searchResults = isSearching
    ? tasks
        .filter((t) => t.title.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')))
    : []

  const todayTaskIds = todayTasks.map((t) => t.id)
  const streak = computeStreak(tasks)

  // Categories actually in use today, so the filter row never shows an
  // option that would produce an empty list.
  const usedCategories = [...new Set(tasks.filter((t) => isDueOn(t, today)).map((t) => t.category))]

  const handleMicTap = () => {
    navigate('/record')
  }

  const handleManualAdd = () => {
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

  const handleQuickAdd = () => {
    const title = quickAdd.trim()
    if (!title) return
    addTask({ title, date: today, time: '', category: 'Personal' })
    setQuickAdd('')
  }

  // Reopens an existing task in the Confirm screen. The id riding along in
  // the draft is what makes Confirm save an update instead of a new task.
  const handleEdit = (task) => {
    setDraftTask({ ...task })
    navigate('/confirm')
  }

  const handleExampleTap = (example) => {
    navigate('/record', { state: { prefill: example } })
  }

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
        {trialActive && !isPaid && (
          <button
            type="button"
            className={`trial-banner${trialDaysLeft <= 2 ? ' trial-banner--urgent' : ''}`}
            onClick={() => navigate('/upgrade')}
          >
            <span>
              ✨ Premium trial — {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} left
            </span>
            <span className="trial-banner__cta">Keep it →</span>
          </button>
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

        {isSearching ? (
          <section>
            <h2 className="section-title">Search Results</h2>
            {searchResults.length === 0 ? (
              <div className="empty-state">
                <p>No matching tasks.</p>
              </div>
            ) : (
              <div className="task-list">
                {searchResults.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={toggleDone}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    onToggleSubtask={toggleSubtask}
                    onSnooze={handleSnooze}
                    isPremium={isPremium}
                    selectMode={selectMode}
                    selected={selectedIds.includes(task.id)}
                    onToggleSelect={handleToggleSelect}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            {!selectMode && (
              <div className="quick-add">
                <PlusIcon width={16} height={16} />
                <input
                  type="text"
                  placeholder="Quick add a task for today…"
                  value={quickAdd}
                  onChange={(e) => setQuickAdd(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleQuickAdd()
                    }
                  }}
                />
                {quickAdd.trim() && (
                  <button type="button" className="button button--primary button--compact" onClick={handleQuickAdd}>
                    Add
                  </button>
                )}
              </div>
            )}

            {usedCategories.length > 1 && (
              <div className="filter-row">
                {['All', ...usedCategories].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`filter-chip${categoryFilter === option ? ' filter-chip--active' : ''}`}
                    onClick={() => setCategoryFilter(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {overdueTasks.length > 0 && (
              <section>
                <h2 className="section-title section-title--danger">Overdue · {overdueTasks.length}</h2>
                <div className="task-list">
                  {overdueTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={toggleDone}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                      onToggleSubtask={toggleSubtask}
                      onSnooze={handleSnooze}
                      isPremium={isPremium}
                      selectMode={selectMode}
                      selected={selectedIds.includes(task.id)}
                      onToggleSelect={handleToggleSelect}
                    />
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="section-title-row">
                <h2 className="section-title">Today</h2>
                <button
                  type="button"
                  className={`sort-toggle${sortByPriority ? ' sort-toggle--active' : ''}`}
                  onClick={handleTogglePrioritySort}
                >
                  Sort by priority
                </button>
              </div>

              {todayTasks.length > 0 && (
                <div className="progress">
                  <div className="progress__track">
                    <div
                      className="progress__fill"
                      style={{ width: `${(doneToday.length / todayTasks.length) * 100}%` }}
                    />
                  </div>
                  <span className="progress__label">
                    {doneToday.length} of {todayTasks.length} done
                  </span>
                </div>
              )}

              {todayTasks.length === 0 ? (
                <div className="empty-state">
                  <p>No tasks for today yet.</p>
                  <p className="empty-state__hint">
                    Try saying one out loud:
                  </p>
                  <div className="example-list">
                    {VOICE_EXAMPLES.map((example) => (
                      <button
                        key={example}
                        type="button"
                        className="example-chip"
                        onClick={() => handleExampleTap(example)}
                      >
                        <MicIcon width={13} height={13} /> “{example}”
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="task-list">
                  {activeToday.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={toggleDone}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                      onToggleSubtask={toggleSubtask}
                      onSnooze={handleSnooze}
                      isPremium={isPremium}
                      onReorder={sortByPriority ? undefined : (id, dir) => reorderTask(id, dir, todayTaskIds)}
                      isFirst={todayTaskIds.indexOf(task.id) === 0}
                      isLast={todayTaskIds.indexOf(task.id) === todayTaskIds.length - 1}
                      selectMode={selectMode}
                      selected={selectedIds.includes(task.id)}
                      onToggleSelect={handleToggleSelect}
                    />
                  ))}
                </div>
              )}
            </section>

            {doneToday.length > 0 && (
              <section>
                <h2 className="section-title">Done · {doneToday.length}</h2>
                <div className="task-list">
                  {doneToday.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={toggleDone}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                      onToggleSubtask={toggleSubtask}
                      isPremium={isPremium}
                      selectMode={selectMode}
                      selected={selectedIds.includes(task.id)}
                      onToggleSelect={handleToggleSelect}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
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
