import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { todayISO } from '../utils/dateUtils'

// Reached from a push notification's "Mark done" / "Snooze 10m" action
// buttons (Premium — see supabase/functions/send-reminders and src/sw.js).
// The service worker has no authenticated Supabase session of its own, so
// it can't perform the mutation itself — it opens/focuses the app instead,
// which does, and this page is where that mutation actually happens.
export default function QuickAction() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { tasks, toggleDone, updateTask } = useTasksContext()
  // toggleDone/updateTask both mutate `tasks`, which would re-run an effect
  // keyed on it before the navigate below unmounts this page — a ref (not
  // state) makes "already handled" durable across that re-render without
  // itself triggering another one.
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    const taskId = params.get('task')
    const action = params.get('action')
    const task = tasks.find((t) => t.id === taskId)

    if (task && action === 'done') {
      handledRef.current = true
      toggleDone(task.id)
    } else if (task && action === 'snooze') {
      handledRef.current = true
      const snoozed = new Date(Date.now() + 10 * 60 * 1000)
      const hh = String(snoozed.getHours()).padStart(2, '0')
      const mm = String(snoozed.getMinutes()).padStart(2, '0')
      updateTask(task.id, { date: todayISO(), time: `${hh}:${mm}` })
    }

    navigate('/', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks])

  return null
}
