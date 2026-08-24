// Pure, framework-free sync logic — no Supabase client, no React, so it can
// be unit-tested directly without a live backend or a browser. useTasks.js
// is the only caller; it owns the actual network calls and local state.
//
// The model is "last-write-wins per task row," tracked against a snapshot of
// what was last known to be in sync (keyed by task id):
//   - A row changed only remotely since the snapshot -> remote wins locally.
//   - A row changed only locally since the snapshot -> local wins (pushed up).
//   - A row changed on both sides since the snapshot -> local wins. This is a
//     deliberate simplification, not an oversight: resolving that properly
//     needs field-level merge or a real CRDT, and two edits to the very same
//     task on two different offline devices between syncs is rare enough that
//     "don't silently lose the edit you're looking at right now" is a
//     reasonable default until it's proven not to be.
//   - A row deleted remotely (present in the snapshot, absent from the pull)
//     is deleted locally too, unless it was also edited locally since the
//     snapshot — in that case the local edit wins and re-creates it, which
//     reads as "undoing" the other device's delete. Same reasoning as above.

export function snapshotKey(task) {
  // Excludes nothing task-identity-relevant; this is compared by value, not
  // by reference, so any real edit changes the string.
  return JSON.stringify(task)
}

// Applies a fresh pull from the backend onto the current local list.
// remoteTasks: local-shaped tasks with an extra `_remoteUpdatedAt` field
// (already converted from the DB row by the caller).
// snapshot: { [id]: { remoteUpdatedAt, localJSON } } from the previous cycle,
// or {} on a first-ever sync.
export function mergeRemoteIntoLocal(localTasks, remoteTasks, snapshot) {
  const localById = new Map(localTasks.map((t) => [t.id, t]))
  const remoteById = new Map(remoteTasks.map((t) => [t.id, t]))
  const result = []
  const seen = new Set()

  for (const remote of remoteTasks) {
    const { _remoteUpdatedAt, ...remoteTask } = remote
    const local = localById.get(remote.id)
    seen.add(remote.id)

    if (!local) {
      // New on another device.
      result.push(remoteTask)
      continue
    }

    const known = snapshot[remote.id]
    const localChanged = !known || known.localJSON !== snapshotKey(local)
    const remoteChanged = !known || known.remoteUpdatedAt !== _remoteUpdatedAt

    result.push(remoteChanged && !localChanged ? remoteTask : local)
  }

  for (const local of localTasks) {
    if (seen.has(local.id)) continue
    const known = snapshot[local.id]
    const localChanged = !known || known.localJSON !== snapshotKey(local)
    // Known to have existed remotely before, gone now, and untouched locally
    // since -> it was deleted elsewhere. Otherwise it's either brand new
    // locally (never synced) or a local edit racing a remote delete; both
    // keep the local copy, which the next push reinstates.
    if (known && !remoteById.has(local.id) && !localChanged) continue
    result.push(local)
  }

  return result
}

// What needs to be pushed after merging: rows that are new or changed
// relative to the snapshot, and ids that were known-synced but no longer
// exist locally (deleted on this device).
export function diffForPush(localTasks, snapshot) {
  const localIds = new Set(localTasks.map((t) => t.id))
  const upserts = localTasks.filter((t) => {
    const known = snapshot[t.id]
    return !known || known.localJSON !== snapshotKey(t)
  })
  const deletes = Object.keys(snapshot).filter((id) => !localIds.has(id))
  return { upserts, deletes }
}

// Rebuilds the snapshot after a sync cycle completes. remoteUpdatedAtById
// carries the server's updated_at for every row that now exists remotely
// (freshly pulled rows plus whatever the push just wrote), so the next
// cycle's remoteChanged comparison has something real to compare against.
export function buildSnapshot(localTasks, remoteUpdatedAtById) {
  const snapshot = {}
  for (const task of localTasks) {
    const remoteUpdatedAt = remoteUpdatedAtById[task.id]
    if (remoteUpdatedAt === undefined) continue
    snapshot[task.id] = { remoteUpdatedAt, localJSON: snapshotKey(task) }
  }
  return snapshot
}
