import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import CategoryChip from '../components/CategoryChip'
import { BackIcon } from '../components/icons'
import { remainingFreeTasks } from '../utils/plan'

const CATEGORIES = ['Personal', 'Work']

export default function Confirm() {
  const navigate = useNavigate()
  const { tasks, draftTask, setDraftTask, addTask, clearDraft } = useTasksContext()
  const { isPremium } = usePremiumContext()

  useEffect(() => {
    if (!draftTask) navigate('/', { replace: true })
  }, [draftTask, navigate])

  if (!draftTask) return null

  const remaining = isPremium ? Infinity : remainingFreeTasks(tasks)
  const limitReached = remaining <= 0

  const updateDraft = (updates) => setDraftTask({ ...draftTask, ...updates })

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
