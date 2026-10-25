import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  isDateOnly,
  parseDateValue,
  getLocalDateKey,
  localDateKey,
  dateFromLocalKey,
  isOnLocalDate,
  formatTaskDate,
  formatTaskSchedule,
  toDateTimeInput,
  fromDateTimeInput,
  formatRelativeTime,
} from '../src/utils/dateTime.ts'

describe('Date & Time Regression Tests', () => {
  test('isDateOnly identifies YYYY-MM-DD format correctly', () => {
    assert.equal(isDateOnly('2026-10-24'), true)
    assert.equal(isDateOnly('2026-01-01'), true)
    assert.equal(isDateOnly('2026-10-24T09:30:00Z'), false)
    assert.equal(isDateOnly('2026-10-24T12:00:00.000Z'), false)
    assert.equal(isDateOnly(''), false)
    assert.equal(isDateOnly(undefined), false)
  })

  test('date-only string "2026-10-24" does not regress to October 23', () => {
    // Crucial bug test: Ensure "2026-10-24" is anchored to local noon or local calendar date,
    // never parsed as UTC midnight which shifts back to Oct 23 in negative timezones.
    const key = getLocalDateKey('2026-10-24')
    assert.equal(key, '2026-10-24')

    const parsed = parseDateValue('2026-10-24')
    assert.ok(parsed !== null)
    assert.equal(localDateKey(parsed), '2026-10-24')
    assert.equal(parsed.getFullYear(), 2026)
    assert.equal(parsed.getMonth(), 9) // 0-indexed October
    assert.equal(parsed.getDate(), 24)
  })

  test('dateFromLocalKey anchors at noon and survives timezone conversions', () => {
    const date = dateFromLocalKey('2026-10-24')
    assert.equal(date.getFullYear(), 2026)
    assert.equal(date.getMonth(), 9)
    assert.equal(date.getDate(), 24)
    assert.equal(date.getHours(), 12)
    assert.equal(localDateKey(date), '2026-10-24')
  })

  test('isOnLocalDate correctly matches today, yesterday, and tomorrow', () => {
    const referenceDate = new Date(2026, 9, 24, 11, 30, 0) // Oct 24, 2026

    // A task scheduled for today
    assert.equal(isOnLocalDate('2026-10-24', referenceDate), true)
    assert.equal(isOnLocalDate(new Date(2026, 9, 24, 23, 59, 59), referenceDate), true)
    assert.equal(isOnLocalDate(new Date(2026, 9, 24, 0, 0, 0), referenceDate), true)

    // Yesterday: Oct 23
    assert.equal(isOnLocalDate('2026-10-23', referenceDate), false)
    assert.equal(isOnLocalDate(new Date(2026, 9, 23, 23, 59, 59), referenceDate), false)

    // Tomorrow: Oct 25
    assert.equal(isOnLocalDate('2026-10-25', referenceDate), false)
    assert.equal(isOnLocalDate(new Date(2026, 9, 25, 8, 0, 0), referenceDate), false)
  })

  test('localDateKey handles midnight transition consistently', () => {
    // 23:59:59 vs 00:00:00 of next day
    const lateNight = new Date(2026, 9, 23, 23, 59, 59)
    const earlyMorning = new Date(2026, 9, 24, 0, 0, 0)

    assert.equal(localDateKey(lateNight), '2026-10-23')
    assert.equal(localDateKey(earlyMorning), '2026-10-24')
  })

  test('formatTaskDate displays clean readable date without shifting', () => {
    const formatted = formatTaskDate('2026-10-24')
    assert.ok(formatted.includes('Oct 24') || formatted.includes('24 Oct'), `Expected Oct 24 in "${formatted}"`)
  })

  test('formatTaskSchedule formats date-only tasks without fake time', () => {
    const scheduled = formatTaskSchedule('2026-10-24', '2026-10-24T10:00:00Z')
    assert.ok(scheduled.includes('Oct 24') || scheduled.includes('24 Oct'), `Expected Oct 24 in "${scheduled}"`)
    // Must NOT contain AM/PM or time for date-only task
    assert.ok(!scheduled.includes(':'), `Expected no time in date-only schedule "${scheduled}"`)
  })

  test('toDateTimeInput and fromDateTimeInput preserve local dates and timestamps', () => {
    // Date-only preservation
    assert.equal(toDateTimeInput('2026-10-24'), '2026-10-24T09:00')
    assert.equal(fromDateTimeInput('2026-10-24'), '2026-10-24')

    // Timestamp with time
    const inputVal = '2026-10-24T14:30'
    const stored = fromDateTimeInput(inputVal)
    assert.ok(stored && stored.startsWith('2026-10-24T'))
  })

  test('formatRelativeTime produces accurate relative labels without regressing to Just now', () => {
    const fixedNow = new Date('2026-10-24T12:00:00Z')

    // 20 seconds ago -> Just now
    assert.equal(
      formatRelativeTime('2026-10-24T11:59:40Z', fixedNow),
      'Just now'
    )

    // 5 minutes ago -> 5 minutes ago
    assert.equal(
      formatRelativeTime('2026-10-24T11:55:00Z', fixedNow),
      '5 minutes ago'
    )

    // 1 hour ago -> 1 hour ago (CRITICAL user requirement: old conversations from 1 hour ago must NOT say Just now!)
    assert.equal(
      formatRelativeTime('2026-10-24T11:00:00Z', fixedNow),
      '1 hour ago'
    )

    // 3 hours ago -> 3 hours ago
    assert.equal(
      formatRelativeTime('2026-10-24T09:00:00Z', fixedNow),
      '3 hours ago'
    )

    // 1 day ago -> Yesterday
    assert.equal(
      formatRelativeTime('2026-10-23T11:00:00Z', fixedNow),
      'Yesterday'
    )

    // 3 days ago -> 3 days ago
    assert.equal(
      formatRelativeTime('2026-10-21T11:00:00Z', fixedNow),
      '3 days ago'
    )
  })
})
