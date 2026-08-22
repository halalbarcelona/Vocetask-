const STORAGE_KEY = 'aura-milestones-seen'

function loadSeen() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function markSeen(id) {
  const seen = loadSeen()
  seen.add(id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]))
}

function completedCount(tasks) {
  return tasks.reduce(
    (n, t) => n + (t.recurrence && t.recurrence !== 'none' ? (t.completedDates?.length ?? 0) : t.done ? 1 : 0),
    0,
  )
}

// Returns a celebration to show once, when the user has just done something
// worth being proud of — the moment they feel best about the app, which is
// a far better time to mention Premium than when they hit a wall.
export function checkMilestone(tasks, streak) {
  const seen = loadSeen()

  if (streak >= 7 && !seen.has('streak-7')) {
    markSeen('streak-7')
    return { id: 'streak-7', message: `🔥 ${streak}-day streak! You're on a roll.` }
  }

  const done = completedCount(tasks)
  if (done >= 50 && !seen.has('done-50')) {
    markSeen('done-50')
    return { id: 'done-50', message: `🎉 ${done} tasks completed with Aura.` }
  }
  if (done >= 10 && !seen.has('done-10')) {
    markSeen('done-10')
    return { id: 'done-10', message: '✅ 10 tasks done. Nice work.' }
  }

  return null
}
