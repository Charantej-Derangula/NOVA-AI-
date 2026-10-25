import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type { TaskItem } from '../src/types/index.ts'
import { getLocalDateKey, isOnLocalDate } from '../src/utils/dateTime.ts'

describe('Tasks Data & Grouping Regression Tests', () => {
  const mockTasks: TaskItem[] = [
    {
      id: 'task-1',
      title: 'Review proposal',
      completed: false,
      priority: 'high',
      scheduledAt: '2026-10-24', // Scheduled for today (Oct 24)
      estimateMinutes: 30,
      createdAt: '2026-10-24T08:00:00Z',
    },
    {
      id: 'task-2',
      title: 'Prepare presentation',
      completed: true,
      priority: 'medium',
      scheduledAt: '2026-10-23', // Earlier
      estimateMinutes: 45,
      createdAt: '2026-10-23T10:00:00Z',
    },
    {
      id: 'task-3',
      title: 'Design system audit',
      completed: false,
      priority: 'low',
      scheduledAt: '2026-10-25', // Upcoming
      estimateMinutes: 60,
      createdAt: '2026-10-24T09:00:00Z',
    },
    {
      id: 'task-4',
      title: 'Inbox cleanup',
      completed: false,
      priority: 'low',
      scheduledAt: '', // Unscheduled
      estimateMinutes: 15,
      createdAt: '2026-10-24T09:30:00Z',
    },
    // Duplicate of task-1 (e.g. from seed or reload)
    {
      id: 'task-1',
      title: 'Review proposal (duplicate)',
      completed: false,
      priority: 'high',
      scheduledAt: '2026-10-24',
      estimateMinutes: 30,
      createdAt: '2026-10-24T08:00:00Z',
    },
  ]

  test('Tasks deduplication removes identical IDs', () => {
    const uniqueTasks = Array.from(new Map(mockTasks.map((t) => [t.id, t])).values())
    assert.equal(uniqueTasks.length, 4)
    assert.equal(uniqueTasks.filter((t) => t.id === 'task-1').length, 1)
  })

  test('Date scope grouping correctly categorizes Today, Earlier, and Upcoming without shifting', () => {
    const uniqueTasks = Array.from(new Map(mockTasks.map((t) => [t.id, t])).values())
    const today = new Date(2026, 9, 24, 11, 30, 0) // Oct 24, 2026
    const todayKey = '2026-10-24'

    const todayTasks = uniqueTasks.filter((t) => isOnLocalDate(t.scheduledAt, today))
    assert.equal(todayTasks.length, 1)
    assert.equal(todayTasks[0].id, 'task-1')

    const earlierTasks = uniqueTasks.filter((t) => {
      if (!t.scheduledAt) return false
      const key = getLocalDateKey(t.scheduledAt)
      return Boolean(key && key < todayKey)
    })
    assert.equal(earlierTasks.length, 1)
    assert.equal(earlierTasks[0].id, 'task-2')

    const upcomingTasks = uniqueTasks.filter((t) => {
      if (!t.scheduledAt) return false
      const key = getLocalDateKey(t.scheduledAt)
      return Boolean(key && key > todayKey)
    })
    assert.equal(upcomingTasks.length, 1)
    assert.equal(upcomingTasks[0].id, 'task-3')

    // Unscheduled task with empty string scheduledAt must NOT be classified as earlier
    const unscheduledEarlier = uniqueTasks.filter((t) => t.id === 'task-4' && Boolean(t.scheduledAt && getLocalDateKey(t.scheduledAt)! < todayKey))
    assert.equal(unscheduledEarlier.length, 0)
  })
})
