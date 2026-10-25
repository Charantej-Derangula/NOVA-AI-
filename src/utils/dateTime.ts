/**
 * Date and time utilities for NOVA.
 *
 * Distinguishes local calendar dates (date-only: YYYY-MM-DD) from exact timestamps.
 * Prevents timezone conversion bugs where UTC parsing of date-only strings (e.g. "2026-10-24")
 * incorrectly shifts the calendar date to the previous day ("2026-10-23") in timezones west of UTC.
 */

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/
const LOCAL_DATETIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

/** Check if a string is a calendar-only date (YYYY-MM-DD) without time. */
export const isDateOnly = (value?: string): boolean => {
  if (!value) return false
  return DATE_ONLY_REGEX.test(value.trim())
}

/**
 * Format a Date object as YYYY-MM-DD according to the user's local calendar.
 */
export const localDateKey = (date: Date = new Date()): string => {
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse a YYYY-MM-DD calendar key safely into a local Date object.
 * Anchored at local noon (12:00:00) so local DST transitions never cross day boundaries.
 */
export const dateFromLocalKey = (value: string): Date => {
  const match = value.trim().match(DATE_ONLY_REGEX)
  if (!match) return new Date(Number.NaN)
  const [, y, m, d] = match
  const year = Number(y)
  const month = Number(m)
  const day = Number(d)
  if (!year || !month || !day) return new Date(Number.NaN)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

/**
 * Safely parse any date value (date-only string, local datetime string, ISO timestamp, or Date)
 * into a valid Date object without unintended UTC date shifting.
 */
export const parseDateValue = (value?: string | Date | null): Date | null => {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  const str = String(value).trim()
  if (!str) return null

  // 1. Date-only string (e.g. "2026-10-24") -> parse as local calendar day noon
  if (DATE_ONLY_REGEX.test(str)) {
    const parsed = dateFromLocalKey(str)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  // 2. Local date-time without timezone offset (e.g. "2026-10-24T14:30")
  const localMatch = str.match(LOCAL_DATETIME_REGEX)
  if (localMatch) {
    const [, y, m, d, hh, mm, ss] = localMatch
    const date = new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      ss ? Number(ss) : 0,
      0
    )
    return Number.isNaN(date.getTime()) ? null : date
  }

  // 3. ISO timestamp with timezone or RFC2822
  const parsed = new Date(str)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Extract the local calendar date key (YYYY-MM-DD) for any date/timestamp value.
 * For a date-only string, returns the exact string without UTC shifts.
 */
export const getLocalDateKey = (value?: string | Date | null): string => {
  if (!value) return ''
  if (typeof value === 'string' && DATE_ONLY_REGEX.test(value.trim())) {
    return value.trim()
  }
  const parsed = parseDateValue(value)
  if (!parsed || Number.isNaN(parsed.getTime())) return ''
  return localDateKey(parsed)
}

/**
 * Check if a date string or timestamp falls on a specific local calendar date.
 */
export const isOnLocalDate = (value: string | Date | undefined | null, date: Date = new Date()): boolean => {
  if (!value) return false
  const itemKey = getLocalDateKey(value)
  const targetKey = localDateKey(date)
  return Boolean(itemKey && targetKey && itemKey === targetKey)
}

/**
 * Compute the next quarter-hour block (e.g. 10:07 -> 10:15).
 */
export const nextQuarterHour = (date: Date = new Date()): Date => {
  const next = new Date(date)
  next.setSeconds(0, 0)
  next.setMinutes(Math.ceil((next.getMinutes() + 1) / 15) * 15)
  return next
}

/**
 * Format a value for an <input type="datetime-local" />.
 * Uses local getters (getFullYear, getHours, etc.) to completely avoid timezone offset math errors.
 */
export const toDateTimeInput = (value?: string | Date): string => {
  if (!value) return ''
  if (typeof value === 'string' && DATE_ONLY_REGEX.test(value.trim())) {
    return `${value.trim()}T09:00`
  }
  const date = parseDateValue(value)
  if (!date || Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * Convert an <input type="datetime-local"> value into an ISO string.
 * Preserves date-only values if supplied directly.
 */
export const fromDateTimeInput = (value: string): string | undefined => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (DATE_ONLY_REGEX.test(trimmed)) {
    return trimmed
  }
  const date = parseDateValue(trimmed)
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined
}

/**
 * Format the time portion of a date value.
 * Returns empty string or "Flexible timing" if the value is date-only.
 */
export const displayTime = (value?: string): string => {
  if (!value) return 'Time not set'
  if (isDateOnly(value)) return ''
  const date = parseDateValue(value)
  if (!date || Number.isNaN(date.getTime())) return 'Time not set'
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
}

/**
 * Format the calendar day for task display (e.g. "Sat, Oct 24").
 */
export const formatTaskDate = (
  value?: string | Date,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }
): string => {
  if (!value) return ''
  const date = parseDateValue(value)
  if (!date || Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, options).format(date)
}

/**
 * Format a complete task schedule label (date + optional time).
 */
export const formatTaskSchedule = (scheduledAt?: string, createdAt?: string): string => {
  if (scheduledAt) {
    const dateLabel = formatTaskDate(scheduledAt)
    if (isDateOnly(scheduledAt)) {
      return dateLabel
    }
    const timeLabel = displayTime(scheduledAt)
    return timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel
  }
  if (createdAt) {
    const dateLabel = formatTaskDate(createdAt)
    return dateLabel ? `Added ${dateLabel}` : 'Flexible'
  }
  return 'Flexible'
}

/**
 * Format minutes into a friendly label (e.g. "45 min", "1h 30m").
 */
export const minutesLabel = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`
}

/**
 * Format seconds into a friendly duration (e.g. "1h 05m", "25m").
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`
}

/**
 * Format any timestamp, ISO string, or Date into a truthful relative or date label.
 *
 * Requirements:
 * - "Just now" for < 45 seconds
 * - "1 minute ago" / "X minutes ago"
 * - "1 hour ago" / "X hours ago"
 * - "Yesterday"
 * - "X days ago"
 * - Clean calendar date (e.g. "Oct 24") for older dates
 * - Gracefully handles legacy strings like "Just now", "Today", or invalid dates
 */
export const formatRelativeTime = (
  value?: string | Date | null,
  now: Date = new Date()
): string => {
  if (!value) return 'Just now'

  // If it's a legacy string that isn't parseable as a date
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return 'Just now'
    if (/^(today|yesterday|recently)$/i.test(trimmed)) {
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
    }
  }

  const date = parseDateValue(value)
  if (!date || Number.isNaN(date.getTime())) {
    return typeof value === 'string' && value.trim() ? value.trim() : 'Recently'
  }

  const nowMs = now.getTime()
  const dateMs = date.getTime()
  const diffSec = Math.floor((nowMs - dateMs) / 1000)

  // Clock skew or less than 45 seconds ago
  if (diffSec < 45) {
    return 'Just now'
  }

  // Minutes (45s to 55m)
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) {
    return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`
  }

  // Hours (60m to 22h)
  const diffHours = Math.round(diffSec / 3600)
  if (diffHours < 22) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
  }

  // Check if calendar day is yesterday in local timezone
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayDateKey = localDateKey(yesterday)
  const itemDateKey = localDateKey(date)

  if (itemDateKey === yesterdayDateKey) {
    return 'Yesterday'
  }

  // Days (2 to 7 days)
  const diffDays = Math.round(diffSec / 86400)
  if (diffDays >= 2 && diffDays <= 7) {
    return `${diffDays} days ago`
  }

  // Within the same calendar year: "Oct 24"
  if (date.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
  }

  // Different year: "Oct 24, 2025"
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

/**
 * Resolves the truthful timestamp for a chat session.
 * Prefers the last message timestamp or a valid ISO updatedAt.
 * If updatedAt is literally the legacy placeholder 'Just now', it falls back to
 * the last message's timestamp if present.
 */
export const getSessionTimestamp = (session: {
  updatedAt?: string
  messages?: Array<{ timestamp?: string }>
}): string => {
  if (session.messages && session.messages.length > 0) {
    const lastMsg = session.messages[session.messages.length - 1]
    if (lastMsg?.timestamp && !Number.isNaN(new Date(lastMsg.timestamp).getTime())) {
      return lastMsg.timestamp
    }
  }
  if (session.updatedAt && !Number.isNaN(new Date(session.updatedAt).getTime())) {
    return session.updatedAt
  }
  return session.updatedAt || new Date().toISOString()
}
