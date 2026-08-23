import { useState } from 'react'
import CategoryChip from './CategoryChip'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon, RepeatIcon, TrashIcon } from './icons'
import { formatTimeLabel, todayISO, tomorrowISO } from '../utils/dateUtils'

export default function TaskItem({
  task,
  onToggle,
  onDelete,
  onReorder,
  isFirst,
  isLast,
  onToggleSubtask,
  onSnooze,
  onEdit,
  isPremium,
  selectMode,
  selected,
  onToggleSelect,
}) {
  const [expanded, setExpanded] = useState(false)

  const isRecurring = task.recurrence && task.recurrence !== 'none'
  const isDone = isRecurring ? (task.completedDates ?? []).includes(todayISO()) : task.done
  const subtasks = task.subtasks ?? []
  const doneSubtasks = subtasks.filter((s) => s.done).length
  const hasExpandable = subtasks.length > 0 || Boolean(task.notes)
  const priority = task.priority && task.priority !== 'none' ? task.priority : null

  const handleBodyClick = () => {
    if (selectMode) {
      onToggleSelect?.(task.id)
    } else if (hasExpandable) {
      setExpanded((e) => !e)
    }
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
            onClick={() => onToggle(task.id)}
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
            <CategoryChip category={task.category} />
            {subtasks.length > 0 && <span className="task-card__meta-dot">·</span>}
            {subtasks.length > 0 && (
              <span className="task-card__meta-item">
                {doneSubtasks}/{subtasks.length} done
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

      {!selectMode && isPremium && onSnooze && !isDone && (
        <div className="task-card__snooze-row">
          <button type="button" className="task-card__snooze-btn" onClick={() => onSnooze(task.id, tomorrowISO())}>
            Snooze to tomorrow
          </button>
          <button
            type="button"
            className="task-card__snooze-btn"
            onClick={() => {
              const d = new Date()
              d.setDate(d.getDate() + 7)
              onSnooze(task.id, d.toISOString().slice(0, 10))
            }}
          >
            Snooze 1 week
          </button>
        </div>
      )}

      {expanded && hasExpandable && (
        <div className="task-card__subtasks">
          {task.notes && <p className="task-card__notes">{task.notes}</p>}
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
