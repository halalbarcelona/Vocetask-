import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import { useToast } from '../hooks/useToast'
import TaskItem from '../components/TaskItem'
import Toast from '../components/Toast'
import BottomTabBar from '../components/BottomTabBar'
import {
  CheckIcon,
  FlameIcon,
  MicIcon,
  PlusIcon,
  SearchIcon,
  SparkIcon,
  SpeakerIcon,
  TrashIcon,
} from '../components/icons'
import { formatDateLabel, formatTimeLabel, todayISO } from '../utils/dateUtils'
import { isDueOn, isOverdue } from '../utils/recurrence'
import { computeStreak } from '../utils/stats'
import { speakDailyRecap } from '../utils/speak'
import { checkMilestone } from '../utils/milestones'
import { fixSpeech } from '../utils/speechFix'
import { useVoiceLang } from '../hooks/useVoiceLang'
import { useUILangContext } from '../hooks/UILangContext'
import { useLabelsContext } from '../hooks/LabelsContext'
import { useFiltersContext } from '../hooks/FiltersContext'
import { useCategoriesContext } from '../hooks/CategoriesContext'
import LabelChip from '../components/LabelChip'
import { FilterIcon } from '../components/icons'
import { matchesFilter } from '../utils/filters'
import { parseQuickAddSyntax } from '../utils/quickAddSyntax'
import { parseVoiceCommand } from '../utils/voiceParser'
import OnboardingTour, { shouldShowOnboarding } from '../components/OnboardingTour'

const PRIORITY_RANK = { high: 3, medium: 2, low: 1, none: 0 }

// Shown in the first-run empty state so the Hinglish parsing — the thing that
// makes this app different — gets discovered instead of sitting undiscovered.
// Written in the script the user's own voice model returns.
const VOICE_EXAMPLES = {
  'hi-IN': ['कल सुबह 9 बजे मम्मी को कॉल', 'आज शाम 6 बजे जिम', 'हर रोज़ सुबह 7 बजे उठना'],
  'en-IN': ['kal subah 9 baje call mummy', 'aaj shaam 6 baje gym', 'Team meeting tomorrow at 3pm'],
  'en-US': ['Call mum tomorrow at 9am', 'Gym today at 6pm', 'Team meeting every Monday'],
}

const SpeechRecognitionAPI =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined

