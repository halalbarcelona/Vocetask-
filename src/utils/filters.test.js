import { describe, expect, it } from 'vitest'
import { matchesFilter } from './filters'

const TODAY = '2026-01-15' // a Thursday

describe('matchesFilter — due: upcoming', () => {
  it('matches a one-off task scheduled after today', () => {
    const task = { date: '2026-01-20', recurrence: 'none' }
    expect(matchesFilter(task, { due: 'upcoming' }, TODAY)).toBe(true)
  })

  it('does not match a one-off task scheduled today or in the past', () => {
    expect(matchesFilter({ date: TODAY, recurrence: 'none' }, { due: 'upcoming' }, TODAY)).toBe(false)
    expect(matchesFilter({ date: '2026-01-10', recurrence: 'none' }, { due: 'upcoming' }, TODAY)).toBe(false)
  })

  it('matches an already-started recurring task whose anchor date is long past, as long as it is not due today (the bug this covers)', () => {
    // Daily habit created a month ago is always "upcoming" on any day it
    // isn't due today — its task.date is a creation date, not "today".
    const weeklyOnWednesday = { date: '2025-12-01', recurrence: 'weekly', recurrenceDays: [] }
    // 2025-12-01 is a Monday; TODAY (2026-01-15) is a Thursday, so this
    // weekly habit is not due today and should read as upcoming.
    expect(matchesFilter(weeklyOnWednesday, { due: 'upcoming' }, TODAY)).toBe(true)
  })

  it('does not double-count a recurring task as upcoming on the day it is actually due', () => {
    // Anchor and TODAY are both Thursdays, so this weekly task is due today.
    const task = { date: '2026-01-01', recurrence: 'weekly' }
    expect(matchesFilter(task, { due: 'upcoming' }, TODAY)).toBe(false)
    expect(matchesFilter(task, { due: 'today' }, TODAY)).toBe(true)
  })

  it('does not match a recurring task whose anchor date has not started yet', () => {
    const task = { date: '2026-02-01', recurrence: 'daily' }
    expect(matchesFilter(task, { due: 'upcoming' }, TODAY)).toBe(false)
  })
})
