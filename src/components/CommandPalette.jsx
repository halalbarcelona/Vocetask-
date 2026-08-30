import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCommandPaletteContext } from '../hooks/CommandPaletteContext'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import {
  CalendarIcon,
  ChartIcon,
  CheckIcon,
  ColumnsIcon,
  FilterIcon,
  FlameIcon,
  HomeIcon,
  LayersIcon,
  PlusIcon,
  RepeatIcon,
  SearchIcon,
  SettingsIcon,
  SparkIcon,
  TagIcon,
  TimerIcon,
} from './icons'
import { formatDateLabel, formatTimeLabel, todayISO } from '../utils/dateUtils'

// Every destination the palette can jump to. `premium` marks routes that
// redirect to /upgrade for a free user — same gate Settings.jsx uses for
// these same rows, just reachable a second way.
function useCommands() {
  const navigate = useNavigate()
  const { setDraftTask } = useTasksContext()

  return useMemo(
    () => [
      { id: 'new-task', label: 'New task', group: 'Actions', Icon: PlusIcon, run: () => {
        setDraftTask({ title: '', date: todayISO(), time: '', category: 'Personal', source: 'manual' })
        navigate('/confirm')
      } },
      { id: 'today', label: 'Today', group: 'Go to', Icon: HomeIcon, run: () => navigate('/') },
      { id: 'upcoming', label: 'Upcoming', group: 'Go to', Icon: SparkIcon, premium: true, run: () => navigate('/upcoming') },
      { id: 'calendar', label: 'Calendar', group: 'Go to', Icon: CalendarIcon, run: () => navigate('/calendar') },
      { id: 'focus', label: 'Focus timer', group: 'Go to', Icon: TimerIcon, premium: true, run: () => navigate('/focus') },
      { id: 'habits', label: 'Habits', group: 'Go to', Icon: FlameIcon, premium: true, run: () => navigate('/habits') },
      { id: 'board', label: 'Board', group: 'Go to', Icon: ColumnsIcon, premium: true, run: () => navigate('/board') },
      { id: 'timeline', label: 'Timeline', group: 'Go to', Icon: CalendarIcon, premium: true, run: () => navigate('/timeline') },
      { id: 'stats', label: 'Productivity report', group: 'Go to', Icon: ChartIcon, premium: true, run: () => navigate('/stats') },
      { id: 'review', label: 'Weekly review', group: 'Go to', Icon: ChartIcon, premium: true, run: () => navigate('/review') },
      { id: 'templates', label: 'Task templates', group: 'Go to', Icon: LayersIcon, premium: true, run: () => navigate('/templates') },
      { id: 'filters', label: 'Filters', group: 'Go to', Icon: FilterIcon, premium: true, run: () => navigate('/filters') },
      { id: 'labels', label: 'Manage labels', group: 'Go to', Icon: TagIcon, premium: true, run: () => navigate('/labels') },
      { id: 'sync', label: 'Sync across devices', group: 'Go to', Icon: RepeatIcon, premium: true, run: () => navigate('/sync') },
      { id: 'settings', label: 'Settings', group: 'Go to', Icon: SettingsIcon, run: () => navigate('/settings') },
    ],
    [navigate, setDraftTask],
  )
}

export default function CommandPalette() {
  const { isOpen, close } = useCommandPaletteContext()
  const { tasks, setDraftTask, toggleDone } = useTasksContext()
  const { isPremium } = usePremiumContext()
  const navigate = useNavigate()
  const commands = useCommands()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setActiveIndex(0)
      // Focus after the mount animation's first paint, not before — iOS
      // Safari drops the keyboard focus if it races the sheet's transition.
      const id = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
    return undefined
  }, [isOpen])

  const q = query.trim().toLowerCase()

  const matchedCommands = q ? commands.filter((c) => c.label.toLowerCase().includes(q)) : commands

  const matchedTasks = q
    ? tasks
        .filter((t) => t.title.toLowerCase().includes(q))
        .sort((a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')))
        .slice(0, 6)
    : []

  const taskItems = matchedTasks.map((t) => ({
    id: `task-${t.id}`,
    label: t.title || 'Untitled task',
    group: 'Tasks',
    task: t,
    run: () => {
      setDraftTask({ ...t })
      navigate('/confirm')
    },
  }))

  const items = [...matchedCommands, ...taskItems]

  const isTaskDone = (task) =>
    task.recurrence && task.recurrence !== 'none' ? (task.completedDates ?? []).includes(todayISO()) : task.done

  const handleQuickComplete = (e, taskId) => {
    e.stopPropagation()
    toggleDone(taskId)
    close()
  }

  const runItem = (item) => {
    if (item.premium && !isPremium) {
      navigate('/upgrade')
    } else {
      item.run()
    }
    close()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (items.length ? (i + 1) % items.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (items.length ? (i - 1 + items.length) % items.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[activeIndex]
      if (item) runItem(item)
    }
  }

  if (!isOpen) return null

  let groupCursor = null

  return (
    <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onClick={close}>
      <div className="palette__sheet" onClick={(e) => e.stopPropagation()}>
        <div className="palette__search">
          <SearchIcon width={18} height={18} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks, or jump somewhere…"
            aria-label="Search tasks and commands"
          />
          <kbd className="palette__esc">esc</kbd>
        </div>

        <div className="palette__list" role="listbox">
          {items.length === 0 && <p className="palette__empty">No matches.</p>}
          {items.map((item, index) => {
            const showHeader = item.group !== groupCursor
            groupCursor = item.group
            return (
              <div key={item.id}>
                {showHeader && <p className="palette__group">{item.group}</p>}
                <div className="palette__row">
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`palette__item${index === activeIndex ? ' palette__item--active' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => runItem(item)}
                  >
                    {item.Icon ? (
                      <item.Icon width={16} height={16} />
                    ) : (
                      <span className="palette__item-dot" aria-hidden="true" />
                    )}
                    <span className="palette__item-label">{item.label}</span>
                    {item.task && (item.task.date || item.task.time) && (
                      <span className="palette__item-meta">
                        {item.task.date ? formatDateLabel(item.task.date) : ''}
                        {item.task.time ? `, ${formatTimeLabel(item.task.time)}` : ''}
                      </span>
                    )}
                    {item.premium && !isPremium && <span className="palette__item-meta">Premium</span>}
                  </button>
                  {item.task && !isTaskDone(item.task) && (
                    <button
                      type="button"
                      className="palette__item-complete"
                      onClick={(e) => handleQuickComplete(e, item.task.id)}
                      aria-label={`Mark ${item.label} as done`}
                    >
                      <CheckIcon width={12} height={12} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
