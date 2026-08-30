import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseVoiceCommand } from './voiceParser'

// Anchor "today" to a known Thursday so every relative-date assertion below
// (tomorrow, next Monday, "2 din baad") is checking a fixed, predictable target.
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 0, 1, 9, 0, 0)) // Thursday, 2026-01-01
})

afterEach(() => {
  vi.useRealTimers()
})

describe('time parsing', () => {
  it('parses explicit am/pm', () => {
    expect(parseVoiceCommand('call mom at 8 pm').time).toBe('20:00')
    expect(parseVoiceCommand('call mom at 8 am').time).toBe('08:00')
  })

  it('parses "baje" with an explicit period word', () => {
    expect(parseVoiceCommand('subah 8 baje gym jaana hai').time).toBe('08:00')
    expect(parseVoiceCommand('raat 8 baje gym jaana hai').time).toBe('20:00')
  })

  it('guesses evening for a bare small hour (1-6) and morning for a bare 7-11 hour, with no period word spoken', () => {
    expect(parseVoiceCommand('5 baje gym jaana hai').time).toBe('17:00')
    expect(parseVoiceCommand('9 baje gym jaana hai').time).toBe('09:00')
  })

  it('parses "sawa/sade/paune" fractional hours', () => {
    expect(parseVoiceCommand('sawa 9 baje').time).toBe('09:15')
    expect(parseVoiceCommand('sade 9 baje').time).toBe('09:30')
    expect(parseVoiceCommand('paune 10 baje').time).toBe('09:45')
  })

  it('parses "bajkar" hour-and-minutes phrasing', () => {
    expect(parseVoiceCommand('subah 9 bajkar 20 minute').time).toBe('09:20')
  })
})

describe('date parsing', () => {
  it('parses "kal" as tomorrow, not yesterday', () => {
    expect(parseVoiceCommand('kal gym jaana hai').date).toBe('2026-01-02')
  })

  it('parses "aaj" and "tomorrow"', () => {
    expect(parseVoiceCommand('aaj gym jaana hai').date).toBe('2026-01-01')
    expect(parseVoiceCommand('tomorrow gym').date).toBe('2026-01-02')
  })

  it('parses "parso" as the day after tomorrow', () => {
    expect(parseVoiceCommand('parso doctor ke paas jaana hai').date).toBe('2026-01-03')
  })

  it('parses a bare weekday as the next upcoming occurrence, including today\'s own name', () => {
    // "today" (2026-01-01) is a Thursday; saying "Thursday" should mean next week, not today.
    expect(parseVoiceCommand('Monday ko Ali ko call karna hai').date).toBe('2026-01-05')
    expect(parseVoiceCommand('Thursday ko call karna hai').date).toBe('2026-01-08')
  })

  it('parses relative offsets without requiring "baad"', () => {
    expect(parseVoiceCommand('2 din me dentist ke paas jaana hai').date).toBe('2026-01-03')
    expect(parseVoiceCommand('3 hafte baad follow up').date).toBe('2026-01-22')
  })

  it('parses "agle hafte" / "next week"', () => {
    expect(parseVoiceCommand('agle hafte dentist ke paas jaana hai').date).toBe('2026-01-08')
  })

  it('defaults to today when no date is spoken at all', () => {
    expect(parseVoiceCommand('gym jaana hai').date).toBe('2026-01-01')
  })
})

describe('recurrence parsing', () => {
  it('parses daily recurrence', () => {
    const parsed = parseVoiceCommand('kal se roz 30 minute reading karni hai')
    expect(parsed.recurrence).toBe('daily')
  })

  it('parses weekly recurrence', () => {
    expect(parseVoiceCommand('har Friday 6 baje football practice').recurrence).toBe('custom')
  })

  it('parses monthly recurrence', () => {
    expect(parseVoiceCommand('har mahine rent pay karna hai').recurrence).toBe('monthly')
  })

  it('produces a plain one-off task when no recurrence word is spoken', () => {
    expect(parseVoiceCommand('kal gym jaana hai').recurrence).toBe('none')
  })
})

describe('priority parsing', () => {
  it('picks up explicit priority words', () => {
    expect(parseVoiceCommand('ye urgent hai').priority).toBe('high')
    expect(parseVoiceCommand('isko high priority kar do').priority).toBe('high')
  })

  it('defaults to none when nothing is said', () => {
    expect(parseVoiceCommand('gym jaana hai').priority).toBe('none')
  })
})

describe('title extraction', () => {
  it('strips filler words and capitalizes the remaining title', () => {
    expect(parseVoiceCommand('kal subah 8 baje gym jaana hai').title).toBe('Gym')
  })

  it('keeps a Hindi title intact once date/time filler is removed', () => {
    const parsed = parseVoiceCommand('15 tarikh ko बिजली का बिल')
    expect(parsed.title).toContain('बिजली')
  })

  it('does not eat the whole title when only a bare task is spoken', () => {
    expect(parseVoiceCommand('finish project report').title.toLowerCase()).toContain('project report')
  })
})

describe('parseVoiceCommand end-to-end phrases', () => {
  it('parses a fully mixed Hinglish sentence into title, date, time and recurrence together', () => {
    const parsed = parseVoiceCommand('har Friday subah 8 baje gym jaana hai')
    expect(parsed.recurrence).toBe('custom')
    expect(parsed.time).toBe('08:00')
    expect(parsed.title.toLowerCase()).toContain('gym')
  })

  it('parses "3 baje wali meeting ke baad mom ko call karna hai"', () => {
    const parsed = parseVoiceCommand('3 baje wali meeting ke baad mom ko call karna hai')
    expect(parsed.time).toBe('15:00')
    expect(parsed.title.toLowerCase()).toContain('call')
  })
})
