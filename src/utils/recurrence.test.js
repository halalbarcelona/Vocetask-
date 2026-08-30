import { describe, expect, it } from 'vitest'
import { isDueOn, isOverdue } from './recurrence'

describe('isOverdue', () => {
  it('is true for a one-time task whose date has passed and is not done', () => {
    expect(isOverdue({ date: '2026-01-01', done: false }, '2026-01-05')).toBe(true)
  })

  it('is false once the task is done', () => {
    expect(isOverdue({ date: '2026-01-01', done: true }, '2026-01-05')).toBe(false)
  })

  it('is false for a task due today or in the future', () => {
    expect(isOverdue({ date: '2026-01-05', done: false }, '2026-01-05')).toBe(false)
    expect(isOverdue({ date: '2026-01-06', done: false }, '2026-01-05')).toBe(false)
  })

  it('is never true for a recurring task, however old its anchor date', () => {
    expect(isOverdue({ date: '2020-01-01', done: false, recurrence: 'daily' }, '2026-01-05')).toBe(false)
  })

  it('is false when there is no date at all', () => {
    expect(isOverdue({ date: null, done: false }, '2026-01-05')).toBe(false)
  })
})

describe('isDueOn — daily recurrence', () => {
  it('is due every day from its anchor date onward, never before', () => {
    const task = { date: '2026-01-01', recurrence: 'daily' }
    expect(isDueOn(task, '2026-01-01')).toBe(true)
    expect(isDueOn(task, '2026-03-15')).toBe(true)
    expect(isDueOn(task, '2025-12-31')).toBe(false)
  })
})

describe('isDueOn — weekly recurrence', () => {
  it('is due only on the same weekday as its anchor date', () => {
    // 2026-01-01 is a Thursday.
    const task = { date: '2026-01-01', recurrence: 'weekly' }
    expect(isDueOn(task, '2026-01-08')).toBe(true) // next Thursday
    expect(isDueOn(task, '2026-01-07')).toBe(false) // Wednesday
  })
})

describe('isDueOn — monthly recurrence', () => {
  it('is due on the same day-of-month every month', () => {
    const task = { date: '2026-01-15', recurrence: 'monthly' }
    expect(isDueOn(task, '2026-02-15')).toBe(true)
    expect(isDueOn(task, '2026-02-14')).toBe(false)
  })
})

describe('isDueOn — custom recurrence', () => {
  it('is due only on the configured weekdays', () => {
    // Mon = 1, Wed = 3, Fri = 5
    const task = { date: '2026-01-01', recurrence: 'custom', recurrenceDays: [1, 3, 5] }
    expect(isDueOn(task, '2026-01-05')).toBe(true) // Monday
    expect(isDueOn(task, '2026-01-06')).toBe(false) // Tuesday
    expect(isDueOn(task, '2026-01-07')).toBe(true) // Wednesday
  })
})

describe('isDueOn — one-time tasks', () => {
  it('is due only on its exact date', () => {
    const task = { date: '2026-01-05', recurrence: 'none' }
    expect(isDueOn(task, '2026-01-05')).toBe(true)
    expect(isDueOn(task, '2026-01-06')).toBe(false)
  })

  it('is never due before it was scheduled, or with no date at all', () => {
    expect(isDueOn({ date: '2026-01-05' }, '2026-01-01')).toBe(false)
    expect(isDueOn({ date: null }, '2026-01-01')).toBe(false)
  })
})
