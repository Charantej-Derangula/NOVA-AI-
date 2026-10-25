import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import {
  executeUnifiedAction,
  executeToolCall,
  parseActionPlan,
  parseMultiActionPlan,
  type ActionEngineContext,
} from '../src/services/actionEngine.ts'
import type {
  TaskItem,
  MemoryItem,
  KnowledgeItem,
  WorkspaceItem,
} from '../src/types/index.ts'

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

describe('NOVA Unified Action Engine — Workspaces, Knowledge, Memory & Tasks Suite', () => {
  let mockStorage: MockStorage
  let tasks: TaskItem[]
  let memories: MemoryItem[]
  let knowledge: KnowledgeItem[]
  let workspaces: WorkspaceItem[]
  let activeWorkspaceId: string | null

  function createTestContext(prompt: string, overrides: Partial<ActionEngineContext> = {}): ActionEngineContext {
    return {
      prompt,
      tasks,
      memories,
      knowledge,
      workspaces,
      activeWorkspaceId,
      onAddTask: async (draft) => {
        const newTask: TaskItem = {
          id: `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          title: draft.title,
          completed: false,
          priority: draft.priority,
          scheduledAt: draft.scheduledAt,
          estimateMinutes: draft.estimateMinutes,
          workspaceId: draft.workspaceId ?? undefined,
          createdAt: new Date().toISOString(),
        }
        tasks.push(newTask)
        mockStorage.setItem('nova:tasks:v1', JSON.stringify(tasks))
        return newTask
      },
      onUpdateTask: async (id, updates) => {
        const found = tasks.find((t) => t.id === id)
        if (!found) throw new Error(`Task with ID "${id}" does not exist.`)
        tasks = tasks.map((t) => (t.id === id ? { ...t, ...updates } : t))
        mockStorage.setItem('nova:tasks:v1', JSON.stringify(tasks))
      },
      onDeleteTask: async (id) => {
        const found = tasks.find((t) => t.id === id)
        if (!found) throw new Error(`Task with ID "${id}" does not exist.`)
        tasks = tasks.filter((t) => t.id !== id)
        mockStorage.setItem('nova:tasks:v1', JSON.stringify(tasks))
      },
      onToggleTask: async (id) => {
        const found = tasks.find((t) => t.id === id)
        if (!found) throw new Error(`Task with ID "${id}" does not exist.`)
        tasks = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
        mockStorage.setItem('nova:tasks:v1', JSON.stringify(tasks))
      },
      onDeleteAllTasks: async () => {
        tasks = []
        mockStorage.setItem('nova:tasks:v1', JSON.stringify([]))
      },
      onAddMemory: async (category, content, wsId) => {
        const newMemory: MemoryItem = {
          id: `mem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          category,
          content,
          dateAdded: 'Today',
          workspaceId: wsId,
        }
        memories.push(newMemory)
        mockStorage.setItem('nova:memories:v1', JSON.stringify(memories))
        return newMemory
      },
      onUpdateMemory: async (id, updates) => {
        const found = memories.find((m) => m.id === id)
        if (!found) throw new Error(`Memory with ID "${id}" does not exist.`)
        memories = memories.map((m) => (m.id === id ? { ...m, ...updates } : m))
        mockStorage.setItem('nova:memories:v1', JSON.stringify(memories))
      },
      onDeleteMemory: async (id) => {
        const found = memories.find((m) => m.id === id)
        if (!found) throw new Error(`Memory with ID "${id}" does not exist.`)
        memories = memories.filter((m) => m.id !== id)
        mockStorage.setItem('nova:memories:v1', JSON.stringify(memories))
      },
      onAddKnowledge: async (draft) => {
        const newNote: KnowledgeItem = {
          id: `note-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          title: draft.title,
          content: draft.content,
          kind: draft.kind,
          tags: draft.tags,
          workspaceId: draft.workspaceId,
          createdAt: new Date().toISOString(),
        }
        knowledge.push(newNote)
        mockStorage.setItem('nova:knowledge:v1', JSON.stringify(knowledge))
        return newNote
      },
      onUpdateKnowledge: async (id, updates) => {
        const found = knowledge.find((k) => k.id === id)
        if (!found) throw new Error(`Note with ID "${id}" does not exist.`)
        knowledge = knowledge.map((k) => (k.id === id ? { ...k, ...updates } : k))
        mockStorage.setItem('nova:knowledge:v1', JSON.stringify(knowledge))
      },
      onDeleteKnowledge: async (id) => {
        const found = knowledge.find((k) => k.id === id)
        if (!found) throw new Error(`Note with ID "${id}" does not exist.`)
        knowledge = knowledge.filter((k) => k.id !== id)
        mockStorage.setItem('nova:knowledge:v1', JSON.stringify(knowledge))
      },
      onAddWorkspace: async (draft) => {
        const newWorkspace: WorkspaceItem = {
          id: `space-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: draft.name,
          description: draft.description || '',
          kind: draft.kind || 'Project',
          createdAt: new Date().toISOString(),
        }
        workspaces.push(newWorkspace)
        activeWorkspaceId = newWorkspace.id
        mockStorage.setItem('nova:workspaces:v1', JSON.stringify(workspaces))
        return newWorkspace.id
      },
      onUpdateWorkspace: async (id, updates) => {
        const found = workspaces.find((w) => w.id === id)
        if (!found) throw new Error(`Workspace with ID "${id}" does not exist.`)
        workspaces = workspaces.map((w) => (w.id === id ? { ...w, ...updates } : w))
        mockStorage.setItem('nova:workspaces:v1', JSON.stringify(workspaces))
      },
      onDeleteWorkspace: async (id) => {
        const found = workspaces.find((w) => w.id === id)
        if (!found) throw new Error(`Workspace with ID "${id}" does not exist.`)
        workspaces = workspaces.filter((w) => w.id !== id)
        tasks = tasks.map((t) => (t.workspaceId === id ? { ...t, workspaceId: undefined } : t))
        knowledge = knowledge.map((k) => (k.workspaceId === id ? { ...k, workspaceId: undefined } : k))
        memories = memories.map((m) => (m.workspaceId === id ? { ...m, workspaceId: undefined } : m))
        if (activeWorkspaceId === id) activeWorkspaceId = null
        mockStorage.setItem('nova:workspaces:v1', JSON.stringify(workspaces))
        mockStorage.setItem('nova:tasks:v1', JSON.stringify(tasks))
        mockStorage.setItem('nova:knowledge:v1', JSON.stringify(knowledge))
        mockStorage.setItem('nova:memories:v1', JSON.stringify(memories))
      },
      onSelectWorkspace: (id) => {
        activeWorkspaceId = id
      },
      ...overrides,
    }
  }

  beforeEach(() => {
    mockStorage = new MockStorage()
    tasks = []
    memories = []
    knowledge = []
    workspaces = []
    activeWorkspaceId = null
  })

  describe('1. Workspaces Natural Language & Execution', () => {
    it('directly creates a workspace for "Create a workspace for Product Launch." without asking questionnaires', async () => {
      const prompt = 'Create a workspace for Product Launch.'

      // Step A: Parse action plan
      const plan = parseActionPlan(prompt)
      assert.notStrictEqual(plan, null, 'Action plan must be detected')
      assert.strictEqual(plan?.entity, 'workspace')
      assert.strictEqual(plan?.verb, 'create')
      assert.strictEqual(plan?.title, 'Product Launch')

      // Step B: Execute action
      const ctx = createTestContext(prompt)
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.entityType, 'workspace')
      assert.strictEqual(result.verb, 'create')
      assert.ok(result.response.includes('Product Launch'), 'Response must confirm workspace name')
      assert.ok(!result.response.toLowerCase().includes('what platform'), 'Must not ask platform questionnaires')
      assert.ok(!result.response.toLowerCase().includes('permissions'), 'Must not ask permissions questionnaires')
      assert.ok(!result.response.toLowerCase().includes('automations'), 'Must not ask automation questionnaires')

      // Step C: Verify persistence in storage and active status
      assert.strictEqual(workspaces.length, 1)
      assert.strictEqual(workspaces[0].name, 'Product Launch')
      assert.strictEqual(activeWorkspaceId, workspaces[0].id)

      const storedWorkspaces = JSON.parse(mockStorage.getItem('nova:workspaces:v1') || '[]')
      assert.strictEqual(storedWorkspaces.length, 1)
      assert.strictEqual(storedWorkspaces[0].name, 'Product Launch')
    })

    it('parses various workspace creation prompt variants cleanly', () => {
      const prompts = [
        { input: 'Create workspace Product Launch', expected: 'Product Launch' },
        { input: 'create a workspace called Product Launch', expected: 'Product Launch' },
        { input: 'Make a workspace named "Product Launch"', expected: 'Product Launch' },
        { input: 'Please set up a workspace for Product Launch!', expected: 'Product Launch' },
        { input: 'Add workspace: Q4 Launch', expected: 'Q4 Launch' },
      ]

      for (const p of prompts) {
        const plan = parseActionPlan(p.input)
        assert.notStrictEqual(plan, null, `Should parse: ${p.input}`)
        assert.strictEqual(plan?.entity, 'workspace')
        assert.strictEqual(plan?.verb, 'create')
        assert.strictEqual(plan?.title, p.expected)
      }
    })

    it('lists workspaces truthfully', async () => {
      workspaces.push(
        { id: 'w1', name: 'Product Launch', kind: 'Project', createdAt: new Date().toISOString() },
        { id: 'w2', name: 'Personal Ops', kind: 'Personal', createdAt: new Date().toISOString() }
      )
      activeWorkspaceId = 'w1'

      const ctx = createTestContext('Show workspaces')
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'queried')
      assert.strictEqual(result.entityType, 'workspace')
      assert.strictEqual(result.verb, 'list')
      assert.ok(result.response.includes('Product Launch'))
      assert.ok(result.response.includes('Personal Ops'))
      assert.ok(result.response.includes('(Active)'))
    })

    it('renames and updates workspace details', async () => {
      workspaces.push({ id: 'w1', name: 'Product Launch', kind: 'Project', createdAt: new Date().toISOString() })

      const ctx = createTestContext('Rename workspace Product Launch to Launch 2.0')
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.entityType, 'workspace')
      assert.strictEqual(result.verb, 'update')
      assert.ok(result.response.includes('Launch 2.0'))

      assert.strictEqual(workspaces[0].name, 'Launch 2.0')
    })

    it('deletes workspace and safely re-scopes child tasks and notes to personal scope', async () => {
      const wsId = 'ws-launch'
      workspaces.push({ id: wsId, name: 'Product Launch', kind: 'Project', createdAt: new Date().toISOString() })
      tasks.push({
        id: 't1',
        title: 'Review pitch deck',
        completed: false,
        priority: 'high',
        createdAt: new Date().toISOString(),
        workspaceId: wsId,
      })
      knowledge.push({
        id: 'k1',
        title: 'Launch Strategy',
        content: 'Focus on enterprise early adopters',
        kind: 'Project notes',
        tags: ['strategy'],
        createdAt: new Date().toISOString(),
        workspaceId: wsId,
      })
      activeWorkspaceId = wsId

      const ctx = createTestContext('Delete workspace Product Launch')
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.verb, 'delete')
      assert.strictEqual(workspaces.length, 0)
      assert.strictEqual(activeWorkspaceId, null)

      // Child records must not be deleted, but re-scoped to personal
      assert.strictEqual(tasks.length, 1)
      assert.strictEqual(tasks[0].workspaceId, undefined)
      assert.strictEqual(knowledge.length, 1)
      assert.strictEqual(knowledge[0].workspaceId, undefined)
    })
  })

  describe('2. Multi-Action Sequential Execution with Automatic Workspace Scoping', () => {
    it('creates a workspace and automatically associates subsequent task in that workspace', async () => {
      const prompt = 'Create a workspace for Product Launch and add a task to prepare the pitch deck'

      const plans = parseMultiActionPlan(prompt)
      assert.strictEqual(plans.length, 2, 'Should detect two sequential actions')
      assert.strictEqual(plans[0].entity, 'workspace')
      assert.strictEqual(plans[0].title, 'Product Launch')
      assert.strictEqual(plans[1].entity, 'task')
      assert.strictEqual(plans[1].title, 'prepare the pitch deck')

      const ctx = createTestContext(prompt)
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(workspaces.length, 1)
      assert.strictEqual(workspaces[0].name, 'Product Launch')
      assert.strictEqual(tasks.length, 1)
      assert.strictEqual(tasks[0].title, 'prepare the pitch deck')
      assert.strictEqual(tasks[0].workspaceId, workspaces[0].id, 'Task must be scoped to the newly created workspace')
    })
  })

  describe('3. Knowledge and Notes Actions', () => {
    it('creates and saves a note with title, content, and tags', async () => {
      const prompt = 'Save a note: Market Research - Top competitors are Acme and Apex with #competitors'
      const plan = parseActionPlan(prompt)

      assert.notStrictEqual(plan, null)
      assert.strictEqual(plan?.entity, 'knowledge')
      assert.strictEqual(plan?.verb, 'create')
      assert.strictEqual(plan?.title, 'Market Research')
      assert.ok(plan?.content?.includes('Top competitors'))
      assert.ok(plan?.tags?.includes('competitors'))

      const ctx = createTestContext(prompt)
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(knowledge.length, 1)
      assert.strictEqual(knowledge[0].title, 'Market Research')
      assert.ok(knowledge[0].content.includes('Top competitors'))

      // Verify survives simulated page reload from mock storage
      const stored = JSON.parse(mockStorage.getItem('nova:knowledge:v1') || '[]')
      assert.strictEqual(stored.length, 1)
      assert.strictEqual(stored[0].title, 'Market Research')
    })

    it('searches and retrieves saved notes in chat', async () => {
      knowledge.push({
        id: 'note-1',
        title: 'Competitor Analysis',
        content: 'Acme Corp is releasing their Beta next Tuesday.',
        kind: 'Project notes',
        tags: ['market'],
        createdAt: new Date().toISOString(),
      })

      const ctx = createTestContext('search notes for Acme')
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'queried')
      assert.strictEqual(result.entityType, 'knowledge')
      assert.strictEqual(result.verb, 'search')
      assert.ok(result.response.includes('Competitor Analysis'))
      assert.ok(result.response.includes('Acme Corp'))
    })

    it('deletes note safely', async () => {
      knowledge.push({
        id: 'note-1',
        title: 'Draft Pitch',
        content: 'Old pitch ideas',
        kind: 'Personal note',
        tags: [],
        createdAt: new Date().toISOString(),
      })

      const ctx = createTestContext('delete note Draft Pitch')
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.verb, 'delete')
      assert.strictEqual(knowledge.length, 0)
    })
  })

  describe('4. Memory Actions & Retention', () => {
    it('saves a long-term preference memory', async () => {
      const prompt = 'Remember that my favorite programming language is TypeScript.'
      const plan = parseActionPlan(prompt)

      assert.notStrictEqual(plan, null)
      assert.strictEqual(plan?.entity, 'memory')
      assert.strictEqual(plan?.verb, 'create')
      assert.strictEqual(plan?.category, 'Preferences')
      assert.ok(plan?.content?.includes('favorite programming language is TypeScript'))

      const ctx = createTestContext(prompt)
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(memories.length, 1)
      assert.strictEqual(memories[0].category, 'Preferences')
      assert.ok(memories[0].content.includes('favorite programming language is TypeScript'))
    })

    it('lists memories on request', async () => {
      memories.push({
        id: 'm1',
        category: 'Preferences',
        content: 'Prefers dark mode in code editors',
        dateAdded: 'Today',
      })

      const ctx = createTestContext('Show my memories')
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'queried')
      assert.strictEqual(result.entityType, 'memory')
      assert.strictEqual(result.verb, 'list')
      assert.ok(result.response.includes('Prefers dark mode'))
    })

    it('deletes or forgets a memory detail', async () => {
      memories.push({
        id: 'm1',
        category: 'Preferences',
        content: 'Prefers dark mode in code editors',
        dateAdded: 'Today',
      })

      const ctx = createTestContext('Forget that dark mode in code editors')
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.verb, 'delete')
      assert.strictEqual(memories.length, 0)
    })
  })

  describe('5. Shared Tool Calling (Gemini Live & Text Chat Parity)', () => {
    it('executes create_workspace tool call directly', async () => {
      const ctx = createTestContext('')
      const result = await executeToolCall('create_workspace', { name: 'Engineering Core', kind: 'Engineering' }, ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.entityType, 'workspace')
      assert.strictEqual(workspaces.length, 1)
      assert.strictEqual(workspaces[0].name, 'Engineering Core')
    })

    it('executes save_note tool call directly', async () => {
      const ctx = createTestContext('')
      const result = await executeToolCall(
        'save_note',
        { title: 'API Specs', content: 'REST endpoints for v2', kind: 'Reference', tags: ['api', 'v2'] },
        ctx
      )

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.entityType, 'knowledge')
      assert.strictEqual(knowledge.length, 1)
      assert.strictEqual(knowledge[0].title, 'API Specs')
    })

    it('executes save_memory tool call directly', async () => {
      const ctx = createTestContext('')
      const result = await executeToolCall(
        'save_memory',
        { content: 'Prefers standups at 10 AM', category: 'Work' },
        ctx
      )

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.entityType, 'memory')
      assert.strictEqual(memories.length, 1)
      assert.strictEqual(memories[0].content, 'Prefers standups at 10 AM')
    })
  })

  describe('6. Truthful Error Handling & Safeguards', () => {
    it('reports persistence failure truthfully and never claims false success when backend throws', async () => {
      const ctx = createTestContext('Create a workspace for Secret Project', {
        onAddWorkspace: async () => {
          throw new Error('Supabase RLS policy violation: JWT expired.')
        },
      })

      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'error')
      assert.ok(result.response.includes('Persistence Failed'))
      assert.ok(result.response.includes('JWT expired'))
      assert.strictEqual(workspaces.length, 0, 'No workspace should be falsely created')
    })

    it('requires confirmation for destructive delete_all_tasks operation', async () => {
      tasks.push({
        id: 't1',
        title: 'Important presentation',
        completed: false,
        priority: 'high',
        createdAt: new Date().toISOString(),
      })

      const ctx = createTestContext('Delete all tasks')
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'needs_confirmation')
      assert.ok(result.response.toLowerCase().includes('confirmation required'))
      assert.strictEqual(tasks.length, 1, 'Tasks must not be deleted without confirmation')
    })

    it('executes delete_all_tasks once explicitly confirmed', async () => {
      tasks.push({
        id: 't1',
        title: 'Important presentation',
        completed: false,
        priority: 'high',
        createdAt: new Date().toISOString(),
      })

      const ctx = createTestContext('Confirm delete all tasks')
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(tasks.length, 0, 'Tasks must be cleared after confirmation')
    })
  })
})
