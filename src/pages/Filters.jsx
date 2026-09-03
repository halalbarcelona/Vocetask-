import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import { useCategoriesContext } from '../hooks/CategoriesContext'
import { useLabelsContext } from '../hooks/LabelsContext'
import { useFiltersContext } from '../hooks/FiltersContext'
import { useUILangContext } from '../hooks/UILangContext'
import LockedOverlay from '../components/LockedOverlay'
import CategoryChip from '../components/CategoryChip'
import LabelChip from '../components/LabelChip'
import { BackIcon, FilterIcon, PlusIcon, TrashIcon } from '../components/icons'
import { emptyCriteria, matchesFilter } from '../utils/filters'
import { todayISO } from '../utils/dateUtils'

function toggleIn(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function FilterBuilder({ initial, onCancel, onSave }) {
  const { categories, colorForCategory } = useCategoriesContext()
  const { labels } = useLabelsContext()
  const { tasks } = useTasksContext()
  const { t } = useUILangContext()
  const [name, setName] = useState(initial?.name ?? '')
  const [criteria, setCriteria] = useState(initial?.criteria ?? emptyCriteria())

  const PRIORITY_OPTIONS = [
    { value: 'high', label: t('priorityHigh') },
    { value: 'medium', label: t('priorityMedium') },
    { value: 'low', label: t('priorityLow') },
    { value: 'none', label: t('priorityNone') },
  ]

  const DUE_OPTIONS = [
    { value: 'any', label: t('dueAnyDate') },
    { value: 'today', label: t('dueToday') },
    { value: 'overdue', label: t('dueOverdue') },
    { value: 'upcoming', label: t('dueUpcoming') },
  ]

  const DONE_OPTIONS = [
    { value: 'any', label: t('statusAny') },
    { value: 'pending', label: t('statusPending') },
    { value: 'done', label: t('statusDone') },
  ]

  const today = todayISO()
  const previewCount = tasks.filter((t) => matchesFilter(t, criteria, today)).length

  return (
    <div className="card confirm-card">
      <label className="field">
        <span className="field__label">{t('filterNameLabel')}</span>
        <input
          type="text"
          className="field__input"
          placeholder={t('filterNamePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="field">
        <span className="field__label">{t('listsLabel')}</span>
        <div className="chip-row">
          {categories.map((category) => (
            <CategoryChip
              key={category}
              category={category}
              color={colorForCategory(category)}
              selected={criteria.categories.includes(category)}
              onClick={() => setCriteria((c) => ({ ...c, categories: toggleIn(c.categories, category) }))}
            />
          ))}
        </div>
      </div>

      {labels.length > 0 && (
        <div className="field">
          <span className="field__label">{t('labelsFieldLabel')}</span>
          <div className="chip-row">
            {labels.map((label) => (
              <LabelChip
                key={label.name}
                name={label.name}
                color={label.color}
                selected={criteria.labels.includes(label.name)}
                onClick={() => setCriteria((c) => ({ ...c, labels: toggleIn(c.labels, label.name) }))}
              />
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <span className="field__label">{t('priorityLabel')}</span>
        <div className="chip-row">
          {PRIORITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`priority-chip priority-chip--${option.value}${criteria.priority.includes(option.value) ? ' priority-chip--selected' : ''}`}
              onClick={() => setCriteria((c) => ({ ...c, priority: toggleIn(c.priority, option.value) }))}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field__label">{t('dueLabel')}</span>
        <div className="chip-row">
          {DUE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`filter-chip${criteria.due === option.value ? ' filter-chip--active' : ''}`}
              onClick={() => setCriteria((c) => ({ ...c, due: option.value }))}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field__label">{t('statusLabel')}</span>
        <div className="chip-row">
          {DONE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`filter-chip${criteria.done === option.value ? ' filter-chip--active' : ''}`}
              onClick={() => setCriteria((c) => ({ ...c, done: option.value }))}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <p className="record-hint">{t('tasksMatchNow', previewCount)}</p>

      <div className="confirm-actions">
        <button
          type="button"
          className="button button--primary button--wide"
          disabled={!name.trim()}
          onClick={() => onSave(name.trim(), criteria)}
        >
          {t('saveFilter')}
        </button>
        <button type="button" className="button button--ghost button--wide" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    </div>
  )
}

export default function Filters() {
  const navigate = useNavigate()
  const { isPremium } = usePremiumContext()
  const { t } = useUILangContext()
  const { filters, saveFilter, removeFilter } = useFiltersContext()
  const [editingId, setEditingId] = useState(null)
  const [isCreating, setIsCreating] = useState(false)

  const editingFilter = filters.find((f) => f.id === editingId)

  const handleSave = (name, criteria) => {
    saveFilter(name, criteria, editingId ?? undefined)
    setIsCreating(false)
    setEditingId(null)
  }

  return (
    <div className="screen">
      <header className="page-header">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Go back">
          <BackIcon />
        </button>
        <h1 className="page-header__title">{t('filters')}</h1>
        <span className="icon-button icon-button--spacer" />
      </header>

      <main className="screen__content">
        <p className="confirm-hint">{t('filtersHint')}</p>

        <LockedOverlay
          locked={!isPremium}
          title={filters.length > 0 ? t('youSavedFilters', filters.length) : t('filtersArePremium')}
          subtitle={t('unlockFiltersSubtitle')}
        >
          {isCreating || editingFilter ? (
            <FilterBuilder
              initial={editingFilter}
              onCancel={() => {
                setIsCreating(false)
                setEditingId(null)
              }}
              onSave={handleSave}
            />
          ) : (
            <>
              {filters.length === 0 ? (
                <div className="empty-state">
                  <FilterIcon width={28} height={28} className="empty-state__icon" />
                  <p>{t('noFiltersYet')}</p>
                  <p className="empty-state__hint">{t('buildFilterHint')}</p>
                </div>
              ) : (
                <div className="task-list">
                  {filters.map((filter) => (
                    <div key={filter.id} className="card template-card">
                      <button
                        type="button"
                        className="template-card__name-button"
                        onClick={() => setEditingId(filter.id)}
                      >
                        <FilterIcon width={16} height={16} />
                        <span className="template-card__name">{filter.name}</span>
                      </button>
                      <button
                        type="button"
                        className="template-card__remove"
                        onClick={() => removeFilter(filter.id)}
                        aria-label={`Delete filter ${filter.name}`}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="button button--light button--wide"
                onClick={() => setIsCreating(true)}
              >
                <PlusIcon width={14} height={14} /> {t('newFilter')}
              </button>
            </>
          )}
        </LockedOverlay>
      </main>
    </div>
  )
}
