import { useState } from 'react'
import CategoryChip from './CategoryChip'
import LabelChip from './LabelChip'
import RescheduleMenu from './RescheduleMenu'
import { CalendarIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, LockIcon, PencilIcon, RepeatIcon, TrashIcon } from './icons'
import { formatTimeLabel, todayISO } from '../utils/dateUtils'
import { useLabelsContext } from '../hooks/LabelsContext'
import { useCategoriesContext } from '../hooks/CategoriesContext'
import { useTasksContext } from '../hooks/TasksContext'
import { formatDuration } from '../utils/duration'
import { openBlockerFor } from '../utils/dependencies'

export default function TaskItem({
  task,
  onToggle,
  onDelete,
  onReorder,
  isFirst,
  isLast,
  onToggleSubtask,
  onReschedule,
  onEdit,
  isPremium,
  selectMode,
  selected,
  onToggleSelect,
}) {
  const [expanded, setExpanded] = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)
  const { colorFor } = useLabelsContext()
  const { colorForCategory } = useCategoriesContext()
  const { tasks } = useTasksContext()

  const isRecurring = task.recurrence && task.recurrence !== 'none'
  const isDone = isRecurring ? (task.completedDates ?? []).includes(todayISO()) : task.done
  const subtasks = task.subtasks ?? []
  const doneSubtasks = subtasks.filter((s) => s.done).length
  const labels = task.labels ?? []
  const hasExpandable = subtasks.length > 0 || Boolean(task.notes) || Boolean(task.voiceNote)
  const priority = task.priority && task.priority !== 'none' ? task.priority : null
  const blocker = isDone ? null : openBlockerFor(task, tasks, todayISO())

  const handleBodyClick = () => {
    if (selectMode) {
      onToggleSelect?.(task.id)
    } else if (hasExpandable) {
      setExpanded((e) => !e)
    }
  }

  const handleToggle = () => {
    if (blocker && !window.confirm(`This task is blocked by "${blocker.title || 'another task'}". Mark done anyway?`)) {
      return
    }
    onToggle(task.id)
  }

  return (
    <div className={`task-card${isDone ? ' task-card--done' : ''}`}>
      <div className="task-card__row">
        {selectMode ? (
          <button
            type="button"
            className={`task-card__select-checkbox${selected ? ' task-card__select-checkbox--checked' : ''}`}
            onClick={() => onToggleSelect?.(task.id)}
            aria-label={selected ? 'Deselect task' : 'Select task'}
          >
            {selected && <CheckIcon width={12} height={12} />}
          </button>
        ) : (
          <button
            type="button"
            className={`task-card__checkbox${isDone ? ' task-card__checkbox--checked' : ''}${
              priority && !isDone ? ` task-card__checkbox--${priority}` : ''
            }`}
            onClick={handleToggle}
            aria-label={isDone ? 'Mark task as not done' : 'Mark task as done'}
          >
            {isDone && <CheckIcon />}
          </button>
        )}

        <div className="task-card__body" onClick={handleBodyClick}>
          <p className="task-card__title">
            <span className="task-card__title-text">{task.title || 'Untitled task'}</span>
            {isRecurring && <RepeatIcon className="task-card__repeat-icon" />}
          </p>
          <p className="task-card__meta">
            {task.time && <span className="task-card__meta-item">{formatTimeLabel(task.time)}</span>}
            {task.time && <span className="task-card__meta-dot">·</span>}
            {task.durationMinutes > 0 && (
              <span className="task-card__meta-item">{formatDuration(task.durationMinutes)}</span>
            )}
            {task.durationMinutes > 0 && <span className="task-card__meta-dot">·</span>}
            <CategoryChip category={task.category} color={colorForCategory(task.category)} />
            {labels.length > 0 && <span className="task-card__meta-dot">·</span>}
            {labels.slice(0, 3).map((name) => (
              <LabelChip key={name} name={name} color={colorFor(name)} />
            ))}
            {subtasks.length > 0 && <span className="task-card__meta-dot">·</span>}
            {subtasks.length > 0 && (
              <span className="task-card__meta-item">
                {doneSubtasks}/{subtasks.length} done
              </span>
            )}
            {blocker && <span className="task-card__meta-dot">·</span>}
            {blocker && (
              <span className="task-card__meta-item task-card__meta-item--blocked">
                <LockIcon width={11} height={11} /> Blocked by "{blocker.title || 'another task'}"
              </span>
            )}
          </p>
        </div>

        {!selectMode && onReorder && (
          <div className="task-card__reorder">
            <button
              type="button"
              className="task-card__reorder-btn"
              onClick={() => onReorder(task.id, 'up')}
              disabled={isFirst}
              aria-label="Move task up"
            >
              <ChevronUpIcon />
            </button>
            <button
              type="button"
              className="task-card__reorder-btn"
              onClick={() => onReorder(task.id, 'down')}
              disabled={isLast}
              aria-label="Move task down"
            >
              <ChevronDownIcon />
            </button>
          </div>
        )}

        {!selectMode && isPremium && onReschedule && !isDone && (
          <button
            type="button"
            className={`task-card__reschedule-toggle${showReschedule ? ' task-card__reschedule-toggle--active' : ''}`}
            onClick={() => setShowReschedule((v) => !v)}
            aria-label="Reschedule this task"
            aria-expanded={showReschedule}
          >
            <CalendarIcon />
          </button>
        )}

        {!selectMode && onEdit && (
          <button
            type="button"
            className="task-card__edit"
            onClick={() => onEdit(task)}
            aria-label={`Edit ${task.title || 'task'}`}
          >
            <PencilIcon />
          </button>
        )}

        {!selectMode && onDelete && (
          <button
            type="button"
            className="task-card__delete"
            onClick={() => onDelete(task)}
            aria-label="Delete task"
          >
            <TrashIcon />
          </button>
        )}
      </div>

      {!selectMode && isPremium && onReschedule && !isDone && showReschedule && (
        <RescheduleMenu
          task={task}
          onReschedule={(date, time) => {
            onReschedule(task.id, date, time)
            setShowReschedule(false)
          }}
        />
      )}

      {expanded && hasExpandable && (
        <div className="task-card__subtasks">
          {task.notes && <p className="task-card__notes">{task.notes}</p>}
          {task.voiceNote && <audio controls src={task.voiceNote} className="voice-note-player" />}
          {subtasks.map((subtask) => (
            <label key={subtask.id} className="subtask-row">
              <input
                type="checkbox"
                checked={subtask.done}
                onChange={() => onToggleSubtask?.(task.id, subtask.id)}
              />
              <span className={subtask.done ? 'subtask-row__title--done' : ''}>{subtask.title}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
