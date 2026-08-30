import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildMonthGrid,
  dayAfterTomorrowISO,
  formatDateLabel,
  formatTimeLabel,
  isoToDate,
  monthLabel,
  toISODate,
  todayISO,
  tomorrowISO,
  weekdayLabels,
} from './dateUtils'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('toISODate / todayISO', () => {
  it('formats using the local calendar date, not a UTC conversion', () => {
    // The historical bug class in this app: new Date().toISOString().slice(0,10)
    // reads back yesterday's date between midnight and the local UTC offset.
    // Pin the clock to 2026-01-05T02:00 in a UTC+5:30 reading — a naive
    // toISOString()-based implementation would report 2026-01-04 here.
    vi.setSystemTime(new Date(2026, 0, 5, 2, 0, 0))
    expect(todayISO()).toBe('2026-01-05')
  })

  it('round-trips through isoToDate to the same calendar day', () => {
    expect(toISODate(isoToDate('2026-03-17'))).toBe('2026-03-17')
  })
})

describe('tomorrowISO / dayAfterTomorrowISO', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(2026, 0, 31, 12, 0, 0)) // Jan 31 — crosses a month boundary
  })

  it('rolls over the month correctly', () => {
    expect(tomorrowISO()).toBe('2026-02-01')
    expect(dayAfterTomorrowISO()).toBe('2026-02-02')
  })
})

describe('formatDateLabel', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(2026, 5, 15, 9, 0, 0)) // June 15, 2026
  })

  it('labels today and tomorrow specially', () => {
    expect(formatDateLabel('2026-06-15')).toBe('Today')
    expect(formatDateLabel('2026-06-16')).toBe('Tomorrow')
  })

  it('falls back to a weekday/month/day label for any other date', () => {
    expect(formatDateLabel('2026-06-20')).not.toBe('Today')
    expect(formatDateLabel('2026-06-20')).not.toBe('Tomorrow')
    expect(formatDateLabel('2026-06-20')).toMatch(/Jun/)
  })
})

describe('formatTimeLabel', () => {
  it('converts 24h "HH:MM" into a 12h label with AM/PM', () => {
    expect(formatTimeLabel('09:05')).toBe('9:05 AM')
    expect(formatTimeLabel('13:30')).toBe('1:30 PM')
    expect(formatTimeLabel('00:00')).toBe('12:00 AM')
    expect(formatTimeLabel('12:00')).toBe('12:00 PM')
  })

  it('returns an empty string when there is no time', () => {
    expect(formatTimeLabel('')).toBe('')
  })
})

describe('weekdayLabels', () => {
  it('starts on Sunday by default and Monday when asked', () => {
    expect(weekdayLabels()[0]).toBe('Sun')
    expect(weekdayLabels(1)[0]).toBe('Mon')
    expect(weekdayLabels(1)).toHaveLength(7)
  })
})

describe('monthLabel', () => {
  it('combines the month name and year', () => {
    expect(monthLabel(2026, 0)).toBe('January 2026')
    expect(monthLabel(2026, 11)).toBe('December 2026')
  })
})

describe('buildMonthGrid', () => {
  it('always returns 42 days (6 full weeks) covering the whole month', () => {
    const grid = buildMonthGrid(2026, 1) // February 2026
    expect(grid).toHaveLength(42)
    // Every day of February must appear somewhere in the grid.
    const febDays = grid.filter((d) => d.getMonth() === 1)
    expect(febDays).toHaveLength(28)
  })

  it('aligns the first row to the requested week start', () => {
    const grid = buildMonthGrid(2026, 1, 1) // week starts Monday
    expect(grid[0].getDay()).toBe(1)
  })
})
