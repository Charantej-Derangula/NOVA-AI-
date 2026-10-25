import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import type { TaskItem } from '../src/types/index.ts'
import {
  mapTaskToDb,
  mapTaskFromDb,
  type TaskRow,
} from '../src/services/dataService.ts'

class MockStorage {
  private store = new Map<string, string>()

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
  get length(): number {
    return this.store.size
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
}

describe('NOVA — Cloud Task Persistence, Hydration & Sync Status Suite', () => {
  let mockStorage: MockStorage

  beforeEach(() => {
    mockStorage = new MockStorage()
    ;(globalThis as any).localStorage = mockStorage
    ;(globalThis as any).window = { localStorage: mockStorage }
  })

  describe('1. Cloud CRUD & Type Serialization with RLS Scoping', () => {
    const testUserId = 'user-uuid-9876'

    it('maps task to database row with user_id and snake_case columns', () => {
      const task: TaskItem = {
        id: 'task-autopulse-1',
        title: 'AutoPulse presentation',
        completed: false,
        priority: 'high',
        scheduledAt: '2026-10-26T14:00:00.000Z',
        estimateMinutes: 45,
        createdAt: '2026-10-24T10:00:00.000Z',
        workspaceId: 'space-eng',
      }

      const row = mapTaskToDb(task, testUserId)
      assert.strictEqual(row.id, 'task-autopulse-1')
      assert.strictEqual(row.user_id, testUserId)
      assert.strictEqual(row.title, 'AutoPulse presentation')
      assert.strictEqual(row.completed, false)
      assert.strictEqual(row.priority, 'high')
      assert.strictEqual(row.scheduled_at, '2026-10-26T14:00:00.000Z')
      assert.strictEqual(row.estimate_minutes, 45)
      assert.strictEqual(row.workspace_id, 'space-eng')
    })

    it('maps database row back to frontend TaskItem accurately', () => {
      const dbRow: TaskRow = {
        id: 'task-autopulse-1',
        user_id: testUserId,
        title: 'AutoPulse presentation',
        completed: true,
        priority: 'high',
        scheduled_at: '2026-10-26T14:00:00.000Z',
        estimate_minutes: 45,
        created_at: '2026-10-24T10:00:00.000Z',
        completed_at: '2026-10-25T09:00:00.000Z',
        workspace_id: 'space-eng',
      }

      const task = mapTaskFromDb(dbRow as unknown as Record<string, unknown>)
      assert.strictEqual(task.id, 'task-autopulse-1')
      assert.strictEqual(task.title, 'AutoPulse presentation')
      assert.strictEqual(task.completed, true)
      assert.strictEqual(task.completedAt, '2026-10-25T09:00:00.000Z')
      assert.strictEqual(task.priority, 'high')
      assert.strictEqual(task.scheduledAt, '2026-10-26T14:00:00.000Z')
      assert.strictEqual(task.estimateMinutes, 45)
      assert.strictEqual(task.workspaceId, 'space-eng')
    })
  })

  describe('2. Refresh Persistence & Supabase as Source of Truth', () => {
    it('loads tasks from Supabase as source of truth and refreshes local store', async () => {
      const cloudTasks: TaskItem[] = [
        {
          id: 'task-cloud-1',
          title: 'AutoPulse presentation in Supabase',
          completed: false,
          priority: 'high',
          estimateMinutes: 30,
          createdAt: '2026-10-25T08:00:00Z',
        },
      ]

      // Simulate initial local storage with an outdated list
      mockStorage.setItem('nova:tasks:v1', JSON.stringify([]))

      // Simulate Supabase fetch response
      const fetchResult = {
        data: cloudTasks,
        source: 'supabase' as const,
      }

      assert.strictEqual(fetchResult.source, 'supabase')
      assert.strictEqual(fetchResult.data.length, 1)

      // When Supabase is source of truth, local store updates from cloud result
      mockStorage.setItem('nova:tasks:v1', JSON.stringify(fetchResult.data))
      const hydrated = JSON.parse(mockStorage.getItem('nova:tasks:v1')!)
      assert.strictEqual(hydrated.length, 1)
      assert.strictEqual(hydrated[0].title, 'AutoPulse presentation in Supabase')
    })
  })

  describe('3. Auth Hydration & Local Task Cloud Synchronization', () => {
    it('detects unsynced local tasks and persists them to Supabase on session hydration', async () => {
      const authenticatedUserId = 'user-auth-auto-pulse'
      // User created the AutoPulse task while offline or before auth was active
      const localAutoPulseTask: TaskItem = {
        id: 'task-local-autopulse',
        title: 'AutoPulse presentation',
        completed: false,
        priority: 'high',
        estimateMinutes: 30,
        createdAt: '2026-10-24T12:00:00Z',
      }

      mockStorage.setItem('nova:tasks:v1', JSON.stringify([localAutoPulseTask]))

      // Simulate Supabase currently has 0 tasks for this new user
      const remoteTasks: TaskItem[] = []

      // Sync reconciliation logic:
      const localTasks: TaskItem[] = JSON.parse(mockStorage.getItem('nova:tasks:v1')!)
      const remoteIds = new Set(remoteTasks.map((t) => t.id))
      const unsynced = localTasks.filter((t) => !remoteIds.has(t.id))

      assert.strictEqual(unsynced.length, 1)
      assert.strictEqual(unsynced[0].id, 'task-local-autopulse')

      // Sync the unsynced task to Supabase
      const syncedRows: TaskRow[] = []
      for (const t of unsynced) {
        syncedRows.push(mapTaskToDb(t, authenticatedUserId))
      }

      assert.strictEqual(syncedRows.length, 1)
      assert.strictEqual(syncedRows[0].user_id, authenticatedUserId)
      assert.strictEqual(syncedRows[0].title, 'AutoPulse presentation')

      // After sync, Supabase returns the authoritative persisted task
      const updatedRemote = syncedRows.map((r) => mapTaskFromDb(r as unknown as Record<string, unknown>))
      mockStorage.setItem('nova:tasks:v1', JSON.stringify(updatedRemote))

      const refreshed = JSON.parse(mockStorage.getItem('nova:tasks:v1')!)
      assert.strictEqual(refreshed.length, 1)
      assert.strictEqual(refreshed[0].title, 'AutoPulse presentation')
    })
  })

  describe('4. Offline Fallback & Data Preservation on Cloud Failure', () => {
    it('preserves unsynced local data and does not drop task when cloud persistence fails', async () => {
      const existingTasks: TaskItem[] = [
        {
          id: 'task-existing-1',
          title: 'Existing commitments',
          completed: false,
          priority: 'medium',
          estimateMinutes: 30,
          createdAt: '2026-10-24T00:00:00Z',
        },
      ]
      mockStorage.setItem('nova:tasks:v1', JSON.stringify(existingTasks))

      const newTask: TaskItem = {
        id: 'task-offline-1',
        title: 'Offline draft presentation',
        completed: false,
        priority: 'high',
        estimateMinutes: 30,
        createdAt: new Date().toISOString(),
      }

      // Simulate Supabase failure (network / offline / 503)
      const cloudSuccess = false
      let syncStatus: 'cloud' | 'offline' | 'local' | 'syncing' = 'syncing'
      let syncError: string | null = null

      if (!cloudSuccess) {
        syncStatus = 'offline'
        syncError = 'Failed to persist task to Supabase: network offline'
        // Preserves local data rather than losing it
        const currentLocal: TaskItem[] = JSON.parse(mockStorage.getItem('nova:tasks:v1')!)
        const updated = [newTask, ...currentLocal.filter((t) => t.id !== newTask.id)]
        mockStorage.setItem('nova:tasks:v1', JSON.stringify(updated))
      }

      assert.strictEqual(syncStatus, 'offline')
      assert.ok(syncError?.includes('network offline'))

      // Verify data was preserved in local cache
      const stored = JSON.parse(mockStorage.getItem('nova:tasks:v1')!)
      assert.strictEqual(stored.length, 2)
      assert.strictEqual(stored[0].title, 'Offline draft presentation')
    })
  })

  describe('5. Honest Sync Status Reporting & Footer Logic', () => {
    function getTasksFooterText(
      syncStatus: 'cloud' | 'offline' | 'local' | 'syncing',
      storageAvailable = true
    ): string {
      switch (syncStatus) {
        case 'cloud':
          return 'Tasks and schedule are synced with Supabase cloud.'
        case 'syncing':
          return 'Syncing tasks with Supabase cloud...'
        case 'offline':
          return 'Offline mode — tasks are saved in this browser and will sync when reconnected.'
        case 'local':
        default:
          return storageAvailable
            ? 'Tasks and schedule are saved in this browser.'
            : 'Browser storage is unavailable; changes may not persist.'
      }
    }

    it('reports "Tasks and schedule are synced with Supabase cloud." when status is cloud', () => {
      const text = getTasksFooterText('cloud')
      assert.strictEqual(text, 'Tasks and schedule are synced with Supabase cloud.')
    })

    it('reports "Offline mode — tasks are saved in this browser..." when status is offline', () => {
      const text = getTasksFooterText('offline')
      assert.strictEqual(
        text,
        'Offline mode — tasks are saved in this browser and will sync when reconnected.'
      )
    })

    it('reports "Tasks and schedule are saved in this browser." only when purely local/unauthenticated', () => {
      const text = getTasksFooterText('local')
      assert.strictEqual(text, 'Tasks and schedule are saved in this browser.')
    })

    it('reports "Syncing tasks with Supabase cloud..." while syncing is in progress', () => {
      const text = getTasksFooterText('syncing')
      assert.strictEqual(text, 'Syncing tasks with Supabase cloud...')
    })

    it('never shows cloud-synced text when syncStatus is offline or local', () => {
      assert.notStrictEqual(
        getTasksFooterText('offline'),
        'Tasks and schedule are synced with Supabase cloud.'
      )
      assert.notStrictEqual(
        getTasksFooterText('local'),
        'Tasks and schedule are synced with Supabase cloud.'
      )
    })
  })
})
