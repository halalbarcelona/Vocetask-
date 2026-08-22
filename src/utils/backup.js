export function exportTasksJSON(tasks, filename = 'aura-task-backup.json') {
  const payload = { exportedAt: new Date().toISOString(), tasks }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Reads a backup file and returns its tasks array, or throws if the file
// isn't a recognizable Aura Task backup.
export function parseBackupFile(file) {
  return file.text().then((text) => {
    const parsed = JSON.parse(text)
    const tasks = Array.isArray(parsed) ? parsed : parsed?.tasks
    if (!Array.isArray(tasks)) throw new Error('Not a valid Aura Task backup file')
    return tasks
  })
}
