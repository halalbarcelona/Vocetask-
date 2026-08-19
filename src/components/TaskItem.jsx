import CategoryChip from './CategoryChip'
import { CheckIcon } from './icons'
import { formatTimeLabel } from '../utils/dateUtils'

export default function TaskItem({ task, onToggle }) {
  return (
    <div className={`task-card${task.done ? ' task-card--done' : ''}`}>
      <button
        type="button"
        className={`task-card__checkbox${task.done ? ' task-card__checkbox--checked' : ''}`}
        onClick={() => onToggle(task.id)}
        aria-label={task.done ? 'Mark task as not done' : 'Mark task as done'}
      >
        {task.done && <CheckIcon />}
      </button>

      <div className="task-card__body">
        <p className="task-card__title">{task.title || 'Untitled task'}</p>
        {task.time && <p className="task-card__time">{formatTimeLabel(task.time)}</p>}
      </div>

      <CategoryChip category={task.category} />
    </div>
  )
}
