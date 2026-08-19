import { useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import TaskItem from '../components/TaskItem'
import BottomTabBar from '../components/BottomTabBar'
import { MicIcon } from '../components/icons'
import { todayISO } from '../utils/dateUtils'

export default function Home() {
  const navigate = useNavigate()
  const { tasks, toggleDone } = useTasksContext()

  const today = todayISO()
  const todayTasks = tasks
    .filter((t) => t.date === today)
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))

  return (
    <div className="screen">
      <header className="page-header">
        <h1 className="page-header__title">Aura Task</h1>
        <button
          type="button"
          className="icon-button icon-button--accent"
          onClick={() => navigate('/record')}
          aria-label="Record a task with your voice"
        >
          <MicIcon />
        </button>
      </header>

      <main className="screen__content">
        <section>
          <h2 className="section-title">Today</h2>

          {todayTasks.length === 0 ? (
            <div className="empty-state">
              <p>No tasks for today yet.</p>
              <p className="empty-state__hint">Tap the mic to add one with your voice.</p>
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