export default function Home() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    tasks,
    addTask,
    toggleDone,
    setDraftTask,
    removeTask,
    restoreTask,
    reorderTask,
    toggleSubtask,
    updateTask,
    bulkRemoveTasks,
    bulkMarkDone,
  } = useTasksContext()
  const { isPremium, isPaid, trialActive, trialExpired, trialDaysLeft } = usePremiumContext()
  const { lang: voiceLang } = useVoiceLang()
  const { t } = useUILangContext()
  const { labels, colorFor } = useLabelsContext()
  const { filters } = useFiltersContext()
  const { categories } = useCategoriesContext()
  const { toast, showToast, dismissToast } = useToast()
  const [query, setQuery] = useState('')
  const [sortByPriority, setSortByPriority] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [listening, setListening] = useState(false)
  const [quickAdd, setQuickAdd] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [labelFilter, setLabelFilter] = useState(null)
  const [activeFilterId, setActiveFilterId] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboarding)
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (location.state?.toast) {
      showToast(location.state.toast, {
        actionLabel: location.state.undoTask ? t('undo') : undefined,
        onAction: location.state.undoTask ? () => restoreTask(location.state.undoTask) : undefined,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Send them to the recap once, the first time they open the app after the
  // trial lapses. The flag keeps it from reappearing on every visit.
  useEffect(() => {
    if (trialExpired && !isPaid && !localStorage.getItem('aura-trial-recap-seen')) {
      localStorage.setItem('aura-trial-recap-seen', 'true')
      navigate('/trial-ended')
    }
  }, [trialExpired, isPaid, navigate])

  // Celebrate real progress, and only then mention Premium — people buy
  // when they feel good about the app, not when it blocks them.
  useEffect(() => {
    const milestone = checkMilestone(tasks, computeStreak(tasks))
    if (!milestone) return
    showToast(milestone.message, {
      actionLabel: isPaid ? undefined : t('seePremium'),
      onAction: isPaid ? undefined : () => navigate('/upgrade'),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks])

  const today = todayISO()
  const isSearching = query.trim().length > 0

  const matchesCategory = (t) =>
    (categoryFilter === 'All' || t.category === categoryFilter) &&
    (!labelFilter || (t.labels ?? []).includes(labelFilter))

  const activeFilter = filters.find((f) => f.id === activeFilterId)
  const isFiltering = Boolean(activeFilter) && !isSearching
  const filterResults = activeFilter
    ? tasks
        .filter((t) => matchesFilter(t, activeFilter.criteria, today))
        .sort((a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')))
    : []

  let todayTasks = tasks
    .filter((t) => isDueOn(t, today) && matchesCategory(t))
    .sort((a, b) => a.order - b.order)
  if (isPremium && sortByPriority) {
    todayTasks = [...todayTasks].sort(
      (a, b) => (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0),
    )
  }

  // Split today's list so finished work collapses to the bottom and the
  // active list stays short.
  const isTaskDone = (t) =>
    t.recurrence && t.recurrence !== 'none' ? (t.completedDates ?? []).includes(today) : t.done
  const activeToday = todayTasks.filter((t) => !isTaskDone(t))
  const doneToday = todayTasks.filter(isTaskDone)

  const overdueTasks = tasks
    .filter((t) => isOverdue(t, today) && matchesCategory(t))
    .sort((a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')))

  const searchResults = isSearching
    ? tasks
        .filter((t) => t.title.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')))
    : []

  const todayTaskIds = todayTasks.map((t) => t.id)
  const streak = computeStreak(tasks)

  // Categories in use across everything the list can show — today's tasks and
  // overdue ones. Built from today alone, an overdue task in some other
  // category had no chip to reach it and stayed hidden behind any filter.
  const usedCategories = [
    ...new Set(
      tasks.filter((t) => isDueOn(t, today) || isOverdue(t, today)).map((t) => t.category),
    ),
  ]

  // Labels in the same pool, but only once a single list is being viewed —
  // combining "all labels across every list" with "one list" reads as noise,
  // and Todoist scopes its own label filters the same way.
  const usedLabels =
    categoryFilter === 'All'
      ? []
      : [
          ...new Set(
            tasks
              .filter((t) => t.category === categoryFilter && (isDueOn(t, today) || isOverdue(t, today)))
              .flatMap((t) => t.labels ?? []),
          ),
        ]

  // Sections only mean something once you're looking at one list — grouping
  // "Work" and "Personal" tasks under a shared "Doing" header would conflate
  // two different boards. Tasks without a section collect under one group so
  // sectioned and unsectioned work can sit in the same list.
  const sectionGroups =
    categoryFilter !== 'All' && activeToday.some((t) => t.section)
      ? Object.entries(
          activeToday.reduce((acc, t) => {
            const key = t.section || ''
            acc[key] = acc[key] ?? []
            acc[key].push(t)
            return acc
          }, {}),
        ).sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
      : null

  const handleMicTap = () => {
    navigate('/record')
  }

  const handleManualAdd = () => {
    setDraftTask({ title: '', date: today, time: '', category: 'Personal', source: 'manual' })
    navigate('/confirm')
  }

  const handleDelete = (task) => {
    removeTask(task.id)
    showToast(t('deletedTask', task.title || t('untitledTask')), {
      actionLabel: t('undo'),
      onAction: () => restoreTask(task),
    })
  }

  const handleSnooze = (id, newDate) => updateTask(id, { date: newDate })

  // Typed entries get the same Hinglish date/time/recurrence/priority parsing
  // voice input already gets, plus Todoist-style #list @label !priority
  // shorthand — stripped from the text before the NLP parser ever sees it, so
  // "call mummy #Work !high kal 9pm" ends up with none of those tokens left
  // sitting in the title. A task that lands anywhere but today's list would
  // otherwise just vanish from view with no explanation, so say where it went.
  const handleQuickAdd = () => {
    const raw = quickAdd.trim()
    if (!raw) return
    const syntax = parseQuickAddSyntax(raw, { categories, labels: labels.map((l) => l.name) })
    const parsed = parseVoiceCommand(syntax.title || raw)
    addTask({
      title: parsed.title || syntax.title || raw,
      date: parsed.date,
      time: parsed.time,
      category: syntax.category ?? parsed.category,
      recurrence: parsed.recurrence,
      recurrenceDays: parsed.recurrenceDays,
      priority: syntax.priority ?? (parsed.priority !== 'none' ? parsed.priority : 'none'),
      labels: syntax.labels,
    })
    setQuickAdd('')
    if (parsed.date !== today) {
      const when = parsed.time ? `${formatDateLabel(parsed.date)}, ${formatTimeLabel(parsed.time)}` : formatDateLabel(parsed.date)
      showToast(t('addedFor', when))
    }
  }

  // Reopens an existing task in the Confirm screen. The id riding along in
  // the draft is what makes Confirm save an update instead of a new task.
  const handleEdit = (task) => {
    setDraftTask({ ...task })
    navigate('/confirm')
  }

  const handleExampleTap = (example) => {
    navigate('/record', { state: { prefill: example } })
  }

  const handleSpeakRecap = () => speakDailyRecap(todayTasks)

  const handleTogglePrioritySort = () => {
    if (!isPremium) {
      navigate('/upgrade')
      return
    }
    setSortByPriority((v) => !v)
  }

  const handleToggleSelectMode = () => {
    if (!isPremium) {
      navigate('/upgrade')
      return
    }
    setSelectMode((v) => !v)
    setSelectedIds([])
  }

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const handleBulkComplete = () => {
    bulkMarkDone(selectedIds)
    setSelectedIds([])
    setSelectMode(false)
  }

  const handleBulkDelete = () => {
    bulkRemoveTasks(selectedIds)
    setSelectedIds([])
    setSelectMode(false)
    showToast(t('deletedCount', selectedIds.length))
  }

  const handleVoiceSearch = () => {
    if (!isPremium || !SpeechRecognitionAPI) {
      if (!isPremium) navigate('/upgrade')
      return
    }
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const recognition = new SpeechRecognitionAPI()
    recognition.lang = voiceLang
    recognition.interimResults = false
    recognition.onresult = (event) => {
      // Search matches against saved titles, so the repaired transcript is what
      // we want here too — "9 budget gym" should find "Gym".
      setQuery(fixSpeech(event.results[0]?.[0]?.transcript ?? ''))
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  return (
    <div className="screen">
      {showOnboarding && <OnboardingTour onDone={() => setShowOnboarding(false)} />}

      <header className="page-header">
        <h1 className="page-header__title">Aura Task</h1>
        <div className="page-header__actions">
          <button
            type="button"
            className={`icon-button${selectMode ? ' icon-button--accent' : ''}`}
            onClick={handleToggleSelectMode}
            aria-label={t('selectMultiple')}
          >
            <CheckIcon width={18} height={18} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={handleSpeakRecap}
            aria-label={t('readAloud')}
          >
            <SpeakerIcon />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={handleManualAdd}
            aria-label={t('addManually')}
          >
            <PlusIcon />
          </button>
        </div>
      </header>

      <main className="screen__content">
        {trialActive && !isPaid && (
          <button
            type="button"
            className={`trial-banner${trialDaysLeft <= 2 ? ' trial-banner--urgent' : ''}`}
            onClick={() => navigate('/upgrade')}
          >
            <span>
              <SparkIcon width={14} height={14} /> {t('premiumTrial', trialDaysLeft)}
            </span>
            <span className="trial-banner__cta">{t('keepIt')}</span>
          </button>
        )}

        {streak > 0 && (
          <p className="streak-banner">
            <FlameIcon width={14} height={14} />
            {t('dayStreak', streak)}
          </p>
        )}

        <div className="search-bar">
          <SearchIcon />
          <input
            type="text"
            placeholder={t('searchTasks')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className={`search-bar__mic${listening ? ' search-bar__mic--active' : ''}`}
            onClick={handleVoiceSearch}
            aria-label={t('searchByVoice')}
          >
            <MicIcon width={16} height={16} />
          </button>
        </div>

        {isSearching ? (
          <section>
            <h2 className="section-title">{t('searchResults')}</h2>
            {searchResults.length === 0 ? (
              <div className="empty-state">
                <p>{t('noMatchingTasks')}</p>
              </div>
            ) : (
              <div className="task-list">
                {searchResults.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={toggleDone}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    onToggleSubtask={toggleSubtask}
                    onSnooze={handleSnooze}
                    isPremium={isPremium}
                    selectMode={selectMode}
                    selected={selectedIds.includes(task.id)}
                    onToggleSelect={handleToggleSelect}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            {!selectMode && (
              <div className="quick-add">
                <PlusIcon width={16} height={16} />
                <input
                  type="text"
                  placeholder={t('quickAddPlaceholder')}
                  value={quickAdd}
                  onChange={(e) => setQuickAdd(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleQuickAdd()
                    }
                  }}
                />
                {quickAdd.trim() && (
                  <button type="button" className="button button--primary button--compact" onClick={handleQuickAdd}>
                    {t('add')}
                  </button>
                )}
              </div>
            )}

            {filters.length > 0 && (
              <div className="filter-row">
                {filters.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`filter-chip filter-chip--saved${activeFilterId === f.id ? ' filter-chip--active' : ''}`}
                    onClick={() => setActiveFilterId((prev) => (prev === f.id ? null : f.id))}
                  >
                    <FilterIcon width={13} height={13} /> {f.name}
                  </button>
                ))}
              </div>
            )}

            {usedCategories.length > 1 && (
              <div className="filter-row">
                {['All', ...usedCategories].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`filter-chip${categoryFilter === option ? ' filter-chip--active' : ''}`}
                    onClick={() => {
                      setCategoryFilter(option)
                      setLabelFilter(null)
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {usedLabels.length > 0 && (
              <div className="filter-row">
                {usedLabels.map((name) => (
                  <LabelChip
                    key={name}
                    name={name}
                    color={colorFor(name)}
                    selected={labelFilter === name}
                    onClick={() => setLabelFilter((prev) => (prev === name ? null : name))}
                  />
                ))}
              </div>
            )}

            {isFiltering ? (
              <section>
                <div className="section-title-row">
                  <h2 className="section-title">{t('filterLabel', activeFilter.name)}</h2>
                  <button type="button" className="sort-toggle" onClick={() => setActiveFilterId(null)}>
                    {t('clear')}
                  </button>
                </div>
                {filterResults.length === 0 ? (
                  <div className="empty-state">
                    <p>{t('noTasksMatchFilter')}</p>
                  </div>
                ) : (
                  <div className="task-list">
                    {filterResults.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggle={toggleDone}
                        onDelete={handleDelete}
                        onEdit={handleEdit}
                        onToggleSubtask={toggleSubtask}
                        onSnooze={handleSnooze}
                        isPremium={isPremium}
                        selectMode={selectMode}
                        selected={selectedIds.includes(task.id)}
                        onToggleSelect={handleToggleSelect}
                      />
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <>
            {overdueTasks.length > 0 && (
              <section>
                <h2 className="section-title section-title--danger">{t('overdue', overdueTasks.length)}</h2>
                <div className="task-list">
                  {overdueTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={toggleDone}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                      onToggleSubtask={toggleSubtask}
                      onSnooze={handleSnooze}
                      isPremium={isPremium}
                      selectMode={selectMode}
                      selected={selectedIds.includes(task.id)}
                      onToggleSelect={handleToggleSelect}
                    />
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="section-title-row">
                <h2 className="section-title">{t('today')}</h2>
                {todayTasks.length > 1 && (
                  <button
                    type="button"
                    className={`sort-toggle${sortByPriority ? ' sort-toggle--active' : ''}`}
                    onClick={handleTogglePrioritySort}
                  >
                    {t('sortByPriority')}
                  </button>
                )}
              </div>

              {todayTasks.length > 0 && (
                <div className="progress">
                  <div className="progress__track">
                    <div
                      className="progress__fill"
                      style={{ width: `${(doneToday.length / todayTasks.length) * 100}%` }}
                    />
                  </div>
                  <span className="progress__label">
                    {t('doneOfTotal', doneToday.length, todayTasks.length)}
                  </span>
                </div>
              )}

              {todayTasks.length === 0 ? (
                <div className="empty-state">
                  <p>{t('nothingForToday')}</p>
                  <p className="empty-state__hint">{t('tapMicHint')}</p>
                  <div className="example-list">
                    {(VOICE_EXAMPLES[voiceLang] ?? VOICE_EXAMPLES['en-IN']).map((example) => (
                      <button
                        key={example}
                        type="button"
                        className="example-chip"
                        onClick={() => handleExampleTap(example)}
                      >
                        <MicIcon width={13} height={13} /> “{example}”
                      </button>
                    ))}
                  </div>
                </div>
              ) : sectionGroups ? (
                sectionGroups.map(([section, sectionTasks]) => (
                  <div key={section || '__none__'} className="task-section">
                    <h3 className="task-section__title">{section || t('noSection')}</h3>
                    <div className="task-list">
                      {sectionTasks.map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          onToggle={toggleDone}
                          onDelete={handleDelete}
                          onEdit={handleEdit}
                          onToggleSubtask={toggleSubtask}
                          onSnooze={handleSnooze}
                          isPremium={isPremium}
                          onReorder={sortByPriority ? undefined : (id, dir) => reorderTask(id, dir, todayTaskIds)}
                          isFirst={todayTaskIds.indexOf(task.id) === 0}
                          isLast={todayTaskIds.indexOf(task.id) === todayTaskIds.length - 1}
                          selectMode={selectMode}
                          selected={selectedIds.includes(task.id)}
                          onToggleSelect={handleToggleSelect}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="task-list">
                  {activeToday.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={toggleDone}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                      onToggleSubtask={toggleSubtask}
                      onSnooze={handleSnooze}
                      isPremium={isPremium}
                      onReorder={sortByPriority ? undefined : (id, dir) => reorderTask(id, dir, todayTaskIds)}
                      isFirst={todayTaskIds.indexOf(task.id) === 0}
                      isLast={todayTaskIds.indexOf(task.id) === todayTaskIds.length - 1}
                      selectMode={selectMode}
                      selected={selectedIds.includes(task.id)}
                      onToggleSelect={handleToggleSelect}
                    />
                  ))}
                </div>
              )}
            </section>

            {doneToday.length > 0 && (
              <section>
                <h2 className="section-title">{t('doneCount', doneToday.length)}</h2>
                <div className="task-list">
                  {doneToday.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={toggleDone}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                      onToggleSubtask={toggleSubtask}
                      isPremium={isPremium}
                      selectMode={selectMode}
                      selected={selectedIds.includes(task.id)}
                      onToggleSelect={handleToggleSelect}
                    />
                  ))}
                </div>
              </section>
            )}
              </>
            )}
          </>
        )}
      </main>

      {selectMode && selectedIds.length > 0 && (
        <div className="bulk-action-bar">
          <span className="bulk-action-bar__count">{t('selectedCount', selectedIds.length)}</span>
          <div className="bulk-action-bar__actions">
            <button type="button" className="button button--primary button--compact" onClick={handleBulkComplete}>
              <CheckIcon width={14} height={14} /> {t('complete')}
            </button>
            <button type="button" className="button button--danger button--compact" onClick={handleBulkDelete}>
              <TrashIcon width={14} height={14} /> {t('delete')}
            </button>
          </div>
        </div>
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
      {!selectMode && (
        <button type="button" className="fab" onClick={handleMicTap} aria-label={t('addVoiceTask')}>
          <MicIcon width={26} height={26} />
        </button>
      )}

      <BottomTabBar />
    </div>
  )
}
