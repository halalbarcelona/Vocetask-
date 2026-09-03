import { useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { useTemplates } from '../hooks/useTemplates'
import { usePremiumContext } from '../hooks/PremiumContext'
import LockedOverlay from '../components/LockedOverlay'
import { BackIcon, LayersIcon, TrashIcon } from '../components/icons'
import { todayISO } from '../utils/dateUtils'

function subtaskId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `subtask-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function Templates() {
  const navigate = useNavigate()
  const { addTask } = useTasksContext()
  const { templates, removeTemplate } = useTemplates()
  const { isPremium } = usePremiumContext()

  const handleUse = (template) => {
    // A template's own id/name are metadata for this list, not task fields —
    // spreading them straight onto the new task would leak them in. Subtasks
    // need fresh ids and a clean done state too, or reusing a template whose
    // subtasks were checked off last time starts the new task half-finished.
    const { id, name, subtasks, ...taskFields } = template
    addTask({
      ...taskFields,
      date: todayISO(),
      subtasks: (subtasks ?? []).map((s) => ({ ...s, id: subtaskId(), done: false })),
    })
    navigate('/', { state: { toast: `Added "${name}" for today` } })
  }

  return (
    <div className="screen">
      <header className="page-header">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Go back">
          <BackIcon />
        </button>
        <h1 className="page-header__title">Task templates</h1>
        <span className="icon-button icon-button--spacer" />
      </header>

      <main className="screen__content">
        <p className="confirm-hint">
          Save any task as a template from the Confirm screen, then reuse it here with one tap.
        </p>

        <LockedOverlay
          locked={!isPremium}
          title={templates.length > 0 ? `You saved ${templates.length} template${templates.length === 1 ? '' : 's'}` : 'Templates are Premium'}
          subtitle="Unlock Premium to reuse them with one tap."
        >

        {templates.length === 0 ? (
          <div className="empty-state">
            <LayersIcon width={28} height={28} className="empty-state__icon" />
            <p>No templates yet.</p>
            <p className="empty-state__hint">
              Fill in a task, then tap "Save as Template" before saving it.
            </p>
          </div>
        ) : (
          <div className="task-list">
            {templates.map((template) => (
              <div key={template.id} className="card template-card">
                <div>
                  <p className="template-card__name">{template.name}</p>
                  <p className="template-card__meta">
                    {template.category}
                    {template.time ? ` · ${template.time}` : ''}
                    {template.recurrence !== 'none' ? ` · ${template.recurrence}` : ''}
                  </p>
                </div>
                <div className="template-card__actions">
                  <button type="button" className="button button--primary button--compact" onClick={() => handleUse(template)}>
                    Use
                  </button>
                  <button
                    type="button"
                    className="template-card__remove"
                    onClick={() => removeTemplate(template.id)}
                    aria-label={`Delete template ${template.name}`}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        </LockedOverlay>
      </main>
    </div>
  )
}
