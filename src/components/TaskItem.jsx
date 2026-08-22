import { useState } from 'react'
import CategoryChip from './CategoryChip'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, RepeatIcon, TrashIcon } from './icons'
import { formatTimeLabel, todayISO } from '../utils/dateUtils'

export default function TaskItem({ task, onToggle, onDelete, onReorder, isFirst, isLast, onToggleSubtask }) {
  const [expanded, setExpanded] = useState(false)

  const isRecurring = task.recurrence && task.recurrence !== 'none'
  const isDone = isRecurring ? (task.completedDates ?? []).includes(todayISO()) : task.done
  const subtasks = task.subtasks ?? []
  const doneSubtasks = subtasks.filter((s) => s.done).length

  return (
    <div className={`task-card${isDone ? ' task-card--done' : ''}`}>
      <div className="task-card__row">
        <button
          type="button"
          className={`task-card__checkbox${isDone ? ' task-card__checkbox--checked' : ''}`}
          onClick={() => onToggle(task.id)}
          aria-label={isDone ? 'Mark task as not done' : 'Mark task as done'}
        >
          {isDone && <CheckIcon />}
        </button>

        <div className="task-card__body" onClick={() => subtasks.length > 0 && setExpanded((e) => !e)}>
          <p className="task-card__title">
            <span className="task-card__title-text">{task.title || 'Untitled task'}</span>
            {isRecurring && <RepeatIcon className="task-card__repeat-icon" />}
          </p>
          <p className="task-card__time">
            {task.time && formatTimeLabel(task.time)}
            {subtasks.length > 0 && (
              <span className="task-card__subtask-count">
                {task.time ? ' · ' : ''}
                {doneSubtasks}/{subtasks.length} subtasks
              </span>
            )}
          </p>
        </div>

        <CategoryChip category={task.category} />

        {onReorder && (
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

        {onDelete && (
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

      {expanded && subtasks.length > 0 && (
        <div className="task-card__subtasks">
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
