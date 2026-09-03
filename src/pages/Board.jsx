import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import { useUILangContext } from '../hooks/UILangContext'
import LockedOverlay from '../components/LockedOverlay'
import { BackIcon, CheckIcon } from '../components/icons'
import { formatDateLabel, todayISO, tomorrowISO } from '../utils/dateUtils'
import { isDueOn } from '../utils/recurrence'

function isTaskDone(task, today) {
  return task.recurrence && task.recurrence !== 'none' ? (task.completedDates ?? []).includes(today) : task.done
}

function columnFor(task, today) {
  if (isTaskDone(task, today)) return 'done'
  if (!task.date || task.date <= today) return 'todo'
  return 'scheduled'
}

export default function Board() {
  const navigate = useNavigate()
  const { tasks, updateTask, toggleDone, setDraftTask } = useTasksContext()
  const { isPremium } = usePremiumContext()
  const { t } = useUILangContext()
  const [dragTaskId, setDragTaskId] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)

  // Three buckets, not the six-or-seven-status board a full custom-statuses
  // system would need — those don't exist yet (see the audit backlog), and a
  // board with more columns than a user has ever needed is worse than no
  // board. These three read straight off fields tasks already have (date,
  // done), so this needed no schema change to ship.
  const COLUMNS = [
    { id: 'todo', title: t('columnTodo') },
    { id: 'scheduled', title: t('columnScheduled') },
    { id: 'done', title: t('columnDone') },
  ]

  const today = todayISO()

  const grouped = useMemo(() => {
    const buckets = { todo: [], scheduled: [], done: [] }
    for (const task of tasks) {
      const isRecurring = task.recurrence && task.recurrence !== 'none'
      // A one-off task's own `date` already says where it belongs, whatever
      // that date is. A recurring task's `date` is just when it was
      // created, not "today" — so it only earns a spot on the board when
      // it's actually due (or already completed) today.
      if (isRecurring && !isDueOn(task, today) && !isTaskDone(task, today)) continue
      buckets[columnFor(task, today)].push(task)
    }
    return buckets
  }, [tasks, today])

  // Board's job is moving cards between buckets, not full editing — tap
  // opens the same Confirm screen every other list already uses for that.
  const handleEdit = (task) => {
    setDraftTask({ ...task })
    navigate('/confirm')
  }

  const moveTo = (task, columnId) => {
    const isRecurring = task.recurrence && task.recurrence !== 'none'
    if (isRecurring) {
      // A recurring task's "done" bucket is just today's occurrence — the
      // same toggle Home and Habits already use. Its date is owned by the
      // recurrence rule, not draggable.
      if (columnId === 'done' && !isTaskDone(task, today)) toggleDone(task.id, today)
      if (columnId !== 'done' && isTaskDone(task, today)) toggleDone(task.id, today)
      return
    }
    if (columnId === 'done') {
      updateTask(task.id, { done: true })
    } else if (columnId === 'todo') {
      updateTask(task.id, { done: false, date: today })
    } else if (columnId === 'scheduled') {
      updateTask(task.id, { done: false, date: task.date && task.date > today ? task.date : tomorrowISO() })
    }
  }

  const handleDrop = (columnId) => {
    if (dragTaskId) {
      const task = tasks.find((t) => t.id === dragTaskId)
      if (task) moveTo(task, columnId)
    }
    setDragTaskId(null)
    setDragOverColumn(null)
  }

  return (
    <div className="screen">
      <header className="page-header">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Go back">
          <BackIcon />
        </button>
        <h1 className="page-header__title">{t('boardTitle')}</h1>
        <span className="icon-button icon-button--spacer" />
      </header>

      <main className="screen__content">
        <LockedOverlay
          locked={!isPremium}
          title={t('boardUnlockTitle')}
          subtitle={t('boardUnlockSubtitle')}
        >
          <div className="board">
            {COLUMNS.map((column) => (
              <div
                key={column.id}
                className={`board__column${dragOverColumn === column.id ? ' board__column--over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOverColumn(column.id)
                }}
                onDragLeave={() => setDragOverColumn((c) => (c === column.id ? null : c))}
                onDrop={(e) => {
                  e.preventDefault()
                  handleDrop(column.id)
                }}
              >
                <p className="board__column-title">
                  {column.title} <span className="board__column-count">{grouped[column.id].length}</span>
                </p>

                {grouped[column.id].length === 0 ? (
                  <p className="board__empty">{t('boardEmptyColumn')}</p>
                ) : (
                  grouped[column.id].map((task) => {
                    const isRecurring = task.recurrence && task.recurrence !== 'none'
                    return (
                      <div
                        key={task.id}
                        className={`board__card${dragTaskId === task.id ? ' board__card--dragging' : ''}`}
                        draggable={!isRecurring}
                        onDragStart={() => setDragTaskId(task.id)}
                        onDragEnd={() => setDragTaskId(null)}
                        onClick={() => handleEdit(task)}
                        title={isRecurring ? t('recurringDragHint') : undefined}
                      >
                        <p className="board__card-title">{task.title || t('untitledTask')}</p>
                        {task.date && <p className="board__card-meta">{formatDateLabel(task.date)}</p>}
                        {column.id !== 'done' && (
                          <button
                            type="button"
                            className="board__card-done"
                            onClick={(e) => {
                              e.stopPropagation()
                              moveTo(task, 'done')
                            }}
                            aria-label={`Mark ${task.title || 'task'} as done`}
                          >
                            <CheckIcon width={13} height={13} />
                          </button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            ))}
          </div>
        </LockedOverlay>
      </main>
    </div>
  )
}
