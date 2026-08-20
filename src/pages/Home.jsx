import { useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import TaskItem from '../components/TaskItem'
import BottomTabBar from '../components/BottomTabBar'
import { MicIcon, PlusIcon } from '../components/icons'
import { todayISO } from '../utils/dateUtils'
import { remainingFreeTasks } from '../utils/plan'

export default function Home() {
  const navigate = useNavigate()
  const { tasks, toggleDone, setDraftTask } = useTasksContext()
  const { isPremium } = usePremiumContext()

  const today = todayISO()
  const todayTasks = tasks
    .filter((t) => t.date === today)
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))

  const remaining = isPremium ? Infinity : remainingFreeTasks(tasks)

  const handleMicTap = () => {
    if (isPremium) {
      navigate('/record')
    } else {
      navigate('/upgrade')
    }
  }

  const handleManualAdd = () => {
    if (remaining <= 0) {
      navigate('/upgrade')
      return
    }
    setDraftTask({ title: '', date: today, time: '', category: 'Personal', source: 'manual' })
    navigate('/confirm')
  }

  return (
    <div className="screen">
      <header className="page-header">
        <h1 className="page-header__title">Aura Task</h1>
        <div className="page-header__actions">
          <button
            type="button"
            className="icon-button"
            onClick={handleManualAdd}
            aria-label="Add a task manually"
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            className="icon-button icon-button--accent"
            onClick={handleMicTap}
            aria-label={isPremium ? 'Record a task with your voice' : 'Voice tasks are a Premium feature'}
          >
            <MicIcon />
          </button>
        </div>
      </header>

      <main className="screen__content">
        {!isPremium && (
          <p className="plan-hint">
            {remaining > 0
              ? `${remaining} free task${remaining === 1 ? '' : 's'} left today`
              : "You've used today's free tasks — upgrade for unlimited."}
          </p>
        )}

        <section>
          <h2 className="section-title">Today</h2>

          {todayTasks.length === 0 ? (
            <div className="empty-state">
              <p>No tasks for today yet.</p>
              <p className="empty-state__hint">
                {isPremium ? 'Tap the mic to add one with your voice.' : 'Tap + to add one.'}
              </p>
            </div>
          ) : (
            <div className="task-list">
              {todayTasks.map((task) => (
                <TaskItem key={task.id} task={task} onToggle={toggleDone} />
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomTabBar />
    </div>
  )
}
