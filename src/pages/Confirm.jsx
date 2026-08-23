import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import { useCategoriesContext } from '../hooks/CategoriesContext'
import { useTemplates } from '../hooks/useTemplates'
import CategoryChip from '../components/CategoryChip'
import { BackIcon, LockIcon, PlusIcon, TrashIcon } from '../components/icons'

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom days' },
]

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'S' },
  { value: 1, label: 'M' },
  { value: 2, label: 'T' },
  { value: 3, label: 'W' },
  { value: 4, label: 'T' },
  { value: 5, label: 'F' },
  { value: 6, label: 'S' },
]

const PRIORITY_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const REMINDER_LEAD_OPTIONS = [
  { value: 0, label: 'At the time' },
  { value: 5, label: '5 min before' },
  { value: 15, label: '15 min before' },
  { value: 30, label: '30 min before' },
  { value: 60, label: '1 hour before' },
]

function subtaskId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `subtask-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function PremiumLabel({ isPremium, children }) {
  return (
    <span className="field__label">
      {children}
      {!isPremium && (
        <span className="field__label-badge">
          <LockIcon width={12} height={12} /> Premium
        </span>
      )}
    </span>
  )
}

export default function Confirm() {
  const navigate = useNavigate()
  const { draftTask, setDraftTask, addTask, updateTask, clearDraft } = useTasksContext()
  const { isPremium } = usePremiumContext()
  const { categories, addCategory } = useCategoriesContext()
  const { saveTemplate } = useTemplates()
  const [subtaskInput, setSubtaskInput] = useState('')
  const [templateSaved, setTemplateSaved] = useState(false)

  useEffect(() => {
    if (!draftTask) navigate('/', { replace: true })
  }, [draftTask, navigate])

  if (!draftTask) return null

  // An existing task being edited carries its id; a brand-new draft doesn't.
  const isEditing = Boolean(draftTask.id)
  const subtasks = draftTask.subtasks ?? []
  const recurrenceDays = draftTask.recurrenceDays ?? []

  const updateDraft = (updates) => setDraftTask({ ...draftTask, ...updates })

  const requirePremium = (action) => {
    if (!isPremium) {
      navigate('/upgrade')
      return
    }
    action()
  }

  const handleAddSubtask = () => {
    requirePremium(() => {
      const title = subtaskInput.trim()
      if (!title) return
      updateDraft({ subtasks: [...subtasks, { id: subtaskId(), title, done: false }] })
      setSubtaskInput('')
    })
  }

  const handleRemoveSubtask = (id) => {
    updateDraft({ subtasks: subtasks.filter((s) => s.id !== id) })
  }

  const handleSelectRecurrence = (value) => {
    if (value !== 'none' && !isPremium) {
      navigate('/upgrade')
      return
    }
    updateDraft({ recurrence: value })
  }

  const handleToggleWeekday = (day) => {
    const has = recurrenceDays.includes(day)
    updateDraft({ recurrenceDays: has ? recurrenceDays.filter((d) => d !== day) : [...recurrenceDays, day] })
  }

  const handleSelectPriority = (value) => {
    if (value !== 'none' && !isPremium) {
      navigate('/upgrade')
      return
    }
    updateDraft({ priority: value })
  }

  const handleAddCategory = () => {
    requirePremium(() => {
      const name = window.prompt('New category name')
      if (!name) return
      addCategory(name)
      updateDraft({ category: name.trim() })
    })
  }

  const handleSaveTemplate = () => {
    requirePremium(() => {
      saveTemplate(draftTask)
      setTemplateSaved(true)
      setTimeout(() => setTemplateSaved(false), 2000)
    })
  }

  const handleSave = () => {
    if (isEditing) {
      const { id, source, ...updates } = draftTask
      updateTask(id, updates)
      clearDraft()
      navigate('/', { state: { toast: 'Task updated' } })
      return
    }
    addTask(draftTask)
    clearDraft()
    navigate('/')
  }

  const handleDiscard = () => {
    clearDraft()
    navigate('/')
  }

  const hint = isEditing
    ? 'Edit this task and save your changes.'
    : draftTask.source === 'voice'
      ? 'Check the details — we parsed your voice command. Tap any field to edit.'
      : 'Fill in the details for your task.'

  return (
    <div className="screen">
      <header className="page-header">
        <button type="button" className="icon-button" onClick={handleDiscard} aria-label="Discard and go back">
          <BackIcon />
        </button>
        <h1 className="page-header__title">{isEditing ? 'Edit Task' : 'Confirm Task'}</h1>
        <span className="icon-button icon-button--spacer" />
      </header>

      <main className="screen__content">
        <p className="confirm-hint">{hint}</p>

        <div className="card confirm-card">
          <label className="field">
            <span className="field__label">Task Title</span>
            <input
              type="text"
              className="field__input"
              value={draftTask.title}
              onChange={(e) => updateDraft({ title: e.target.value })}
              placeholder="What do you need to do?"
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field__label">Date</span>
              <input
                type="date"
                className="field__input"
                value={draftTask.date}
                onChange={(e) => updateDraft({ date: e.target.value })}
              />
            </label>

            <label className="field">
              <span className="field__label">Time</span>
              <input
                type="time"
                className="field__input"
                value={draftTask.time}
                onChange={(e) => updateDraft({ time: e.target.value })}
              />
            </label>
          </div>

          <div className="field">
            <span className="field__label">Category</span>
            <div className="chip-row">
              {categories.map((category) => (
                <CategoryChip
                  key={category}
                  category={category}
                  selected={draftTask.category === category}
                  onClick={() => updateDraft({ category })}
                />
              ))}
              <button type="button" className="chip chip--button chip--add" onClick={handleAddCategory}>
                {isPremium ? <PlusIcon width={14} height={14} /> : <LockIcon width={14} height={14} />} New
              </button>
            </div>
          </div>

          <div className="field">
            <PremiumLabel isPremium={isPremium}>Priority</PremiumLabel>
            <div className="chip-row">
              {PRIORITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`priority-chip priority-chip--${option.value}${draftTask.priority === option.value || (!draftTask.priority && option.value === 'none') ? ' priority-chip--selected' : ''}${option.value !== 'none' && !isPremium ? ' priority-chip--locked' : ''}`}
                  onClick={() => handleSelectPriority(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <PremiumLabel isPremium={isPremium}>Repeat</PremiumLabel>
            <div className="recurrence-row">
              {RECURRENCE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`recurrence-chip${draftTask.recurrence === option.value || (!draftTask.recurrence && option.value === 'none') ? ' recurrence-chip--selected' : ''}${option.value !== 'none' && !isPremium ? ' recurrence-chip--locked' : ''}`}
                  onClick={() => handleSelectRecurrence(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {draftTask.recurrence === 'custom' && (
              <div className="weekday-row">
                {WEEKDAY_OPTIONS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    className={`weekday-chip${recurrenceDays.includes(day.value) ? ' weekday-chip--selected' : ''}`}
                    onClick={() => handleToggleWeekday(day.value)}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {draftTask.time && (
            <label className="field">
              <PremiumLabel isPremium={isPremium}>Remind me</PremiumLabel>
              <select
                className="field__input"
                value={draftTask.reminderLeadMinutes ?? 0}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  if (value !== 0 && !isPremium) {
                    navigate('/upgrade')
                    return
                  }
                  updateDraft({ reminderLeadMinutes: value })
                }}
              >
                {REMINDER_LEAD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="field">
            <PremiumLabel isPremium={isPremium}>Notes</PremiumLabel>
            <textarea
              className="field__input"
              rows={3}
              placeholder={isPremium ? 'Add notes…' : 'Upgrade to add notes'}
              value={draftTask.notes ?? ''}
              readOnly={!isPremium}
              onClick={() => !isPremium && navigate('/upgrade')}
              onChange={(e) => isPremium && updateDraft({ notes: e.target.value })}
            />
          </label>

          <div className="field">
            <PremiumLabel isPremium={isPremium}>Subtasks</PremiumLabel>
            <div className="subtask-input-row">
              <input
                type="text"
                placeholder={isPremium ? 'Add a subtask' : 'Upgrade to add subtasks'}
                value={subtaskInput}
                onChange={(e) => setSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddSubtask()
                  }
                }}
              />
              <button type="button" className="button button--primary button--compact" onClick={handleAddSubtask}>
                Add
              </button>
            </div>
            {subtasks.length > 0 && (
              <div className="subtask-list">
                {subtasks.map((s) => (
                  <div key={s.id} className="subtask-list-row">
                    <span>{s.title}</span>
                    <button
                      type="button"
                      className="subtask-list-row__remove"
                      onClick={() => handleRemoveSubtask(s.id)}
                      aria-label={`Remove subtask ${s.title}`}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="confirm-actions">
          <button type="button" className="button button--primary button--wide" onClick={handleSave}>
            {isEditing ? 'Save Changes' : 'Save Task'}
          </button>
          <button type="button" className="button button--ghost button--wide" onClick={handleSaveTemplate}>
            {templateSaved ? 'Saved as Template ✓' : 'Save as Template'}
          </button>
          <button type="button" className="button button--ghost button--wide" onClick={handleDiscard}>
            {isEditing ? 'Cancel' : 'Discard'}
          </button>
        </div>
      </main>
    </div>
  )
}
