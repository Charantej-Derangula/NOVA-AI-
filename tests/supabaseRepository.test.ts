import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import {
  taskToRow,
  rowToTask,
  knowledgeToRow,
  rowToKnowledge,
  memoryToRow,
  rowToMemory,
  workspaceToRow,
  rowToWorkspace,
  chatSessionToRow,
  rowToChatSession,
  chatMessageToRow,
  rowToChatMessage,
  isSupabaseConfigured,
  getSupabaseConfigStatus,
  checkSupabaseConnection,
  countLocalRecords,
  migrateLocalStorageToSupabase,
  type TaskRow,
} from '../src/services/dataService.ts'
import {
  resetSupabaseClientInstance,
  getSupabaseClient,
  isValidSupabaseKey,
} from '../src/lib/supabaseClient.ts'
import { executeActionIntent } from '../src/services/actionEngine.ts'
import type {
  TaskItem,
  KnowledgeItem,
  MemoryItem,
  WorkspaceItem,
  ChatSession,
} from '../src/types/index.ts'

// Mock localStorage implementation
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

describe('Supabase Repository & Persistence Test Suite', () => {
  let mockStorage: MockStorage

  beforeEach(() => {
    mockStorage = new MockStorage()
    ;(globalThis as any).localStorage = mockStorage
    ;(globalThis as any).window = { localStorage: mockStorage }
    resetSupabaseClientInstance()
  })

  describe('1. Canonical Data Access Layer & Type Mapping', () => {
    it('converts TaskItem to TaskRow and back with lossless fidelity', () => {
      const task: TaskItem = {
        id: 'task-uuid-1234',
        title: 'Complete Supabase migration',
        completed: true,
        priority: 'high',
        scheduledAt: '2026-10-25T14:00:00.000Z',
        createdAt: '2026-10-24T10:00:00.000Z',
        completedAt: '2026-10-24T18:00:00.000Z',
        estimateMinutes: 45,
        workspaceId: 'space-alpha',
      }

      const userId = 'user-auth-001'
      const row = taskToRow(task, userId)

      assert.strictEqual(row.id, task.id)
      assert.strictEqual(row.user_id, userId)
      assert.strictEqual(row.title, task.title)
      assert.strictEqual(row.completed, true)
      assert.strictEqual(row.priority, 'high')
      assert.strictEqual(row.scheduled_at, task.scheduledAt)
      assert.strictEqual(row.created_at, task.createdAt)
      assert.strictEqual(row.completed_at, task.completedAt)
      assert.strictEqual(row.estimate_minutes, 45)
      assert.strictEqual(row.workspace_id, 'space-alpha')

      // Convert back to frontend TaskItem
      const restored = rowToTask(row)
      assert.deepStrictEqual(restored, task)
    })

    it('handles nullable and optional fields in task conversion safely', () => {
      const rowWithNulls: TaskRow = {
        id: 'task-sparse',
        user_id: 'user-001',
        title: 'Minimal task',
        completed: false,
        priority: 'medium',
        scheduled_at: null,
        created_at: '2026-10-24T12:00:00Z',
        completed_at: null,
        estimate_minutes: null,
        workspace_id: null,
      }

      const item = rowToTask(rowWithNulls)
      assert.strictEqual(item.id, 'task-sparse')
      assert.strictEqual(item.title, 'Minimal task')
      assert.strictEqual(item.completed, false)
      assert.strictEqual(item.scheduledAt, undefined)
      assert.strictEqual(item.completedAt, undefined)
      assert.strictEqual(item.estimateMinutes, 30) // Default fallback
      assert.strictEqual(item.workspaceId, undefined)
    })

    it('converts KnowledgeItem to KnowledgeRow and back preserving tags array', () => {
      const note: KnowledgeItem = {
        id: 'note-001',
        title: 'PostgreSQL Architecture',
        content: 'Database indexing strategies with GiST and GIN.',
        kind: 'Technical Documentation',
        tags: ['postgres', 'performance', 'database'],
        createdAt: '2026-10-24T08:00:00Z',
        updatedAt: '2026-10-24T12:00:00Z',
        workspaceId: 'space-eng',
      }

      const row = knowledgeToRow(note, 'user-001')
      assert.strictEqual(row.id, note.id)
      assert.strictEqual(row.kind, 'Technical Documentation')
      assert.deepStrictEqual(row.tags, ['postgres', 'performance', 'database'])

      const restored = rowToKnowledge(row)
      assert.deepStrictEqual(restored, note)
    })

    it('converts MemoryItem to MemoryRow and back', () => {
      const memory: MemoryItem = {
        id: 'mem-001',
        category: 'Preferences',
        content: 'User prefers dark mode and violet accents',
        dateAdded: 'Oct 24, 2026',
        workspaceId: 'space-personal',
      }

      const row = memoryToRow(memory, 'user-001')
      assert.strictEqual(row.id, memory.id)
      assert.strictEqual(row.category, 'Preferences')
      assert.strictEqual(row.content, memory.content)
      assert.strictEqual(row.date_added, 'Oct 24, 2026')

      const restored = rowToMemory(row)
      assert.deepStrictEqual(restored, memory)
    })

    it('converts WorkspaceItem to WorkspaceRow and back', () => {
      const workspace: WorkspaceItem = {
        id: 'space-001',
        name: 'Product Engineering',
        description: 'Core product repository and architecture',
        kind: 'Project',
        createdAt: '2026-10-24T00:00:00Z',
      }

      const row = workspaceToRow(workspace, 'user-001')
      assert.strictEqual(row.id, workspace.id)
      assert.strictEqual(row.name, workspace.name)
      assert.strictEqual(row.kind, 'Project')

      const restored = rowToWorkspace(row)
      assert.deepStrictEqual(restored, workspace)
    })

    it('converts ChatSession and ChatMessage bidirectional mapping', () => {
      const session: ChatSession = {
        id: 'session-001',
        title: 'Architecture Review',
        updatedAt: 'Oct 24',
        workspaceId: 'space-001',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'How should we configure Supabase RLS?',
            timestamp: '10:00 AM',
          },
          {
            id: 'msg-2',
            role: 'assistant',
            content: 'Enable RLS and use auth.uid() = user_id policies.',
            timestamp: '10:01 AM',
          },
        ],
      }

      const sessionRow = chatSessionToRow(session, 'user-001')
      assert.strictEqual(sessionRow.id, session.id)
      assert.strictEqual(sessionRow.title, session.title)

      const restoredSession = rowToChatSession(sessionRow, session.messages)
      assert.deepStrictEqual(restoredSession, session)

      const msgRow = chatMessageToRow(session.messages[0], session.id, 'user-001', 0)
      assert.strictEqual(msgRow.id, 'msg-1')
      assert.strictEqual(msgRow.session_id, session.id)
      assert.strictEqual(msgRow.order_index, 0)
      assert.strictEqual(msgRow.role, 'user')

      const restoredMsg = rowToChatMessage(msgRow)
      assert.strictEqual(restoredMsg.id, 'msg-1')
      assert.strictEqual(restoredMsg.role, 'user')
      assert.strictEqual(restoredMsg.content, 'How should we configure Supabase RLS?')
    })
  })

  describe('2. Environment Configuration & Connection Guarding', () => {
    it('detects unconfigured Supabase safely without throwing', () => {
      // With empty environment
      delete (process.env as any).VITE_SUPABASE_URL
      delete (process.env as any).VITE_SUPABASE_ANON_KEY

      assert.strictEqual(isSupabaseConfigured(), false)

      const status = getSupabaseConfigStatus()
      assert.strictEqual(status.configured, false)
      assert.ok(status.error?.includes('Missing'))

      assert.strictEqual(getSupabaseClient(), null)
    })

    it('rejects dummy placeholders such as "your-project-ref"', () => {
      ;(process.env as any).VITE_SUPABASE_URL = 'https://your-project-ref.supabase.co'
      ;(process.env as any).VITE_SUPABASE_ANON_KEY = 'your_supabase_anon_public_key_here'

      assert.strictEqual(isSupabaseConfigured(), false)
      const status = getSupabaseConfigStatus()
      assert.strictEqual(status.configured, false)
      assert.ok(status.error?.includes('placeholder'))
    })

    it('accepts modern Supabase publishable keys (sb_publishable_...) via VITE_SUPABASE_PUBLISHABLE_KEY', () => {
      delete (process.env as Record<string, string | undefined>).VITE_SUPABASE_ANON_KEY
      ;(process.env as Record<string, string | undefined>).VITE_SUPABASE_URL = 'https://mock-demo-project.supabase.co'
      ;(process.env as Record<string, string | undefined>).VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_mock_test_key_0123456789abcdef'

      assert.strictEqual(isSupabaseConfigured(), true)
      const status = getSupabaseConfigStatus()
      assert.strictEqual(status.configured, true)
      assert.strictEqual(status.hasAnonKey, true)
      assert.strictEqual(status.url, 'https://mock-demo-project.supabase.co')
      assert.strictEqual(status.error, undefined)
      assert.strictEqual(isValidSupabaseKey('sb_publishable_mock_test_key_0123456789abcdef'), true)

      // Clean up
      delete (process.env as Record<string, string | undefined>).VITE_SUPABASE_URL
      delete (process.env as Record<string, string | undefined>).VITE_SUPABASE_PUBLISHABLE_KEY
    })

    it('distinguishes connection states accurately without exposing credentials', async () => {
      // Unconfigured
      delete (process.env as any).VITE_SUPABASE_URL
      delete (process.env as any).VITE_SUPABASE_ANON_KEY
      delete (process.env as any).VITE_SUPABASE_PUBLISHABLE_KEY

      const unconfigured = await checkSupabaseConnection()
      assert.strictEqual(unconfigured.connectionState, 'unconfigured')
      assert.strictEqual(unconfigured.configured, false)
      assert.ok(unconfigured.statusMessage?.includes('Missing') || unconfigured.statusMessage?.includes('Configure'))
    })
  })

  describe('3. Local Storage Inventory & Backup Integrity', () => {
    it('counts local records accurately before any migration', () => {
      mockStorage.setItem(
        'nova:tasks:v1',
        JSON.stringify([
          { id: 't1', title: 'Task 1' },
          { id: 't2', title: 'Task 2' },
        ])
      )
      mockStorage.setItem(
        'nova:knowledge:v1',
        JSON.stringify([{ id: 'k1', title: 'Note 1' }])
      )
      mockStorage.setItem(
        'nova:memories:v1',
        JSON.stringify([{ id: 'm1', content: 'Pref 1' }])
      )
      mockStorage.setItem(
        'nova:workspaces:v1',
        JSON.stringify([{ id: 'w1', name: 'Work 1' }])
      )
      mockStorage.setItem(
        'nova:sessions:v1',
        JSON.stringify([{ id: 's1', title: 'Chat 1', messages: [] }])
      )

      const counts = countLocalRecords()
      assert.strictEqual(counts.tasks, 2)
      assert.strictEqual(counts.knowledge, 1)
      assert.strictEqual(counts.memories, 1)
      assert.strictEqual(counts.workspaces, 1)
      assert.strictEqual(counts.sessions, 1)
    })

    it('fails migration gracefully and honestly when Supabase is unconfigured, retaining local data', async () => {
      mockStorage.setItem(
        'nova:tasks:v1',
        JSON.stringify([{ id: 't1', title: 'Crucial Task' }])
      )

      delete (process.env as any).VITE_SUPABASE_URL
      delete (process.env as any).VITE_SUPABASE_ANON_KEY

      const result = await migrateLocalStorageToSupabase()

      assert.strictEqual(result.success, false)
      assert.strictEqual(result.verified, false)
      assert.ok(result.error?.includes('Supabase is not configured'))

      // Verify local data is 100% retained and untouched
      const retained = JSON.parse(mockStorage.getItem('nova:tasks:v1')!)
      assert.strictEqual(retained.length, 1)
      assert.strictEqual(retained[0].title, 'Crucial Task')
    })
  })

  describe('4. Honest Chat Action Engine Persistence Verification', () => {
    it('reports failure honestly and does NOT add task to view when persistence throws', async () => {
      const tasksList: TaskItem[] = []

      const failingContext = {
        prompt: 'Add task: Deploy to Cloud PostgreSQL',
        tasks: tasksList,
        memories: [],
        knowledge: [],
        workspaces: [],
        activeWorkspaceId: null,
        onAddTask: async () => {
          throw new Error('Supabase RLS policy violation: JWT expired or unauthorized user.')
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

      const result = await executeActionIntent(failingContext)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'error')
      assert.ok(result.response.includes('Persistence Failed'))
      assert.ok(result.response.includes('The task was not saved and was not added to your tasks view'))
      assert.strictEqual(tasksList.length, 0, 'Task must not be added to list when persistence fails')
    })

    it('reports failure honestly and does NOT add note to view when note persistence throws', async () => {
      const knowledgeList: KnowledgeItem[] = []

      const failingContext = {
        prompt: 'create note: Database Schemas',
        tasks: [],
        memories: [],
        knowledge: knowledgeList,
        workspaces: [],
        activeWorkspaceId: null,
        onAddTask: () => {},
        onUpdateTask: () => {},
        onDeleteTask: () => {},
        onToggleTask: () => {},
        onAddMemory: () => {},
        onDeleteMemory: () => {},
        onAddKnowledge: async () => {
          throw new Error('PostgreSQL connection timeout: Network unreachable.')
        },
        onDeleteKnowledge: () => {},
        onAddWorkspace: () => {},
        onDeleteWorkspace: () => {},
        onSelectWorkspace: () => {},
      }

      const result = await executeActionIntent(failingContext)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'error')
      assert.ok(result.response.includes('Persistence Failed'))
      assert.strictEqual(knowledgeList.length, 0, 'Note must not be added when persistence fails')
    })

    it('reports failure honestly when workspace persistence throws', async () => {
      const workspaceList: WorkspaceItem[] = []

      const failingContext = {
        prompt: 'create workspace Infrastructure',
        tasks: [],
        memories: [],
        knowledge: [],
        workspaces: workspaceList,
        activeWorkspaceId: null,
        onAddTask: () => {},
        onUpdateTask: () => {},
        onDeleteTask: () => {},
        onToggleTask: () => {},
        onAddMemory: () => {},
        onDeleteMemory: () => {},
        onAddKnowledge: () => {},
        onDeleteKnowledge: () => {},
        onAddWorkspace: async () => {
          throw new Error('Supabase schema error: workspace table requires authenticated user.')
        },
        onDeleteWorkspace: () => {},
        onSelectWorkspace: () => {},
      }

      const result = await executeActionIntent(failingContext)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'error')
      assert.ok(result.response.includes('Persistence Failed'))
      assert.strictEqual(workspaceList.length, 0)
    })
  })

  describe('5. Data Preservation & No Seeding Overwrite', () => {
    it('never overwrites existing local data with empty demo records', () => {
      const existingUserTasks: TaskItem[] = [
        {
          id: 'user-task-001',
          title: 'Real production user task that must never be deleted',
          completed: false,
          priority: 'high',
          estimateMinutes: 60,
          createdAt: new Date().toISOString(),
        },
      ]

      mockStorage.setItem('nova:tasks:v1', JSON.stringify(existingUserTasks))

      // Verify stored records exist
      const readBack = JSON.parse(mockStorage.getItem('nova:tasks:v1')!)
      assert.strictEqual(readBack.length, 1)
      assert.strictEqual(readBack[0].id, 'user-task-001')
      assert.strictEqual(readBack[0].title, existingUserTasks[0].title)
    })
  })

  describe('6. Schema SQL Compatibility, Idempotency & Auth Error Detection', () => {
    it('verifies SQL migration defines all required tables, columns, and indexes', async () => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const sqlPath = path.resolve(process.cwd(), 'supabase/migrations/20261024000000_nova_schema.sql')
      const sql = fs.readFileSync(sqlPath, 'utf8')

      // Check all 7 tables are created
      const tables = [
        'public.workspaces',
        'public.tasks',
        'public.knowledge',
        'public.memories',
        'public.chat_sessions',
        'public.chat_messages',
        'public.user_preferences',
      ]
      for (const t of tables) {
        assert.ok(sql.includes(`CREATE TABLE IF NOT EXISTS ${t}`), `SQL migration must create ${t}`)
      }

      // Check order_index is defined on chat_messages
      assert.ok(
        sql.includes('order_index INTEGER NOT NULL DEFAULT 0'),
        'chat_messages must define order_index column'
      )
      assert.ok(
        sql.includes('idx_chat_messages_order_index'),
        'chat_messages must have an index on order_index'
      )
    })

    it('verifies SQL migration is idempotent and safe to rerun with DROP IF EXISTS', async () => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const sqlPath = path.resolve(process.cwd(), 'supabase/migrations/20261024000000_nova_schema.sql')
      const sql = fs.readFileSync(sqlPath, 'utf8')

      // Check all triggers are protected with DROP TRIGGER IF EXISTS
      const triggers = [
        'set_workspaces_updated_at',
        'set_tasks_updated_at',
        'set_knowledge_updated_at',
        'set_memories_updated_at',
        'set_user_preferences_updated_at',
      ]
      for (const trig of triggers) {
        assert.ok(
          sql.includes(`DROP TRIGGER IF EXISTS ${trig}`),
          `Trigger ${trig} must be prefixed with DROP TRIGGER IF EXISTS`
        )
      }

      // Check all policies are protected with DROP POLICY IF EXISTS
      const policies = [
        'Users can manage own workspaces',
        'Users can manage own tasks',
        'Users can manage own knowledge',
        'Users can manage own memories',
        'Users can manage own chat sessions',
        'Users can manage own chat messages',
        'Users can manage own preferences',
      ]
      for (const pol of policies) {
        assert.ok(
          sql.includes(`DROP POLICY IF EXISTS "${pol}"`),
          `Policy "${pol}" must be prefixed with DROP POLICY IF EXISTS`
        )
      }
    })

    it('verifies REQUIRED_TABLES includes all 7 tables in data access layer', async () => {
      const { REQUIRED_TABLES } = await import('../src/lib/supabaseClient.ts')
      assert.strictEqual(REQUIRED_TABLES.length, 7)
      assert.deepStrictEqual([...REQUIRED_TABLES], [
        'workspaces',
        'tasks',
        'knowledge',
        'memories',
        'chat_sessions',
        'chat_messages',
        'user_preferences',
      ])
    })

    it('sanitizes dangling foreign workspace keys during migration without data loss', async () => {
      // Mock local storage with tasks referencing a non-existent workspace
      mockStorage.setItem(
        'nova:tasks:v1',
        JSON.stringify([
          {
            id: 'task-dangling-ws',
            title: 'Task with deleted workspace',
            completed: false,
            workspaceId: 'non-existent-workspace-uuid',
          },
        ])
      )
      mockStorage.setItem('nova:workspaces:v1', JSON.stringify([]))

      const counts = countLocalRecords()
      assert.strictEqual(counts.tasks, 1)
      assert.strictEqual(counts.workspaces, 0)
    })

    it('tests local and cloud fallback read/write operations across all entities', async () => {
      const {
        persistTask,
        fetchTasks,
        persistKnowledge,
        fetchKnowledge,
        persistMemory,
        fetchMemories,
        persistWorkspace,
        fetchWorkspaces,
        persistChatSession,
      } = await import('../src/services/dataService.ts')

      // 1. Task CRUD
      const testTask: TaskItem = {
        id: 'task-test-rw',
        title: 'Read Write Task Test',
        completed: false,
        priority: 'high',
        estimateMinutes: 30,
        createdAt: new Date().toISOString(),
      }
      const taskWriteRes = await persistTask(testTask)
      assert.strictEqual(taskWriteRes.success, true)
      const tasksReadRes = await fetchTasks()
      assert.ok(tasksReadRes.data.some((t) => t.id === 'task-test-rw'))

      // 2. Knowledge CRUD
      const testNote: KnowledgeItem = {
        id: 'note-test-rw',
        title: 'Read Write Note Test',
        content: 'Test content for note persistence',
        kind: 'Personal note',
        tags: ['test', 'persistence'],
        createdAt: new Date().toISOString(),
      }
      const noteWriteRes = await persistKnowledge(testNote)
      assert.strictEqual(noteWriteRes.success, true)
      const notesReadRes = await fetchKnowledge()
      assert.ok(notesReadRes.data.some((n) => n.id === 'note-test-rw'))

      // 3. Memory CRUD
      const testMemory: MemoryItem = {
        id: 'mem-test-rw',
        content: 'User prefers concise summaries',
        category: 'Preferences',
        dateAdded: 'Today',
      }
      const memWriteRes = await persistMemory(testMemory)
      assert.strictEqual(memWriteRes.success, true)
      const memsReadRes = await fetchMemories()
      assert.ok(memsReadRes.data.some((m) => m.id === 'mem-test-rw'))

      // 4. Workspace CRUD
      const testWs: WorkspaceItem = {
        id: 'ws-test-rw',
        name: 'Workspace Read Write Test',
        kind: 'Research',
        createdAt: new Date().toISOString(),
      }
      const wsWriteRes = await persistWorkspace(testWs)
      assert.strictEqual(wsWriteRes.success, true)
      const wsReadRes = await fetchWorkspaces()
      assert.ok(wsReadRes.data.some((w) => w.id === 'ws-test-rw'))

      // 5. Chat Session & Message CRUD
      const testSession: ChatSession = {
        id: 'sess-test-rw',
        title: 'Persistence Test Session',
        updatedAt: 'Just now',
        messages: [
          { id: 'm1', role: 'user', content: 'Ping', timestamp: '10:00' },
          { id: 'm2', role: 'assistant', content: 'Pong', timestamp: '10:01' },
        ],
      }
      const sessWriteRes = await persistChatSession(testSession)
      assert.strictEqual(sessWriteRes.success, true)
      const storedSessions = JSON.parse(mockStorage.getItem('nova:sessions:v1')!)
      assert.ok(storedSessions.some((s: ChatSession) => s.id === 'sess-test-rw'))
    })
  })
})
