import { useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import { useUILangContext } from '../hooks/UILangContext'
import LockedOverlay from '../components/LockedOverlay'
import { BackIcon, FlameIcon, RepeatIcon } from '../components/icons'
import { habitStreak, habitCompletionRate } from '../utils/stats'

// Stats.jsx's streak is "was anything at all done today" across the whole
// list — useful as a headline number, but it can't tell you which specific
// habit is slipping. This is that: every recurring task, its own streak.
export default function Habits() {
  const navigate = useNavigate()
  const { tasks } = useTasksContext()
  const { isPremium } = usePremiumContext()
  const { t } = useUILangContext()

  const RECURRENCE_LABELS = {
    daily: t('recurrenceDaily'),
    weekly: t('recurrenceWeekly'),
    monthly: t('recurrenceMonthly'),
    custom: t('recurrenceCustom'),
  }

  const habits = tasks
    .filter((t) => t.recurrence && t.recurrence !== 'none')
    .map((t) => ({
      task: t,
      streak: habitStreak(t),
      rate: habitCompletionRate(t, 7),
    }))
    .sort((a, b) => b.streak - a.streak)

  return (
    <div className="screen">
      <header className="page-header">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Go back">
          <BackIcon />
        </button>
        <h1 className="page-header__title">{t('habitsTitle')}</h1>
        <span className="icon-button icon-button--spacer" />
      </header>

      <main className="screen__content">
        <LockedOverlay
          locked={!isPremium}
          title={t('trackEveryHabit')}
          subtitle={t('unlockHabitsSubtitle')}
        >
          {habits.length === 0 ? (
            <div className="empty-state">
              <p>{t('noHabitsYet')}</p>
              <p className="empty-state__hint">{t('makeTaskRepeatHint')}</p>
            </div>
          ) : (
            <div className="task-list">
              {habits.map(({ task, streak, rate }) => (
                <div key={task.id} className="card habit-card">
                  <div className="habit-card__row">
                    <p className="habit-card__title">
                      <RepeatIcon width={14} height={14} /> {task.title || t('untitledTask')}
                    </p>
                    <span className="habit-card__recurrence">{RECURRENCE_LABELS[task.recurrence] ?? task.recurrence}</span>
                  </div>
                  <div className="habit-card__stats">
                    <span className="habit-card__stat">
                      <FlameIcon width={13} height={13} /> {t('dayStreak', streak)}
                    </span>
                    <span className="habit-card__stat">{t('last7Days', rate)}</span>
                  </div>
                  <div className="progress__track">
                    <div className="progress__fill" style={{ width: `${rate}%` }} />
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
