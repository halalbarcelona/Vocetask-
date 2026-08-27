import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import { useCategoriesContext } from '../hooks/CategoriesContext'
import { useLabelsContext } from '../hooks/LabelsContext'
import { useTemplates } from '../hooks/useTemplates'
import CategoryChip from '../components/CategoryChip'
import LabelChip from '../components/LabelChip'
import { BackIcon, LockIcon, MicIcon, PlusIcon, SparkIcon, StopIcon, TrashIcon } from '../components/icons'
import { DURATION_OPTIONS } from '../utils/duration'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import { suggestSlot } from '../utils/schedule'
import { usePreferencesContext } from '../hooks/PreferencesContext'
import { formatTimeLabel, todayISO } from '../utils/dateUtils'

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
  const { tasks, draftTask, setDraftTask, addTask, updateTask, clearDraft } = useTasksContext()
  const { isPremium } = usePremiumContext()
  const { workStartMinutes, workEndMinutes } = usePreferencesContext()
  const { categories, addCategory, colorForCategory } = useCategoriesContext()
  const { labels, addLabel } = useLabelsContext()
  const { saveTemplate } = useTemplates()
  const recorder = useVoiceRecorder()
  const [subtaskInput, setSubtaskInput] = useState('')
  const [templateSaved, setTemplateSaved] = useState(false)
  const [newLabelInput, setNewLabelInput] = useState('')

  useEffect(() => {
    if (!draftTask) navigate('/', { replace: true })
  }, [draftTask, navigate])

  // Leaving mid-recording (back button, save, discard) shouldn't leave the
  // mic stream open in the background.
  useEffect(() => () => recorder.cancel(), []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Sections aren't a separate registry — they're read off whatever's already
  // in use within this list, so an empty list has none to suggest and a
  // section nobody uses anymore quietly stops being offered.
  const sectionSuggestions = useMemo(() => {
    const inSameCategory = tasks.filter((t) => t.category === draftTask.category && t.section)
    return [...new Set(inSameCategory.map((t) => t.section))]
  }, [tasks, draftTask.category])

  // Only worth suggesting once there's a date and a duration to fit — a
  // task with no length has nothing to schedule around.
  const suggestedTime = useMemo(() => {
    if (!draftTask.date || !draftTask.durationMinutes) return null
    const now = new Date()
    const notBefore = draftTask.date === todayISO() ? now.getHours() * 60 + now.getMinutes() : 0
    return suggestSlot(tasks, draftTask.date, draftTask.durationMinutes, {
      excludeTaskId: draftTask.id,
      notBefore,
      dayStartMinutes: workStartMinutes,
      dayEndMinutes: workEndMinutes,
    })
  }, [tasks, draftTask.date, draftTask.durationMinutes, draftTask.id, workStartMinutes, workEndMinutes])

  const draftLabels = draftTask.labels ?? []

  const handleToggleLabel = (name) => {
    updateDraft({ labels: draftLabels.includes(name) ? draftLabels.filter((l) => l !== name) : [...draftLabels, name] })
  }

  const handleAddLabel = () => {
    requirePremium(() => {
      const name = addLabel(newLabelInput)
      if (!name) return
      updateDraft({ labels: draftLabels.includes(name) ? draftLabels : [...draftLabels, name] })
      setNewLabelInput('')
    })
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

  const handleSelectDuration = (value) => {
    if (value !== 0 && !isPremium) {
      navigate('/upgrade')
      return
    }
    updateDraft({ durationMinutes: value })
  }

  const handleRecordVoiceNote = () => requirePremium(() => recorder.start())

  const handleStopVoiceNote = async () => {
    const dataUrl = await recorder.stop()
    if (dataUrl) updateDraft({ voiceNote: dataUrl })
  }

  const handleRemoveVoiceNote = () => updateDraft({ voiceNote: null })

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
    ? 'Change whatever you need, then save.'
    : draftTask.source === 'voice'
      ? 'Here’s what we heard. Tap anything that looks off.'
      : 'Add the details and save.'

  return (
    <div className="screen">
      <header className="page-header">
        <button type="button" className="icon-button" onClick={handleDiscard} aria-label="Discard and go back">
          <BackIcon />
        </button>
        <h1 className="page-header__title">{isEditing ? 'Edit task' : 'Confirm task'}</h1>
        <span className="icon-button icon-button--spacer" />
      </header>

      <main className="screen__content">
        <p className="confirm-hint">{hint}</p>

        <div className="card confirm-card">
          <label className="field">
            <span className="field__label">Task</span>
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

          {suggestedTime && suggestedTime !== draftTask.time && (
            <button
              type="button"
              className="suggestion-chip"
              onClick={() => updateDraft({ time: suggestedTime })}
            >
              <SparkIcon width={13} height={13} /> Suggested: {formatTimeLabel(suggestedTime)} — next free slot
            </button>
          )}

          <div className="field">
            <span className="field__label">Category</span>
            <div className="chip-row">
              {categories.map((category) => (
                <CategoryChip
                  key={category}
                  category={category}
                  color={colorForCategory(category)}
                  selected={draftTask.category === category}
                  onClick={() => updateDraft({ category })}
                />
              ))}
              <button type="button" className="chip chip--button chip--add" onClick={handleAddCategory}>
                {isPremium ? <PlusIcon width={14} height={14} /> : <LockIcon width={14} height={14} />} New
              </button>
            </div>
          </div>

          <label className="field">
            <span className="field__label">Section</span>
            <input
              type="text"
              className="field__input"
              list="section-suggestions"
              placeholder="e.g. Doing, Blocked — leave blank for none"
              value={draftTask.section ?? ''}
              onChange={(e) => updateDraft({ section: e.target.value })}
            />
            <datalist id="section-suggestions">
              {sectionSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>

          <div className="field">
            <span className="field__label">Labels</span>
            <div className="chip-row">
              {labels.map((label) => (
                <LabelChip
                  key={label.name}
                  name={label.name}
                  color={label.color}
                  selected={draftLabels.includes(label.name)}
                  onClick={() => handleToggleLabel(label.name)}
                />
              ))}
            </div>
            <div className="label-add-row">
              <input
                type="text"
                className="field__input"
                placeholder={isPremium ? 'New label' : 'Upgrade to create labels'}
                value={newLabelInput}
                readOnly={!isPremium}
                onClick={() => !isPremium && navigate('/upgrade')}
                onChange={(e) => setNewLabelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddLabel()
                  }
                }}
              />
              <button type="button" className="button button--light button--compact" onClick={handleAddLabel}>
                {isPremium ? <PlusIcon width={14} height={14} /> : <LockIcon width={14} height={14} />}
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
            <PremiumLabel isPremium={isPremium}>Duration</PremiumLabel>
            <div className="chip-row">
              {DURATION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`priority-chip${(draftTask.durationMinutes ?? 0) === option.value ? ' priority-chip--selected' : ''}${option.value !== 0 && !isPremium ? ' priority-chip--locked' : ''}`}
                  onClick={() => handleSelectDuration(option.value)}
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
            <PremiumLabel isPremium={isPremium}>Voice note</PremiumLabel>
            {draftTask.voiceNote ? (
              <div className="voice-note-row">
                <audio controls src={draftTask.voiceNote} className="voice-note-player" />
                <button
                  type="button"
                  className="icon-button"
                  onClick={handleRemoveVoiceNote}
                  aria-label="Remove voice note"
                >
                  <TrashIcon />
                </button>
              </div>
            ) : recorder.isRecording ? (
              <button
                type="button"
                className="button button--danger button--compact"
                onClick={handleStopVoiceNote}
              >
                <StopIcon width={14} height={14} /> Stop · {recorder.seconds}s
              </button>
            ) : (
              <button
                type="button"
                className="button button--light button--compact"
                onClick={handleRecordVoiceNote}
                disabled={!recorder.isSupported}
              >
                <MicIcon width={14} height={14} />{' '}
                {recorder.isSupported ? 'Record a voice note' : 'Mic not supported on this device'}
              </button>
            )}
            {recorder.error && <p className="settings-row__note">Couldn’t access the mic — check permissions.</p>}
          </div>

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
            {isEditing ? 'Save changes' : 'Save task'}
          </button>
          <button type="button" className="button button--ghost button--wide" onClick={handleSaveTemplate}>
            {templateSaved ? 'Saved as template' : 'Save as template'}
          </button>
          <button type="button" className="button button--ghost button--wide" onClick={handleDiscard}>
            {isEditing ? 'Cancel' : 'Discard'}
          </button>
        </div>
      </main>
    </div>
  )
}
