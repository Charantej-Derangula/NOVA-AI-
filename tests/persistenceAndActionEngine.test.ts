import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import {
  executeActionIntent,
  resolveSchedule,
} from '../src/services/actionEngine.ts'
import {
  restoreStorageBackup,
  readStoredValue,
  createStorageSnapshot,
} from '../src/hooks/useLocalStorageState.ts'
import type {
  TaskItem,
  MemoryItem,
  KnowledgeItem,
  WorkspaceItem,
} from '../src/types/index.ts'
import {
  isOnLocalDate,
} from '../src/utils/dateTime.ts'

// In-memory mock storage implementing Web Storage API
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

  get length(): number {
    return this.store.size
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
}

describe('Data Integrity, Action Engine & Persistence Tests', () => {
  let mockStorage: MockStorage
  let tasks: TaskItem[]
  let memories: MemoryItem[]
  let knowledge: KnowledgeItem[]
  let workspaces: WorkspaceItem[]
  let activeWorkspaceId: string | null

  beforeEach(() => {
    mockStorage = new MockStorage()
    // Polyfill global localStorage and window for the test scope
    ;(globalThis as unknown as { localStorage: MockStorage }).localStorage = mockStorage
    ;(globalThis as unknown as { window: { localStorage: MockStorage } }).window = { localStorage: mockStorage }

    tasks = []
    memories = []
    knowledge = []
    workspaces = []
    activeWorkspaceId = null
  })

  describe('1. Task CRUD via Action Engine', () => {
    it('creates a task with real ID and schedules it in local timezone', async () => {
      const prompt = 'Add a task to submit quarterly report tomorrow at 3pm high priority'
      const context = {
        prompt,
        tasks,
        memories,
        knowledge,
        workspaces,
        activeWorkspaceId,
        onAddTask: (draft: any) => {
          const newTask: TaskItem = {
            id: `task-${Date.now()}`,
            title: draft.title,
            completed: false,
            priority: draft.priority,
            scheduledAt: draft.scheduledAt,
            estimateMinutes: draft.estimateMinutes,
            createdAt: new Date().toISOString(),
          }
          tasks.push(newTask)
          mockStorage.setItem('nova:tasks:v1', JSON.stringify(tasks))
          return newTask
        },
        onUpdateTask: (id: string, updates: any) => {
          tasks = tasks.map((t) => (t.id === id ? { ...t, ...updates } : t))
        },
        onDeleteTask: (id: string) => {
          tasks = tasks.filter((t) => t.id !== id)
        },
        onToggleTask: (id: string) => {
          tasks = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
        },
        onAddMemory: () => {},
        onDeleteMemory: () => {},
        onAddKnowledge: () => {},
        onDeleteKnowledge: () => {},
        onAddWorkspace: () => {},
        onDeleteWorkspace: () => {},
        onSelectWorkspace: () => {},
      }

      const result = await executeActionIntent(context)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.entityType, 'task')
      assert.strictEqual(result.verb, 'create')
      assert.ok(result.recordId?.startsWith('task-'))
      assert.strictEqual(tasks.length, 1)
      assert.strictEqual(tasks[0].title, 'submit quarterly report')
      assert.strictEqual(tasks[0].priority, 'high')
      assert.ok(tasks[0].scheduledAt, 'Task should have a scheduledAt timestamp')

      // Check persistence in localStorage
      const stored = JSON.parse(mockStorage.getItem('nova:tasks:v1')!)
      assert.strictEqual(stored.length, 1)
      assert.strictEqual(stored[0].id, tasks[0].id)
    })

    it('prevents duplicates when the same task is retried with identical title', async () => {
      const existingTask: TaskItem = {
        id: 'task-existing-1',
        title: 'Call investor',
        completed: false,
        priority: 'high',
        createdAt: new Date().toISOString(),
        estimateMinutes: 30,
      }
      tasks.push(existingTask)

      const context = {
        prompt: 'add task Call investor',
        tasks,
        memories,
        knowledge,
        workspaces,
        activeWorkspaceId,
        onAddTask: (draft: any) => {
          const newTask: TaskItem = { id: 'task-dup', ...draft, completed: false, createdAt: new Date().toISOString() }
          tasks.push(newTask)
          return newTask
        },
        onUpdateTask: () => {},
        onDeleteTask: () => {},
        onToggleTask: () => {},
        onAddMemory: () => {},
        onDeleteMemory: () => {},
        onAddKnowledge: () => {},
        onDeleteKnowledge: () => {},
        onAddWorkspace: () => {},
        onDeleteWorkspace: () => {},
        onSelectWorkspace: () => {},
      }

      const result = await executeActionIntent(context)
      assert.strictEqual(result.handled, true)
      assert.ok(result.response.includes('Task Already Exists'))
      assert.strictEqual(tasks.length, 1, 'Duplicate task must not be inserted')
    })

    it('lists tasks truthfully from canonical store', async () => {
      tasks.push(
        { id: 'task-1', title: 'Buy groceries', completed: false, priority: 'medium', estimateMinutes: 20, createdAt: new Date().toISOString() },
        { id: 'task-2', title: 'Review pull request', completed: true, priority: 'high', estimateMinutes: 45, createdAt: new Date().toISOString() }
      )

      const context = {
        prompt: 'show my tasks',
        tasks,
        memories,
        knowledge,
        workspaces,
        activeWorkspaceId,
        onAddTask: () => {},
        onUpdateTask: () => {},
        onDeleteTask: () => {},
        onToggleTask: () => {},
        onAddMemory: () => {},
        onDeleteMemory: () => {},
        onAddKnowledge: () => {},
        onDeleteKnowledge: () => {},
        onAddWorkspace: () => {},
        onDeleteWorkspace: () => {},
        onSelectWorkspace: () => {},
      }

      const result = await executeActionIntent(context)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'queried')
      assert.ok(result.response.includes('Buy groceries'))
      assert.ok(result.response.includes('Review pull request'))
      assert.ok(result.response.includes('task-1'))
    })

    it('requires explicit confirmation before deleting all tasks', async () => {
      tasks.push(
        { id: 't1', title: 'Task 1', completed: false, priority: 'low', estimateMinutes: 10, createdAt: new Date().toISOString() },
        { id: 't2', title: 'Task 2', completed: false, priority: 'medium', estimateMinutes: 15, createdAt: new Date().toISOString() }
      )

      let deletedAll = false
      const context = {
        prompt: 'delete all tasks',
        tasks,
        memories,
        knowledge,
        workspaces,
        activeWorkspaceId,
        onAddTask: () => {},
        onUpdateTask: () => {},
        onDeleteTask: () => {},
        onToggleTask: () => {},
        onDeleteAllTasks: () => { deletedAll = true; tasks = [] },
        onAddMemory: () => {},
        onDeleteMemory: () => {},
        onAddKnowledge: () => {},
        onDeleteKnowledge: () => {},
        onAddWorkspace: () => {},
        onDeleteWorkspace: () => {},
        onSelectWorkspace: () => {},
      }

      // First attempt: must prompt for confirmation and NOT delete
      const result1 = await executeActionIntent(context)
      assert.strictEqual(result1.handled, true)
      assert.strictEqual(result1.status, 'needs_confirmation')
      assert.ok(result1.response.includes('Confirmation Required'))
      assert.strictEqual(deletedAll, false)
      assert.strictEqual(tasks.length, 2)

      // Second attempt: user confirms explicitly
      const result2 = await executeActionIntent({
        ...context,
        prompt: 'Confirm delete all tasks',
      })
      assert.strictEqual(result2.handled, true)
      assert.strictEqual(result2.status, 'executed')
      assert.strictEqual(deletedAll, true)
      assert.strictEqual(tasks.length, 0)
    })

    it('reports truthful error when task to delete does not exist', async () => {
      const context = {
        prompt: 'delete task non-existent flight ticket',
        tasks,
        memories,
        knowledge,
        workspaces,
        activeWorkspaceId,
        onAddTask: () => {},
        onUpdateTask: () => {},
        onDeleteTask: () => {},
        onToggleTask: () => {},
        onAddMemory: () => {},
        onDeleteMemory: () => {},
        onAddKnowledge: () => {},
        onDeleteKnowledge: () => {},
        onAddWorkspace: () => {},
        onDeleteWorkspace: () => {},
        onSelectWorkspace: () => {},
      }

      const result = await executeActionIntent(context)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'error')
      assert.ok(result.response.includes('Could not find a task'))
    })
  })

  describe('2. Knowledge & Notes CRUD via Action Engine', () => {
    it('creates a note with title, content and tags in the canonical store', async () => {
      const prompt = 'create a note about Deployment Guide: Run npm run build and check dist folder'
      const context = {
        prompt,
        tasks,
        memories,
        knowledge,
        workspaces,
        activeWorkspaceId,
        onAddTask: () => {},
        onUpdateTask: () => {},
        onDeleteTask: () => {},
        onToggleTask: () => {},
        onAddMemory: () => {},
        onDeleteMemory: () => {},
        onAddKnowledge: (draft: any) => {
          const note: KnowledgeItem = {
            id: `note-${Date.now()}`,
            ...draft,
            createdAt: new Date().toISOString(),
          }
          knowledge.push(note)
          mockStorage.setItem('nova:knowledge:v1', JSON.stringify(knowledge))
          return note
        },
        onDeleteKnowledge: (id: string) => {
          knowledge = knowledge.filter((n) => n.id !== id)
        },
        onAddWorkspace: () => {},
        onDeleteWorkspace: () => {},
        onSelectWorkspace: () => {},
      }

      const result = await executeActionIntent(context)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.entityType, 'knowledge')
      assert.strictEqual(result.verb, 'create')
      assert.strictEqual(knowledge.length, 1)
      assert.strictEqual(knowledge[0].title, 'Deployment Guide')
      assert.ok(knowledge[0].content.includes('Run npm run build'))

      const stored = JSON.parse(mockStorage.getItem('nova:knowledge:v1')!)
      assert.strictEqual(stored.length, 1)
      assert.strictEqual(stored[0].title, 'Deployment Guide')
    })

    it('lists existing notes truthfully from the store', async () => {
      knowledge.push({
        id: 'note-1',
        title: 'Project Architecture',
        content: 'Vite + React 19 + TypeScript',
        kind: 'Project notes',
        tags: ['arch'],
        createdAt: new Date().toISOString(),
      })

      const context = {
        prompt: 'list my notes',
        tasks,
        memories,
        knowledge,
        workspaces,
        activeWorkspaceId,
        onAddTask: () => {},
        onUpdateTask: () => {},
        onDeleteTask: () => {},
        onToggleTask: () => {},
        onAddMemory: () => {},
        onDeleteMemory: () => {},
        onAddKnowledge: () => {},
        onDeleteKnowledge: () => {},
        onAddWorkspace: () => {},
        onDeleteWorkspace: () => {},
        onSelectWorkspace: () => {},
      }

      const result = await executeActionIntent(context)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'queried')
      assert.ok(result.response.includes('Project Architecture'))
      assert.ok(result.response.includes('Vite + React 19'))
    })
  })

  describe('3. Memory & Workspace CRUD via Action Engine', () => {
    it('creates a memory item in canonical storage', async () => {
      const prompt = 'remember that user preferred timezone is Asia/Kolkata'
      const context = {
        prompt,
        tasks,
        memories,
        knowledge,
        workspaces,
        activeWorkspaceId,
        onAddTask: () => {},
        onUpdateTask: () => {},
        onDeleteTask: () => {},
        onToggleTask: () => {},
        onAddMemory: (category: string, content: string) => {
          const mem: MemoryItem = {
            id: `mem-${Date.now()}`,
            category,
            content,
            dateAdded: 'Today',
          }
          memories.push(mem)
          mockStorage.setItem('nova:memories:v1', JSON.stringify(memories))
          return mem
        },
        onDeleteMemory: (id: string) => {
          memories = memories.filter((m) => m.id !== id)
        },
        onAddKnowledge: () => {},
        onDeleteKnowledge: () => {},
        onAddWorkspace: () => {},
        onDeleteWorkspace: () => {},
        onSelectWorkspace: () => {},
      }

      const result = await executeActionIntent(context)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.entityType, 'memory')
      assert.strictEqual(memories.length, 1)
      assert.ok(memories[0].content.includes('preferred timezone is Asia/Kolkata'))
    })

    it('creates and switches workspaces accurately', async () => {
      let activeWs: string | null = null
      const context = {
        prompt: 'create workspace Alpha Project',
        tasks,
        memories,
        knowledge,
        workspaces,
        activeWorkspaceId: activeWs,
        onAddTask: () => {},
        onUpdateTask: () => {},
        onDeleteTask: () => {},
        onToggleTask: () => {},
        onAddMemory: () => {},
        onDeleteMemory: () => {},
        onAddKnowledge: () => {},
        onDeleteKnowledge: () => {},
        onAddWorkspace: (draft: any) => {
          const ws: WorkspaceItem = {
            id: `space-${Date.now()}`,
            ...draft,
            createdAt: new Date().toISOString(),
          }
          workspaces.push(ws)
          activeWs = ws.id
          return ws.id
        },
        onDeleteWorkspace: () => {},
        onSelectWorkspace: (id: string | null) => { activeWs = id },
      }

      const result = await executeActionIntent(context)
      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(workspaces.length, 1)
      assert.strictEqual(workspaces[0].name, 'Alpha Project')
      assert.strictEqual(activeWs, workspaces[0].id)
    })
  })

  describe('4. Backup & Restore Data Integrity', () => {
    it('restores backup JSON into canonical storage keys without data loss', () => {
      const backupPayload = {
        product: 'NOVA',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        tasks: [
          { id: 't-101', title: 'Migrate DB', completed: false, priority: 'high', estimateMinutes: 60, createdAt: new Date().toISOString() },
        ],
        memories: [
          { id: 'm-201', category: 'Preferences', content: 'Dark mode preferred', dateAdded: 'Today' },
        ],
        knowledge: [
          { id: 'k-301', title: 'Tech Stack', content: 'React, Vite, Groq', kind: 'Reference', tags: ['stack'], createdAt: new Date().toISOString() },
        ],
        workspaces: [
          { id: 'w-401', name: 'DevOps', description: 'Infra and CI/CD', kind: 'Engineering', createdAt: new Date().toISOString() },
        ],
        sessions: [
          { id: 's-501', title: 'Initial Chat', updatedAt: 'Today', messages: [] },
        ],
      }

      const restoreResult = restoreStorageBackup(JSON.stringify(backupPayload))
      assert.strictEqual(restoreResult.success, true)
      assert.strictEqual(restoreResult.counts.tasks, 1)
      assert.strictEqual(restoreResult.counts.memories, 1)
      assert.strictEqual(restoreResult.counts.knowledge, 1)
      assert.strictEqual(restoreResult.counts.workspaces, 1)
      assert.strictEqual(restoreResult.counts.sessions, 1)

      const storedTasks = JSON.parse(mockStorage.getItem('nova:tasks:v1')!)
      assert.strictEqual(storedTasks[0].title, 'Migrate DB')
      const storedWorkspaces = JSON.parse(mockStorage.getItem('nova:workspaces:v1')!)
      assert.strictEqual(storedWorkspaces[0].name, 'DevOps')
    })

    it('gracefully rejects corrupted or invalid backup JSON with honest error', () => {
      const corruptJson = '{"tasks": [corrupt-not-valid-json'
      const result = restoreStorageBackup(corruptJson)
      assert.strictEqual(result.success, false)
      assert.ok(result.error !== undefined)
    })
  })

  describe('5. Date & Time Correctness', () => {
    it('correctly resolves relative date "tomorrow at 6pm" in local timezone', () => {
      const ref = new Date(2026, 9, 24, 10, 0, 0) // Oct 24, 2026 10:00 AM local
      const res = resolveSchedule('Review proposal tomorrow at 6 PM', ref)
      assert.ok(res.scheduledAt)
      const parsed = new Date(res.scheduledAt)
      assert.strictEqual(parsed.getDate(), 25)
      assert.strictEqual(parsed.getHours(), 18)
      assert.strictEqual(parsed.getMinutes(), 0)
    })

    it('correctly resolves relative date "today" as date-only calendar string', () => {
      const ref = new Date(2026, 9, 24, 15, 0, 0)
      const res = resolveSchedule('Buy groceries today', ref)
      assert.strictEqual(res.scheduledAt, '2026-10-24')
      assert.strictEqual(isOnLocalDate(res.scheduledAt, ref), true)
    })
  })

  describe('6. Legacy Migration & Corruption Recovery', () => {
    it('automatically recovers legacy tasks from nova:tasks when canonical key is missing', () => {
      const legacyData = [{ id: 'legacy-1', title: 'Legacy task from prototype', completed: false, priority: 'high', estimateMinutes: 30, createdAt: '2026-10-01' }]
      mockStorage.setItem('nova:tasks', JSON.stringify(legacyData))

      const read = readStoredValue<TaskItem[]>('nova:tasks:v1', [])
      assert.strictEqual(read.length, 1)
      assert.strictEqual(read[0].id, 'legacy-1')

      // Verifies it wrote to canonical key
      const canonical = JSON.parse(mockStorage.getItem('nova:tasks:v1')!)
      assert.strictEqual(canonical.length, 1)
      assert.strictEqual(canonical[0].title, 'Legacy task from prototype')

      // Verifies it did NOT destroy the legacy key
      assert.ok(mockStorage.getItem('nova:tasks') !== null)
    })

    it('recovers legacy tasks even if canonical key was initialized with an empty array', () => {
      mockStorage.setItem('nova:tasks:v1', '[]')
      const legacyData = [{ id: 'legacy-2', title: 'Task to rescue', completed: false, priority: 'medium', estimateMinutes: 15, createdAt: '2026-10-02' }]
      mockStorage.setItem('tasks', JSON.stringify(legacyData))

      const read = readStoredValue<TaskItem[]>('nova:tasks:v1', [])
      assert.strictEqual(read.length, 1)
      assert.strictEqual(read[0].id, 'legacy-2')
    })

    it('safely backs up corrupt JSON rather than permanently deleting or overwriting it', () => {
      const corruptRaw = '{invalid-json: tasks...'
      mockStorage.setItem('nova:tasks:v1', corruptRaw)

      const fallback: TaskItem[] = []
      const read = readStoredValue<TaskItem[]>('nova:tasks:v1', fallback)
      assert.strictEqual(read.length, 0)

      // Find created backup key
      let backupKeyFound = false
      for (let i = 0; i < mockStorage.length; i++) {
        const k = mockStorage.key(i)
        if (k && k.startsWith('nova:tasks:v1:backup-corrupt-')) {
          backupKeyFound = true
          assert.strictEqual(mockStorage.getItem(k), corruptRaw)
        }
      }
      assert.strictEqual(backupKeyFound, true, 'Corrupt backup key must be preserved')
    })

    it('preserves active tab navigation state across reloads', () => {
      mockStorage.setItem('nova:active-tab:v1', JSON.stringify('tasks'))
      const restoredTab = readStoredValue('nova:active-tab:v1', 'chat')
      assert.strictEqual(restoredTab, 'tasks')
    })

    it('creates redundant storage snapshot with current timestamp', () => {
      mockStorage.setItem('nova:tasks:v1', JSON.stringify([{ id: 'snap-task', title: 'Snap task' }]))
      createStorageSnapshot()
      const rawSnapshot = mockStorage.getItem('nova:snapshot:latest')
      assert.ok(rawSnapshot !== null)
      const parsed = JSON.parse(rawSnapshot)
      assert.strictEqual(parsed.product, 'NOVA')
      assert.ok(Array.isArray(parsed['nova:tasks:v1']))
      assert.strictEqual(parsed['nova:tasks:v1'][0].id, 'snap-task')
    })
  })
})
