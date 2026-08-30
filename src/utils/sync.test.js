import { describe, expect, it } from 'vitest'
import { buildSnapshot, diffForPush, mergeRemoteIntoLocal, snapshotKey } from './sync'

const task = (overrides) => ({ id: 't1', title: 'Gym', date: '2026-01-01', done: false, ...overrides })

describe('mergeRemoteIntoLocal', () => {
  it('takes the remote version when only the remote side changed', () => {
    const local = task({ title: 'Gym' })
    const remote = { ...task({ title: 'Gym (updated remotely)' }), _remoteUpdatedAt: 2 }
    const snapshot = { t1: { remoteUpdatedAt: 1, localJSON: snapshotKey(local) } }

    const result = mergeRemoteIntoLocal([local], [remote], snapshot)

    expect(result).toEqual([task({ title: 'Gym (updated remotely)' })])
  })

  it('keeps the local version when only the local side changed', () => {
    const local = task({ title: 'Gym (edited here)' })
    const remote = { ...task({ title: 'Gym' }), _remoteUpdatedAt: 1 }
    const snapshot = { t1: { remoteUpdatedAt: 1, localJSON: snapshotKey(task({ title: 'Gym' })) } }

    const result = mergeRemoteIntoLocal([local], [remote], snapshot)

    expect(result).toEqual([local])
  })

  it('keeps the local edit when both sides changed since the last sync', () => {
    const local = task({ title: 'Gym (edited on this device)' })
    const remote = { ...task({ title: 'Gym (edited on the other device)' }), _remoteUpdatedAt: 2 }
    const snapshot = { t1: { remoteUpdatedAt: 1, localJSON: snapshotKey(task({ title: 'Gym' })) } }

    const result = mergeRemoteIntoLocal([local], [remote], snapshot)

    expect(result).toEqual([local])
  })

  it('adopts a task that is brand new on another device', () => {
    const remote = { ...task({ id: 't2', title: 'New from phone' }), _remoteUpdatedAt: 1 }

    const result = mergeRemoteIntoLocal([], [remote], {})

    expect(result).toEqual([task({ id: 't2', title: 'New from phone' })])
  })

  it('deletes a task removed remotely when the local copy was untouched', () => {
    const local = task()
    const snapshot = { t1: { remoteUpdatedAt: 1, localJSON: snapshotKey(local) } }

    const result = mergeRemoteIntoLocal([local], [], snapshot)

    expect(result).toEqual([])
  })

  it('resurrects a task deleted remotely if it was also edited locally since the snapshot (does not silently lose the edit)', () => {
    const local = task({ title: 'Gym (edited right before the other device deleted it)' })
    const snapshot = { t1: { remoteUpdatedAt: 1, localJSON: snapshotKey(task({ title: 'Gym' })) } }

    const result = mergeRemoteIntoLocal([local], [], snapshot)

    expect(result).toEqual([local])
  })

  it('keeps a task that was created locally and never synced, even if it is absent from the remote pull', () => {
    const local = task({ id: 'never-synced' })

    const result = mergeRemoteIntoLocal([local], [], {})

    expect(result).toEqual([local])
  })
})

describe('diffForPush', () => {
  it('upserts anything new or changed since the snapshot', () => {
    const unchanged = task({ id: 'unchanged' })
    const changed = task({ id: 'changed', title: 'Edited' })
    const brandNew = task({ id: 'brand-new' })
    const snapshot = {
      unchanged: { remoteUpdatedAt: 1, localJSON: snapshotKey(unchanged) },
      changed: { remoteUpdatedAt: 1, localJSON: snapshotKey(task({ id: 'changed', title: 'Original' })) },
    }

    const { upserts, deletes } = diffForPush([unchanged, changed, brandNew], snapshot)

    expect(upserts.map((t) => t.id).sort()).toEqual(['brand-new', 'changed'])
    expect(deletes).toEqual([])
  })

  it('reports ids that were known-synced but no longer exist locally as deletes', () => {
    const remaining = task({ id: 'remaining' })
    const snapshot = {
      remaining: { remoteUpdatedAt: 1, localJSON: snapshotKey(remaining) },
      'deleted-here': { remoteUpdatedAt: 1, localJSON: '{}' },
    }

    const { upserts, deletes } = diffForPush([remaining], snapshot)

    expect(upserts).toEqual([])
    expect(deletes).toEqual(['deleted-here'])
  })
})

describe('buildSnapshot', () => {
  it('only snapshots tasks that have a known remote updated_at', () => {
    const synced = task({ id: 'synced' })
    const notYetSynced = task({ id: 'not-yet-synced' })

    const snapshot = buildSnapshot([synced, notYetSynced], { synced: 5 })

    expect(Object.keys(snapshot)).toEqual(['synced'])
    expect(snapshot.synced).toEqual({ remoteUpdatedAt: 5, localJSON: snapshotKey(synced) })
  })
})
