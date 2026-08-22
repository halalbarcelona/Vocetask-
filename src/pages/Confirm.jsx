import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import CategoryChip from '../components/CategoryChip'
import { BackIcon, LockIcon, TrashIcon } from '../components/icons'
import { remainingFreeTasks } from '../utils/plan'

const CATEGORIES = ['Personal', 'Work']
const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
]

function subtaskId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `subtask-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function Confirm() {
  const navigate = useNavigate()
  const { tasks, draftTask, setDraftTask, addTask, clearDraft } = useTasksContext()
  const { isPremium } = usePremiumContext()
  const [subtaskInput, setSubtaskInput] = useState('')

  useEffect(() => {
    if (!draftTask) navigate('/', { replace: true })
  }, [draftTask, navigate])

  if (!draftTask) return null

  const remaining = isPremium ? Infinity : remainingFreeTasks(tasks)
  const limitReached = remaining <= 0
  const subtasks = draftTask.subtasks ?? []

  const updateDraft = (updates) => setDraftTask({ ...draftTask, ...updates })

  const handleAddSubtask = () => {
    if (!isPremium) {
      navigate('/upgrade')
      return
    }
    const title = subtaskInput.trim()
    if (!title) return
    updateDraft({ subtasks: [...subtasks, { id: subtaskId(), title, done: false }] })
    setSubtaskInput('')
  }

  const handleSelectRecurrence = (value) => {
    if (value !== 'none' && !isPremium) {
      navigate('/upgrade')
      return
    }
    updateDraft({ recurrence: value })
  }

  const handleRemoveSubtask = (id) => {
    updateDraft({ subtasks: subtasks.filter((s) => s.id !== id) })
  }

  const handleSave = () => {
    if (limitReached) {
      navigate('/upgrade')
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

  const hint =
    draftTask.source === 'voice'
      ? 'Check the details — we parsed your voice command. Tap any field to edit.'
      : 'Fill in the details for your task.'

  return (
    <div className="screen">
      <header className="page-header">
        <button type="button" className="icon-button" onClick={handleDiscard} aria-label="Discard and go back">
          <BackIcon />
        </button>
        <h1 className="page-header__title">Confirm Task</h1>
        <span className="icon-button icon-button--spacer" />
      </header>

      <main className="screen__content">
        <p className="confirm-hint">{hint}</p>

        {!isPremium && (
          <p className={`plan-hint${limitReached ? ' plan-hint--warning' : ''}`}>
            {limitReached
              ? "You've used today's free tasks — upgrade for unlimited."
              : `${remaining} free task${remaining === 1 ? '' : 's'} left today`}
          </p>
        )}

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
              {CATEGORIES.map((category) => (
                <CategoryChip
                  key={category}
                  category={category}
                  selected={draftTask.category === category}
                  onClick={() => updateDraft({ category })}
                />
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field__label">
              Repeat{!isPremium && <span className="field__label-badge"><LockIcon width={12} height={12} /> Premium</span>}
            </span>
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
          </div>

          <div className="field">
            <span className="field__label">
              Subtasks{!isPremium && <span className="field__label-badge"><LockIcon width={12} height={12} /> Premium</span>}
            </span>
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
            {limitReached ? 'Upgrade to Save' : 'Save Task'}
          </button>
          <button type="button" className="button button--ghost button--wide" onClick={handleDiscard}>
            Discard
          </button>
        </div>
      </main>
    </div>
  )
}
