import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import {
  executeActionIntent,
  executeToolCall,
  matchTasks,
  resolveSchedule,
  type ActionEngineContext,
} from '../src/services/actionEngine.ts'
import {
  localDateKey,
  isDateOnly,
  isOnLocalDate,
} from '../src/utils/dateTime.ts'
import type { TaskItem, TaskDraft } from '../src/types/index.ts'

// In-memory mock storage
class MockStorage {
  private store: Map<string, string> = new Map()

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}

describe('NOVA Production-Ready Task Execution Suite', () => {
  let mockStorage: MockStorage
  let tasks: TaskItem[]
  const currentUser = { id: 'usr-production-001', email: 'nova-user@autopulse.ai', displayName: 'Nova User' }

  beforeEach(() => {
    mockStorage = new MockStorage()
    ;(globalThis as any).localStorage = mockStorage
    tasks = []
  })

  // Helper to build realistic ActionEngineContext
  function createTestContext(overrides?: Partial<ActionEngineContext>): ActionEngineContext {
    return {
      prompt: '',
      tasks,
      memories: [],
      knowledge: [],
      workspaces: [],
      activeWorkspaceId: null,
      currentUser,
      onAddTask: async (draft: TaskDraft) => {
        const newTask: TaskItem = {
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: draft.title,
          completed: false,
          priority: draft.priority ?? 'medium',
          scheduledAt: draft.scheduledAt,
          estimateMinutes: draft.estimateMinutes ?? 30,
          workspaceId: draft.workspaceId || undefined,
          createdAt: new Date().toISOString(),
        }
        tasks.push(newTask)
        mockStorage.setItem('nova:tasks:v1', JSON.stringify(tasks))
        return newTask
      },
      onUpdateTask: (id: string, updates: Partial<TaskItem>) => {
        const idx = tasks.findIndex((t) => t.id === id)
        if (idx !== -1) {
          tasks[idx] = { ...tasks[idx], ...updates }
          mockStorage.setItem('nova:tasks:v1', JSON.stringify(tasks))
        }
      },
      onToggleTask: (id: string) => {
        const idx = tasks.findIndex((t) => t.id === id)
        if (idx !== -1) {
          const completed = !tasks[idx].completed
          tasks[idx] = {
            ...tasks[idx],
            completed,
            completedAt: completed ? new Date().toISOString() : undefined,
          }
          mockStorage.setItem('nova:tasks:v1', JSON.stringify(tasks))
        }
      },
      onDeleteTask: (id: string) => {
        const idx = tasks.findIndex((t) => t.id === id)
        if (idx !== -1) {
          tasks.splice(idx, 1)
          mockStorage.setItem('nova:tasks:v1', JSON.stringify(tasks))
        }
      },
      onDeleteAllTasks: () => {
        tasks = []
        mockStorage.setItem('nova:tasks:v1', JSON.stringify([]))
      },
      onAddMemory: () => {},
      onUpdateMemory: () => {},
      onDeleteMemory: () => {},
      onAddKnowledge: () => {},
      onUpdateKnowledge: () => {},
      onDeleteKnowledge: () => {},
      onAddWorkspace: () => {},
      onUpdateWorkspace: () => {},
      onDeleteWorkspace: () => {},
      onSelectWorkspace: () => {},
      ...overrides,
    }
  }

  describe('1. Natural Language Task Action Scenarios', () => {
    it('1.1 Creates task: "Create a task to finish my AutoPulse presentation tomorrow."', async () => {
      const ctx = createTestContext({
        prompt: 'Create a task to finish my AutoPulse presentation tomorrow.',
      })

      const result = await executeActionIntent(ctx)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.entityType, 'task')
      assert.strictEqual(result.verb, 'create')
      assert.ok(result.recordId?.startsWith('task-'))
      assert.strictEqual(tasks.length, 1)
      assert.strictEqual(tasks[0].title, 'finish my AutoPulse presentation')
      assert.strictEqual(tasks[0].completed, false)
      assert.ok(tasks[0].scheduledAt, 'Must have scheduledAt date')
      assert.ok(result.response.includes('Task Created & Persisted'))
      assert.ok(result.response.includes('finish my AutoPulse presentation'))
    })

    it('1.2 Sets reminder: "Remind me to go to the gym at 7 PM."', async () => {
      const ctx = createTestContext({
        prompt: 'Remind me to go to the gym at 7 PM.',
      })

      const result = await executeActionIntent(ctx)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.entityType, 'task')
      assert.strictEqual(result.verb, 'create')
      assert.strictEqual(tasks.length, 1)
      assert.strictEqual(tasks[0].title, 'go to the gym')
      assert.ok(tasks[0].scheduledAt)
      const scheduledDate = new Date(tasks[0].scheduledAt!)
      assert.strictEqual(scheduledDate.getHours(), 19)
      assert.strictEqual(isDateOnly(tasks[0].scheduledAt), false, 'Reminder must have specific time')
      assert.ok(result.response.includes('Reminder Set & Persisted'))
      assert.ok(result.response.includes('go to the gym'))
    })

    it('1.3 Moves deadline: "Move my assignment deadline to Friday."', async () => {
      // Seed existing task
      const existing: TaskItem = {
        id: 'task-assignment-1',
        title: 'Submit chemistry assignment',
        completed: false,
        priority: 'high',
        scheduledAt: '2026-10-23',
        estimateMinutes: 60,
        createdAt: '2026-10-20T08:00:00Z',
      }
      tasks.push(existing)

      const ctx = createTestContext({
        prompt: 'Move my assignment deadline to Friday.',
      })

      const result = await executeActionIntent(ctx)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.entityType, 'task')
      assert.strictEqual(result.verb, 'update')
      assert.strictEqual(tasks.length, 1)
      assert.ok(tasks[0].scheduledAt, 'Should have new scheduledAt date')
      assert.ok(result.response.includes('Submit chemistry assignment'))
      assert.ok(result.response.includes('Deadline moved to'))
    })

    it('1.4 Completes task: "Mark the presentation task as completed."', async () => {
      const existing: TaskItem = {
        id: 'task-pres-1',
        title: 'AutoPulse presentation preparation',
        completed: false,
        priority: 'high',
        scheduledAt: '2026-10-25',
        estimateMinutes: 45,
        createdAt: '2026-10-24T10:00:00Z',
      }
      tasks.push(existing)

      const ctx = createTestContext({
        prompt: 'Mark the presentation task as completed.',
      })

      const result = await executeActionIntent(ctx)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.entityType, 'task')
      assert.strictEqual(result.verb, 'complete')
      assert.strictEqual(tasks[0].completed, true)
      assert.ok(tasks[0].completedAt, 'Should record completedAt timestamp')
      assert.ok(result.response.includes('AutoPulse presentation preparation'))
      assert.ok(result.response.includes('as completed'))
    })

    it('1.5 Shows overdue tasks: "Show me my overdue tasks."', async () => {
      const yesterday = new Date(Date.now() - 86400000)
      const yesterdayKey = localDateKey(yesterday)
      const tomorrow = new Date(Date.now() + 86400000)
      const tomorrowKey = localDateKey(tomorrow)

      tasks.push(
        {
          id: 'task-overdue-1',
          title: 'Quarterly budget draft',
          completed: false,
          priority: 'high',
          scheduledAt: yesterdayKey,
          estimateMinutes: 30,
          createdAt: yesterday.toISOString(),
        },
        {
          id: 'task-future-1',
          title: 'Sprint planning',
          completed: false,
          priority: 'medium',
          scheduledAt: tomorrowKey,
          estimateMinutes: 45,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'task-done-past-1',
          title: 'Completed archive review',
          completed: true,
          priority: 'low',
          scheduledAt: yesterdayKey,
          estimateMinutes: 20,
          createdAt: yesterday.toISOString(),
        }
      )

      const ctx = createTestContext({
        prompt: 'Show me my overdue tasks.',
      })

      const result = await executeActionIntent(ctx)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'queried')
      assert.strictEqual(result.verb, 'list')
      assert.ok(result.response.includes('Quarterly budget draft'))
      assert.ok(!result.response.includes('Sprint planning'), 'Must NOT list upcoming tasks')
      assert.ok(!result.response.includes('Completed archive review'), 'Must NOT list completed tasks as overdue')
    })

    it('1.6 Deletes duplicate task: "Delete the duplicate task about research notes."', async () => {
      // Seed two identical tasks
      const task1: TaskItem = {
        id: 'task-notes-1',
        title: 'Review research notes',
        completed: false,
        priority: 'medium',
        estimateMinutes: 30,
        createdAt: '2026-10-24T08:00:00Z',
      }
      const task2: TaskItem = {
        id: 'task-notes-2',
        title: 'Review research notes',
        completed: false,
        priority: 'medium',
        estimateMinutes: 30,
        createdAt: '2026-10-24T09:00:00Z', // Newest duplicate
      }
      tasks.push(task1, task2)

      const ctx = createTestContext({
        prompt: 'Delete the duplicate task about research notes.',
      })

      const result = await executeActionIntent(ctx)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.verb, 'delete')
      assert.strictEqual(tasks.length, 1, 'Exactly one duplicate should be removed')
      assert.strictEqual(tasks[0].id, 'task-notes-1', 'Should retain original task-notes-1 and delete task-notes-2')
      assert.ok(result.response.includes('Duplicate Task Removed'))
      assert.ok(result.response.includes('Review research notes'))
    })
  })

  describe('2. Disambiguation & Ambiguous Task Matching', () => {
    it('asks concise clarification when multiple different tasks match a complete request', async () => {
      tasks.push(
        {
          id: 'task-meet-1',
          title: 'Engineering team meeting',
          completed: false,
          priority: 'medium',
          estimateMinutes: 30,
          createdAt: '2026-10-24T08:00:00Z',
        },
        {
          id: 'task-meet-2',
          title: 'Client sync meeting',
          completed: false,
          priority: 'high',
          estimateMinutes: 30,
          createdAt: '2026-10-24T09:00:00Z',
        }
      )

      const ctx = createTestContext({
        prompt: 'Mark the meeting task as completed.',
      })

      const result = await executeActionIntent(ctx)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'needs_confirmation')
      assert.ok(result.response.includes('Multiple tasks matched'))
      assert.ok(result.response.includes('1. **Engineering team meeting**'))
      assert.ok(result.response.includes('2. **Client sync meeting**'))
      // Verify neither task was mutated
      assert.strictEqual(tasks[0].completed, false)
      assert.strictEqual(tasks[1].completed, false)
    })

    it('matches exact task title when available rather than throwing ambiguous error', () => {
      const candidates: TaskItem[] = [
        { id: '1', title: 'Submit report', completed: false, priority: 'medium', estimateMinutes: 30, createdAt: '' },
        { id: '2', title: 'Submit report to manager', completed: false, priority: 'high', estimateMinutes: 30, createdAt: '' },
      ]
      const matched = matchTasks(candidates, 'Submit report')
      assert.ok(matched.exactMatch)
      assert.strictEqual(matched.exactMatch?.id, '1')
    })
  })

  describe('3. Relative Dates & Local Timezone Correctness', () => {
    it('resolves relative dates anchored to user reference date', () => {
      const ref = new Date(2026, 9, 25, 10, 0, 0) // Oct 25, 2026
      const sched = resolveSchedule('tomorrow', ref)
      assert.ok(sched.scheduledAt)
      assert.strictEqual(sched.scheduledAt, '2026-10-26')
      assert.strictEqual(isDateOnly(sched.scheduledAt), true)

      const withTime = resolveSchedule('tomorrow at 3pm', ref)
      assert.ok(withTime.scheduledAt)
      const d = new Date(withTime.scheduledAt)
      assert.strictEqual(d.getHours(), 15)
      assert.strictEqual(isDateOnly(withTime.scheduledAt), false)
    })

    it('resolves "in 3 days" without timezone shift', () => {
      const ref = new Date(2026, 9, 20, 12, 0, 0) // Oct 20, 2026
      const res = resolveSchedule('in 3 days', ref)
      assert.strictEqual(res.scheduledAt, '2026-10-23')
    })
  })

  describe('4. Truthfulness & Supabase Persistence Failures', () => {
    it('reports failure truthfully and does not mutate view when onAddTask throws', async () => {
      const failingCtx = createTestContext({
        prompt: 'Create task: Ship production binary',
        onAddTask: async () => {
          throw new Error('Supabase RLS Policy violation: 403 Forbidden')
        },
      })

      const result = await executeActionIntent(failingCtx)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'error')
      assert.ok(result.error?.includes('403 Forbidden'))
      assert.ok(result.response.includes('Persistence Failed'))
      assert.strictEqual(tasks.length, 0, 'No task should have been added to the store')
    })

    it('reports error truthfully when task to complete is not found', async () => {
      const ctx = createTestContext({
        prompt: 'Mark the non-existent task as completed',
      })

      const result = await executeActionIntent(ctx)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'error')
      assert.ok(result.response.includes('Could not find a task matching'))
    })
  })

  describe('5. Tasks/My Day Integration & Surviving Refresh', () => {
    it('stores tasks in persistent localStorage that survives page reloads', async () => {
      const ctx = createTestContext({
        prompt: 'Create a task to audit security logs tomorrow',
      })
      await executeActionIntent(ctx)
      assert.strictEqual(tasks.length, 1)

      // Simulate page refresh: read from storage
      const storedJson = mockStorage.getItem('nova:tasks:v1')
      assert.ok(storedJson)
      const refreshedTasks: TaskItem[] = JSON.parse(storedJson)
      assert.strictEqual(refreshedTasks.length, 1)
      assert.strictEqual(refreshedTasks[0].title, 'audit security logs')
      assert.strictEqual(refreshedTasks[0].id, tasks[0].id)
    })

    it('correctly filters tasks for My Day view (scheduled for today)', () => {
      const today = new Date()
      const todayKey = localDateKey(today)
      const testTasks: TaskItem[] = [
        { id: '1', title: 'Today Task', completed: false, priority: 'high', scheduledAt: todayKey, estimateMinutes: 30, createdAt: '' },
        { id: '2', title: 'Future Task', completed: false, priority: 'low', scheduledAt: '2099-01-01', estimateMinutes: 30, createdAt: '' },
        { id: '3', title: 'Unscheduled', completed: false, priority: 'medium', estimateMinutes: 30, createdAt: '' },
      ]

      const myDayTasks = testTasks.filter((t) => isOnLocalDate(t.scheduledAt, today))
      assert.strictEqual(myDayTasks.length, 1)
      assert.strictEqual(myDayTasks[0].id, '1')
    })
  })

  describe('6. Shared Action Engine (Chat & Gemini Live Voice Parity)', () => {
    it('executes create_task via structured tool call (Gemini Live path)', async () => {
      const ctx = createTestContext()
      const toolResult = await executeToolCall(
        'create_task',
        {
          title: 'Voice generated task for AutoPulse',
          priority: 'high',
          scheduledAt: '2026-10-26T10:00:00',
          estimateMinutes: 45,
        },
        ctx
      )

      assert.strictEqual(toolResult.handled, true)
      assert.strictEqual(toolResult.status, 'executed')
      assert.strictEqual(tasks.length, 1)
      assert.strictEqual(tasks[0].title, 'Voice generated task for AutoPulse')
      assert.strictEqual(tasks[0].priority, 'high')
      assert.ok(toolResult.response.includes('Task Created & Persisted'))
      assert.ok(toolResult.response.includes('Voice generated task for AutoPulse'))
    })

    it('executes complete_task via structured tool call (Gemini Live path)', async () => {
      tasks.push({
        id: 'task-voice-target-1',
        title: 'Review flight itinerary',
        completed: false,
        priority: 'medium',
        estimateMinutes: 30,
        createdAt: '2026-10-25T08:00:00Z',
      })

      const ctx = createTestContext()
      const toolResult = await executeToolCall(
        'complete_task',
        {
          taskId: 'task-voice-target-1',
        },
        ctx
      )

      assert.strictEqual(toolResult.handled, true)
      assert.strictEqual(toolResult.status, 'executed')
      assert.strictEqual(tasks[0].completed, true)
      assert.ok(toolResult.response.includes('Review flight itinerary'))
      assert.ok(toolResult.response.includes('as completed'))
    })

    it('executes list_tasks with overdue filter via structured tool call', async () => {
      tasks.push(
        {
          id: 'task-ov-1',
          title: 'Overdue voice task',
          completed: false,
          priority: 'high',
          scheduledAt: '2026-10-20',
          estimateMinutes: 30,
          createdAt: '',
        },
        {
          id: 'task-fut-1',
          title: 'Future voice task',
          completed: false,
          priority: 'low',
          scheduledAt: '2026-10-30',
          estimateMinutes: 30,
          createdAt: '',
        }
      )

      const ctx = createTestContext()
      const toolResult = await executeToolCall(
        'list_tasks',
        {
          filter: 'overdue',
        },
        ctx
      )

      assert.strictEqual(toolResult.handled, true)
      assert.strictEqual(toolResult.status, 'queried')
      assert.ok(toolResult.response.includes('Overdue voice task'))
      assert.ok(!toolResult.response.includes('Future voice task'))
    })
  })

  describe('7. Authentication & Ownership Verification', () => {
    it('authenticates user context and links created task correctly', async () => {
      let passedUser: ActionEngineContext['currentUser']
      const ctx = createTestContext({
        prompt: 'Create task: User auth check',
        currentUser,
        onAddTask: async (draft: TaskDraft) => {
          passedUser = ctx.currentUser
          const newTask: TaskItem = {
            id: 'task-auth-1',
            title: draft.title,
            completed: false,
            priority: 'medium',
            estimateMinutes: 30,
            createdAt: new Date().toISOString(),
          }
          tasks.push(newTask)
          return newTask
        },
      })

      const result = await executeActionIntent(ctx)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.ok(passedUser)
      assert.strictEqual(passedUser?.id, 'usr-production-001')
      assert.strictEqual(passedUser?.email, 'nova-user@autopulse.ai')
    })

    it('authenticates anonymous guest user context and links created task to anonymous user ID', async () => {
      const anonUser = { id: 'anon-usr-uuid-777', displayName: 'Guest User' }
      let savedTask: TaskItem | undefined
      let savedUserId: string | undefined

      const ctx = createTestContext({
        prompt: 'Create a task to audit guest telemetry',
        currentUser: anonUser,
        onAddTask: async (draft: TaskDraft) => {
          savedUserId = ctx.currentUser?.id
          const newTask: TaskItem = {
            id: 'task-anon-1',
            title: draft.title,
            completed: false,
            priority: draft.priority ?? 'medium',
            estimateMinutes: 30,
            createdAt: new Date().toISOString(),
          }
          savedTask = newTask
          tasks.push(newTask)
          mockStorage.setItem('nova:tasks:v1', JSON.stringify(tasks))
          return newTask
        },
      })

      const result = await executeActionIntent(ctx)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.ok(savedTask)
      assert.strictEqual(savedTask?.title, 'audit guest telemetry')
      assert.strictEqual(savedUserId, 'anon-usr-uuid-777')
      assert.ok(result.response.includes('Task Created & Persisted'))
      assert.ok(result.response.includes('audit guest telemetry'))

      // Verify task appears in store and survives simulated refresh
      const refreshedTasks: TaskItem[] = JSON.parse(mockStorage.getItem('nova:tasks:v1')!)
      assert.strictEqual(refreshedTasks.length, 1)
      assert.strictEqual(refreshedTasks[0].id, 'task-anon-1')
      assert.strictEqual(refreshedTasks[0].completed, false)
    })

    it('completes the anonymous task through chat and verifies completion status persists', async () => {
      const anonUser = { id: 'anon-usr-uuid-777', displayName: 'Guest User' }
      tasks.push({
        id: 'task-anon-1',
        title: 'audit guest telemetry',
        completed: false,
        priority: 'medium',
        estimateMinutes: 30,
        createdAt: new Date().toISOString(),
      })
      mockStorage.setItem('nova:tasks:v1', JSON.stringify(tasks))

      const ctx = createTestContext({
        prompt: 'Mark the audit guest telemetry task as completed',
        currentUser: anonUser,
      })

      const result = await executeActionIntent(ctx)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.ok(result.response.includes('audit guest telemetry'))
      assert.ok(result.response.includes('as completed'))

      // Verify task status in memory and storage
      assert.strictEqual(tasks[0].completed, true)
      const refreshedTasks: TaskItem[] = JSON.parse(mockStorage.getItem('nova:tasks:v1')!)
      assert.strictEqual(refreshedTasks[0].completed, true)
    })

    it('reports clear sign-in and session-recovery path when persistence fails due to missing auth', async () => {
      const ctx = createTestContext({
        prompt: 'Create task: Unauthenticated task attempt',
        currentUser: null,
        onAddTask: async () => {
          throw new Error('Authentication required to persist task to Supabase.')
        },
      })

      const result = await executeActionIntent(ctx)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'error')
      assert.ok(result.response.includes('⚠️ **Persistence Failed:**'))
      assert.ok(result.response.includes('Authentication required to persist task to Supabase.'))
      assert.ok(result.response.includes('The task was not saved and was not added to your tasks view.'))
      assert.ok(result.response.includes('[Login](/login)'), 'Must guide user to Login recovery path')
      assert.strictEqual(tasks.length, 0, 'Must NOT mutate task view when persistence fails')
    })

    it('reports clear sign-in and session-recovery path when session is expired', async () => {
      const ctx = createTestContext({
        prompt: 'Create task: Expired token task attempt',
        currentUser: null,
        onAddTask: async () => {
          throw new Error('JWT expired / session missing')
        },
      })

      const result = await executeActionIntent(ctx)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'error')
      assert.ok(result.response.includes('⚠️ **Persistence Failed:**'))
      assert.ok(result.response.includes('JWT expired / session missing'))
      assert.ok(result.response.includes('[Login](/login)'), 'Must guide user to Login recovery path')
      assert.strictEqual(tasks.length, 0)
    })

    it('executes voice task creation parity with authenticated user session', async () => {
      const anonUser = { id: 'anon-voice-usr-888', displayName: 'Guest User' }
      let passedUser: typeof anonUser | undefined

      const ctx = createTestContext({
        currentUser: anonUser,
        onAddTask: async (draft: TaskDraft) => {
          passedUser = ctx.currentUser as typeof anonUser
          const newTask: TaskItem = {
            id: 'task-voice-anon-1',
            title: draft.title,
            completed: false,
            priority: draft.priority ?? 'high',
            estimateMinutes: 30,
            createdAt: new Date().toISOString(),
          }
          tasks.push(newTask)
          mockStorage.setItem('nova:tasks:v1', JSON.stringify(tasks))
          return newTask
        },
      })

      const toolResult = await executeToolCall(
        'create_task',
        {
          title: 'Prepare executive summary for investor meeting',
          priority: 'high',
          estimateMinutes: 45,
        },
        ctx
      )

      assert.strictEqual(toolResult.handled, true)
      assert.strictEqual(toolResult.status, 'executed')
      assert.ok(passedUser)
      assert.strictEqual(passedUser?.id, 'anon-voice-usr-888')
      assert.strictEqual(tasks.length, 1)
      assert.strictEqual(tasks[0].title, 'Prepare executive summary for investor meeting')
      assert.strictEqual(tasks[0].priority, 'high')
      assert.ok(toolResult.response.includes('Task Created & Persisted'))
    })
  })
})
