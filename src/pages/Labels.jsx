import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLabelsContext } from '../hooks/LabelsContext'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import LockedOverlay from '../components/LockedOverlay'
import LabelChip from '../components/LabelChip'
import { BackIcon, PencilIcon, TagIcon, TrashIcon } from '../components/icons'

// Every label a user creates lives forever until this screen exists — the
// registry already supported deleting one (useLabels.removeLabel), but
// nothing in the app ever called it, and there was no way to fix a typo
// short of deleting the label and recreating it under every task by hand.
export default function Labels() {
  const navigate = useNavigate()
  const { labels, removeLabel, renameLabel } = useLabelsContext()
  const { tasks, renameLabelEverywhere, removeLabelEverywhere } = useTasksContext()
  const { isPremium } = usePremiumContext()
  const [editingName, setEditingName] = useState(null)
  const [draftName, setDraftName] = useState('')

  const usageCount = (name) => tasks.filter((t) => (t.labels ?? []).includes(name)).length

  const startEdit = (name) => {
    setEditingName(name)
    setDraftName(name)
  }

  const commitEdit = () => {
    const trimmed = draftName.trim()
    if (!trimmed || trimmed === editingName) {
      setEditingName(null)
      return
    }
    const finalName = renameLabel(editingName, trimmed)
    renameLabelEverywhere(editingName, finalName)
    setEditingName(null)
  }

  const handleDelete = (name) => {
    const count = usageCount(name)
    if (count > 0 && !window.confirm(`Remove "${name}" from ${count} task${count === 1 ? '' : 's'}?`)) return
    removeLabel(name)
    removeLabelEverywhere(name)
  }

  return (
    <div className="screen">
      <header className="page-header">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Go back">
          <BackIcon />
        </button>
        <h1 className="page-header__title">Manage labels</h1>
        <span className="icon-button icon-button--spacer" />
      </header>

      <main className="screen__content">
        <p className="confirm-hint">Rename a label to fix a typo everywhere it's used, or delete one you don't need.</p>

        <LockedOverlay
          locked={!isPremium}
          title={labels.length > 0 ? `You have ${labels.length} label${labels.length === 1 ? '' : 's'}` : 'Labels are Premium'}
          subtitle="Unlock Premium to create and manage your own labels."
        >
          {labels.length === 0 ? (
            <div className="empty-state">
              <TagIcon width={28} height={28} className="empty-state__icon" />
              <p>No labels yet.</p>
              <p className="empty-state__hint">Add one to a task from the Confirm screen — it'll show up here.</p>
            </div>
          ) : (
            <div className="task-list">
              {labels.map((label) => (
                <div key={label.name} className="card template-card">
                  {editingName === label.name ? (
                    <input
                      type="text"
                      className="field__input"
                      value={draftName}
                      autoFocus
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                      onBlur={commitEdit}
                    />
                  ) : (
                    <div>
                      <LabelChip name={label.name} color={label.color} />
                      <p className="template-card__meta">
                        {usageCount(label.name)} task{usageCount(label.name) === 1 ? '' : 's'}
                      </p>
                    </div>
                  )}
                  <div className="template-card__actions">
                    {editingName !== label.name && (
                      <button
                        type="button"
                        className="template-card__remove"
                        onClick={() => startEdit(label.name)}
                        aria-label={`Rename label ${label.name}`}
                      >
                        <PencilIcon />
                      </button>
                    )}
                    <button
                      type="button"
                      className="template-card__remove"
                      onClick={() => handleDelete(label.name)}
                      aria-label={`Delete label ${label.name}`}
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
