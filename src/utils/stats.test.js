import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { habitStreak } from './stats'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('habitStreak — daily habits', () => {
  it('counts consecutive completed days ending today', () => {
    vi.setSystemTime(new Date(2026, 0, 10, 9, 0, 0)) // Saturday
    const task = {
      recurrence: 'daily',
      date: '2026-01-01',
      completedDates: ['2026-01-08', '2026-01-09', '2026-01-10'],
    }
    expect(habitStreak(task)).toBe(3)
  })

  it('still counts yesterday\'s streak when today is not done yet', () => {
    vi.setSystemTime(new Date(2026, 0, 10, 9, 0, 0))
    const task = {
      recurrence: 'daily',
      date: '2026-01-01',
      completedDates: ['2026-01-08', '2026-01-09'],
    }
    expect(habitStreak(task)).toBe(2)
  })
})

describe('habitStreak — weekly habits (the bug this covers)', () => {
  it('counts consecutive completed weekly occurrences, not consecutive calendar days', () => {
    // Anchor is a Thursday; due every Thursday from then on.
    vi.setSystemTime(new Date(2026, 0, 22, 9, 0, 0)) // Thursday, 2026-01-22
    const task = {
      recurrence: 'weekly',
      date: '2026-01-01', // also a Thursday
      completedDates: ['2026-01-08', '2026-01-15', '2026-01-22'],
    }
    expect(habitStreak(task)).toBe(3)
  })

  it('breaks the streak on a missed weekly occurrence, not on the days between', () => {
    vi.setSystemTime(new Date(2026, 0, 22, 9, 0, 0))
    const task = {
      recurrence: 'weekly',
      date: '2026-01-01',
      completedDates: ['2026-01-15', '2026-01-22'], // Jan 8 missed
    }
    expect(habitStreak(task)).toBe(2)
  })

  it('does not zero out an otherwise-kept weekly streak just because today is not the due day', () => {
    vi.setSystemTime(new Date(2026, 0, 24, 9, 0, 0)) // Saturday, two days after the Thursday
    const task = {
      recurrence: 'weekly',
      date: '2026-01-01',
      completedDates: ['2026-01-08', '2026-01-15', '2026-01-22'],
    }
    expect(habitStreak(task)).toBe(3)
  })
})

describe('habitStreak — monthly habits', () => {
  it('counts consecutive completed months by day-of-month', () => {
    vi.setSystemTime(new Date(2026, 2, 15, 9, 0, 0)) // March 15
    const task = {
      recurrence: 'monthly',
      date: '2026-01-15',
      completedDates: ['2026-01-15', '2026-02-15', '2026-03-15'],
    }
    expect(habitStreak(task)).toBe(3)
  })
})

describe('habitStreak — custom recurrence never due', () => {
  it('returns 0 without hanging when recurrenceDays is empty', () => {
    vi.setSystemTime(new Date(2026, 0, 10, 9, 0, 0))
    const task = {
      recurrence: 'custom',
      recurrenceDays: [],
      date: '2026-01-01',
      completedDates: ['2026-01-09'],
    }
    expect(habitStreak(task)).toBe(0)
  })
})
