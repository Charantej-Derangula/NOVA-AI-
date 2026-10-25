import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import {
  executeUnifiedAction,
  retrieveActionContext,
  parseMultiActionPlan,
  novaToolDefinitions,
  validateToolArguments,
  checkIntegrationStatus,
  getAvailableIntegrations,
  type ActionEngineContext,
} from '../src/services/actionEngine.ts'
import {
  readStoredValue,
} from '../src/hooks/useLocalStorageState.ts'
import type {
  TaskItem,
  MemoryItem,
  KnowledgeItem,
  WorkspaceItem,
  ChatSession,
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

describe('NOVA Unified AI Action & Context Engine — End-to-End Suite', () => {
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
      onAddTask: (draft) => {
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
      onUpdateTask: (id, updates) => {
        const found = tasks.find((t) => t.id === id)
        if (!found) throw new Error(`Task with ID "${id}" does not exist.`)
        tasks = tasks.map((t) => (t.id === id ? { ...t, ...updates } : t))
        mockStorage.setItem('nova:tasks:v1', JSON.stringify(tasks))
      },
      onDeleteTask: (id) => {
        const found = tasks.find((t) => t.id === id)
        if (!found) throw new Error(`Task with ID "${id}" does not exist.`)
        tasks = tasks.filter((t) => t.id !== id)
        mockStorage.setItem('nova:tasks:v1', JSON.stringify(tasks))
      },
      onToggleTask: (id) => {
        const found = tasks.find((t) => t.id === id)
        if (!found) throw new Error(`Task with ID "${id}" does not exist.`)
        tasks = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
        mockStorage.setItem('nova:tasks:v1', JSON.stringify(tasks))
      },
      onAddMemory: (category, content, workspaceId) => {
        const newMemory: MemoryItem = {
          id: `mem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          category,
          content,
          workspaceId,
          dateAdded: new Date().toISOString(),
        }
        memories.push(newMemory)
        mockStorage.setItem('nova:memories:v1', JSON.stringify(memories))
        return newMemory
      },
      onUpdateMemory: (id, updates) => {
        const found = memories.find((m) => m.id === id)
        if (!found) throw new Error(`Memory with ID "${id}" does not exist.`)
        memories = memories.map((m) => (m.id === id ? { ...m, ...updates } : m))
        mockStorage.setItem('nova:memories:v1', JSON.stringify(memories))
      },
      onDeleteMemory: (id) => {
        const found = memories.find((m) => m.id === id)
        if (!found) throw new Error(`Memory with ID "${id}" does not exist.`)
        memories = memories.filter((m) => m.id !== id)
        mockStorage.setItem('nova:memories:v1', JSON.stringify(memories))
      },
      onAddKnowledge: (draft) => {
        const newKnowledge: KnowledgeItem = {
          id: `know-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          title: draft.title,
          content: draft.content,
          kind: draft.kind,
          tags: draft.tags || [],
          workspaceId: draft.workspaceId,
          createdAt: new Date().toISOString(),
        }
        knowledge.push(newKnowledge)
        mockStorage.setItem('nova:knowledge:v1', JSON.stringify(knowledge))
        return newKnowledge
      },
      onUpdateKnowledge: (id, updates) => {
        const found = knowledge.find((k) => k.id === id)
        if (!found) throw new Error(`Note with ID "${id}" does not exist.`)
        knowledge = knowledge.map((k) => (k.id === id ? { ...k, ...updates } : k))
        mockStorage.setItem('nova:knowledge:v1', JSON.stringify(knowledge))
      },
      onDeleteKnowledge: (id) => {
        const found = knowledge.find((k) => k.id === id)
        if (!found) throw new Error(`Note with ID "${id}" does not exist.`)
        knowledge = knowledge.filter((k) => k.id !== id)
        mockStorage.setItem('nova:knowledge:v1', JSON.stringify(knowledge))
      },
      onAddWorkspace: (draft) => {
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
      onUpdateWorkspace: (id, updates) => {
        const found = workspaces.find((w) => w.id === id)
        if (!found) throw new Error(`Workspace with ID "${id}" does not exist.`)
        workspaces = workspaces.map((w) => (w.id === id ? { ...w, ...updates } : w))
        mockStorage.setItem('nova:workspaces:v1', JSON.stringify(workspaces))
      },
      onDeleteWorkspace: (id) => {
        const found = workspaces.find((w) => w.id === id)
        if (!found) throw new Error(`Workspace with ID "${id}" does not exist.`)
        workspaces = workspaces.filter((w) => w.id !== id)
        tasks = tasks.map((t) => (t.workspaceId === id ? { ...t, workspaceId: undefined } : t))
        knowledge = knowledge.map((k) => (k.workspaceId === id ? { ...k, workspaceId: undefined } : k))
        memories = memories.map((m) => (m.workspaceId === id ? { ...m, workspaceId: undefined } : m))
        if (activeWorkspaceId === id) activeWorkspaceId = null
        mockStorage.setItem('nova:workspaces:v1', JSON.stringify(workspaces))
      },
      onSelectWorkspace: (id) => {
        activeWorkspaceId = id
      },
      ...overrides,
    }
  }

  beforeEach(() => {
    mockStorage = new MockStorage()
    ;(globalThis as unknown as { localStorage: MockStorage }).localStorage = mockStorage
    ;(globalThis as unknown as { window: { localStorage: MockStorage } }).window = { localStorage: mockStorage }

    tasks = []
    memories = []
    knowledge = []
    workspaces = []
    activeWorkspaceId = null
  })

  // 1. Creating a task through chat and finding it in Tasks
  it('1. Creates a task through chat and verifies persistence in Tasks store', async () => {
    const prompt = 'Add a task to Deploy production release tomorrow at 4pm high priority'
    const ctx = createTestContext(prompt)

    const result = await executeUnifiedAction(ctx)
    assert.strictEqual(result.handled, true)
    assert.strictEqual(result.status, 'executed')
    assert.strictEqual(result.entityType, 'task')
    assert.strictEqual(result.verb, 'create')
    assert.ok(result.recordId?.startsWith('task-'))

    // Verify task is in in-memory tasks
    assert.strictEqual(tasks.length, 1)
    const saved = tasks[0]
    assert.strictEqual(saved.id, result.recordId)
    assert.strictEqual(saved.title, 'Deploy production release')
    assert.strictEqual(saved.priority, 'high')
    assert.strictEqual(saved.completed, false)
    assert.ok(saved.scheduledAt, 'Should have resolved local date and time')

    // Verify persisted in localStorage
    const storedJson = mockStorage.getItem('nova:tasks:v1')
    assert.ok(storedJson)
    const storedTasks: TaskItem[] = JSON.parse(storedJson)
    assert.strictEqual(storedTasks.length, 1)
    assert.strictEqual(storedTasks[0].id, result.recordId)
    assert.strictEqual(storedTasks[0].title, 'Deploy production release')
  })

  // 2. Retrieving that task through a subsequent AI request
  it('2. Retrieves authorized task through subsequent AI contextual request', async () => {
    tasks.push(
      {
        id: 'task-101',
        title: 'Deploy production release',
        completed: false,
        priority: 'high',
        scheduledAt: '2026-10-26T16:00:00',
        estimateMinutes: 30,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'task-102',
        title: 'Buy groceries for weekend',
        completed: false,
        priority: 'low',
        scheduledAt: '2026-10-27',
        estimateMinutes: 20,
        createdAt: new Date().toISOString(),
      }
    )

    const prompt = 'What tasks are left for production release?'
    const ctx = createTestContext(prompt)

    const retrieved = retrieveActionContext({
      prompt,
      tasks,
      memories,
      knowledge,
      workspaces,
      activeWorkspaceId,
    })

    assert.strictEqual(retrieved.relevantTasks.length, 1)
    assert.strictEqual(retrieved.relevantTasks[0].id, 'task-101')
    assert.strictEqual(retrieved.relevantTasks[0].title, 'Deploy production release')
    assert.ok(retrieved.formattedContextPrompt.includes('Deploy production release'))
    assert.ok(!retrieved.formattedContextPrompt.includes('Buy groceries'), 'Unrelated tasks must not be dumped into context')

    const actionResult = await executeUnifiedAction(ctx)
    assert.strictEqual(actionResult.handled, true)
    assert.strictEqual(actionResult.requiresAiFollowup, true)
    assert.strictEqual(actionResult.retrievedContext?.relevantTasks[0].id, 'task-101')
  })

  // 3. Saving and retrieving a memory across browser refreshes
  it('3. Saves and retrieves a memory across simulated browser refreshes', async () => {
    const savePrompt = 'Remember that I prefer dark theme and concise code snippets'
    const ctx = createTestContext(savePrompt)

    const saveResult = await executeUnifiedAction(ctx)
    assert.strictEqual(saveResult.handled, true)
    assert.strictEqual(saveResult.status, 'executed')
    assert.strictEqual(saveResult.entityType, 'memory')
    assert.strictEqual(saveResult.verb, 'create')
    assert.ok(saveResult.recordId?.startsWith('mem-'))

    // Verify localStorage has the memory
    const storedMemoriesJson = mockStorage.getItem('nova:memories:v1')
    assert.ok(storedMemoriesJson)
    const storedMemories: MemoryItem[] = JSON.parse(storedMemoriesJson)
    assert.strictEqual(storedMemories.length, 1)
    assert.strictEqual(storedMemories[0].content, 'I prefer dark theme and concise code snippets')
    assert.strictEqual(storedMemories[0].category, 'Preferences')

    // Simulate browser refresh: re-instantiate memory state from storage
    const restoredMemories: MemoryItem[] = readStoredValue('nova:memories:v1', [])
    assert.strictEqual(restoredMemories.length, 1)
    assert.strictEqual(restoredMemories[0].id, saveResult.recordId)

    // Retrieve via AI context query
    const queryPrompt = 'What are my preferences regarding theme and code?'
    const retrieved = retrieveActionContext({
      prompt: queryPrompt,
      tasks: [],
      memories: restoredMemories,
      knowledge: [],
      workspaces: [],
      activeWorkspaceId: null,
    })

    assert.strictEqual(retrieved.relevantMemories.length, 1)
    assert.strictEqual(retrieved.relevantMemories[0].category, 'Preferences')
    assert.ok(retrieved.formattedContextPrompt.includes('dark theme'))
  })

  // 4. Creating a note and searching for its content
  it('4. Creates a note in Knowledge and retrieves its content through search', async () => {
    const createNotePrompt =
      'Save note titled "Database Architecture": PostgreSQL 15 with Supabase RLS policies #database #architecture'
    const ctx = createTestContext(createNotePrompt)

    const createResult = await executeUnifiedAction(ctx)
    assert.strictEqual(createResult.handled, true)
    assert.strictEqual(createResult.status, 'executed')
    assert.strictEqual(createResult.entityType, 'knowledge')
    assert.strictEqual(createResult.verb, 'create')
    assert.ok(createResult.recordId?.startsWith('know-'))

    // Verify note is saved with title, tags, kind
    assert.strictEqual(knowledge.length, 1)
    const note = knowledge[0]
    assert.strictEqual(note.title, 'Database Architecture')
    assert.ok(note.tags.includes('database'))
    assert.ok(note.tags.includes('architecture'))
    assert.ok(note.content.includes('PostgreSQL 15 with Supabase RLS policies'))

    // Test search operation
    const searchPrompt = 'Search notes for PostgreSQL'
    const searchCtx = createTestContext(searchPrompt)
    const searchResult = await executeUnifiedAction(searchCtx)

    assert.strictEqual(searchResult.handled, true)
    assert.strictEqual(searchResult.status, 'queried')
    assert.strictEqual(searchResult.entityType, 'knowledge')
    assert.strictEqual(searchResult.verb, 'search')
    assert.ok(searchResult.response.includes('Database Architecture'))
    assert.ok(searchResult.response.includes('PostgreSQL 15'))
  })

  // 5. Creating a workspace and associating a task and note with it
  it('5. Creates a workspace and associates subsequent task and note with it', async () => {
    // 5a. Create workspace
    const wsPrompt = 'Create workspace NOVA Engineering'
    const ctx1 = createTestContext(wsPrompt)
    const wsResult = await executeUnifiedAction(ctx1)

    assert.strictEqual(wsResult.handled, true)
    assert.strictEqual(wsResult.status, 'executed')
    assert.strictEqual(wsResult.entityType, 'workspace')
    assert.strictEqual(wsResult.verb, 'create')
    assert.ok(wsResult.recordId?.startsWith('space-'))
    const workspaceId = wsResult.recordId!
    assert.strictEqual(activeWorkspaceId, workspaceId)

    // 5b. Add task in active workspace
    const taskPrompt = 'Add a task to Write unit tests for router'
    const ctx2 = createTestContext(taskPrompt)
    const taskResult = await executeUnifiedAction(ctx2)

    assert.strictEqual(taskResult.handled, true)
    assert.strictEqual(taskResult.status, 'executed')
    assert.strictEqual(tasks[0].workspaceId, workspaceId, 'Task must be scoped to the active workspace')

    // 5c. Add note in active workspace
    const notePrompt = 'Save note titled "Router Architecture": Hash-safe pushState history'
    const ctx3 = createTestContext(notePrompt)
    const noteResult = await executeUnifiedAction(ctx3)

    assert.strictEqual(noteResult.handled, true)
    assert.strictEqual(knowledge[0].workspaceId, workspaceId, 'Note must be scoped to the active workspace')

    // 5d. Verify both records are retrieved in workspace context
    const retrieved = retrieveActionContext({
      prompt: 'What do we have in NOVA Engineering?',
      tasks,
      memories,
      knowledge,
      workspaces,
      activeWorkspaceId,
    })

    assert.strictEqual(retrieved.activeWorkspace?.id, workspaceId)
    assert.strictEqual(retrieved.relevantTasks[0].title, 'Write unit tests for router')
    assert.strictEqual(retrieved.relevantNotes[0].title, 'Router Architecture')
  })

  // 6. Updating and deleting records with correct ownership checks
  it('6. Updates and deletes records with validation and error handling for missing records', async () => {
    const existingTask: TaskItem = {
      id: 'task-test-6',
      title: 'Initial Title',
      completed: false,
      priority: 'low',
      createdAt: new Date().toISOString(),
      estimateMinutes: 15,
    }
    tasks.push(existingTask)

    // 6a. Valid Update
    const updatePrompt = 'Update task task-test-6 to high priority'
    const ctx1 = createTestContext(updatePrompt)
    const updateResult = await executeUnifiedAction(ctx1)

    assert.strictEqual(updateResult.handled, true)
    assert.strictEqual(updateResult.status, 'executed')
    assert.strictEqual(tasks[0].priority, 'high')

    // 6b. Non-existent record update (Permission / existence check)
    const invalidUpdatePrompt = 'Update task invalid-id-999 to low priority'
    const ctx2 = createTestContext(invalidUpdatePrompt)
    const invalidResult = await executeUnifiedAction(ctx2)

    assert.strictEqual(invalidResult.handled, true)
    assert.strictEqual(invalidResult.status, 'error')
    assert.ok(invalidResult.response.includes('Could not find a task matching "invalid-id-999"'))
    assert.strictEqual(tasks[0].priority, 'high', 'Existing task must remain uncorrupted')

    // 6c. Valid Delete
    const deletePrompt = 'Delete task task-test-6'
    const ctx3 = createTestContext(deletePrompt)
    const deleteResult = await executeUnifiedAction(ctx3)

    assert.strictEqual(deleteResult.handled, true)
    assert.strictEqual(deleteResult.status, 'executed')
    assert.strictEqual(tasks.length, 0)
  })

  // 7. Performing a multi-action request where one operation fails
  it('7. Handles compound multi-action requests and reports partial execution truthfully', async () => {
    const compoundPrompt =
      'Create a task for Submit quarterly earnings and sync with Google Calendar'
    const ctx = createTestContext(compoundPrompt)

    const plans = parseMultiActionPlan(compoundPrompt)
    assert.strictEqual(plans.length, 2, 'Should detect two distinct action intents')
    assert.strictEqual(plans[0].entity, 'task')
    assert.strictEqual(plans[1].entity, 'integration')

    const result = await executeUnifiedAction(ctx)
    assert.strictEqual(result.handled, true)
    // One succeeded, one failed
    assert.strictEqual(result.status, 'partially_executed')
    assert.ok(result.subResults && result.subResults.length === 2)
    assert.strictEqual(result.subResults[0].status, 'executed')
    assert.strictEqual(result.subResults[1].status, 'error')

    // Truthful reporting: task was created, but calendar sync failed
    assert.ok(result.response.includes('Partial Execution (1/2 actions completed)'))
    assert.ok(result.response.includes('Task Created & Persisted'))
    assert.ok(result.response.includes('Integration Not Connected'))
    assert.strictEqual(tasks.length, 1)
    assert.strictEqual(tasks[0].title, 'Submit quarterly earnings')
  })

  // 8. Executing a supported action through voice
  it('8. Executes supported action through voice transcript flow consistently', async () => {
    // Simulating final voice transcript received by VoiceExperience onSendTranscript handler
    const voiceTranscript = 'Create a task to Review pull request 42 high priority'
    const ctx = createTestContext(voiceTranscript)

    // Both voice and chat route through executeUnifiedAction
    const result = await executeUnifiedAction(ctx)
    assert.strictEqual(result.handled, true)
    assert.strictEqual(result.status, 'executed')
    assert.strictEqual(result.entityType, 'task')
    assert.strictEqual(result.verb, 'create')

    assert.strictEqual(tasks.length, 1)
    assert.strictEqual(tasks[0].title, 'Review pull request 42')
    assert.strictEqual(tasks[0].priority, 'high')

    // Verify localStorage has persisted voice task
    const storedTasks: TaskItem[] = JSON.parse(mockStorage.getItem('nova:tasks:v1')!)
    assert.strictEqual(storedTasks.length, 1)
    assert.strictEqual(storedTasks[0].id, tasks[0].id)
  })

  // 9. Handling disconnected integrations without false success
  it('9. Rejects unconfigured integrations with informative messages instead of fake success', async () => {
    const integrations = getAvailableIntegrations()
    assert.ok(integrations.length >= 4)
    assert.strictEqual(integrations.every((i) => i.connected === false), true)

    // Test Google Calendar
    const calResult = checkIntegrationStatus('google_calendar')
    assert.strictEqual(calResult.isAvailable, false)
    assert.ok(calResult.message.includes('Integration Not Connected'))

    // Test Slack
    const slackPrompt = 'Send message to Slack #general'
    const ctx = createTestContext(slackPrompt)
    const result = await executeUnifiedAction(ctx)

    assert.strictEqual(result.handled, true)
    assert.strictEqual(result.status, 'error')
    assert.strictEqual(result.entityType, 'integration')
    assert.ok(result.response.includes('Integration Not Connected'))
    assert.ok(result.response.includes('Slack is not currently connected to NOVA'))
  })

  // 10. Reloading the app and reopening chat history without losing records
  it('10. Preserves chat history and session records across page reloads without disappearing', () => {
    const sessionId = 'session-test-e2e-10'
    const nowIso = new Date().toISOString()
    const session: ChatSession = {
      id: sessionId,
      title: 'Executive Architecture Review',
      updatedAt: nowIso,
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Add a task to Deploy staging environment',
          timestamp: '10:00 AM',
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: '✓ **Task Created & Persisted** (ID: `task-stg-1`)',
          timestamp: '10:00 AM',
        },
      ],
    }

    mockStorage.setItem('nova:sessions:v1', JSON.stringify([session]))

    // Reload simulation
    const restoredSessions = readStoredValue<ChatSession[]>('nova:sessions:v1', [])
    assert.strictEqual(restoredSessions.length, 1)

    const reopened = restoredSessions.find((s) => s.id === sessionId)
    assert.ok(reopened, 'Session must be found')
    assert.strictEqual(reopened.title, 'Executive Architecture Review')
    assert.strictEqual(reopened.messages.length, 2)
    assert.strictEqual(reopened.messages[0].content, 'Add a task to Deploy staging environment')
    assert.strictEqual(reopened.messages[1].role, 'assistant')
    assert.ok(reopened.messages[1].content.includes('Task Created & Persisted'))
  })

  // Additional Tool Calling & Schema Validation Tests
  describe('Structured Tool Calling & Argument Schema Validation', () => {
    it('validates tool arguments strictly against JSON schemas', () => {
      // Valid create_task
      const validTask = validateToolArguments('create_task', {
        title: 'Build search index',
        priority: 'high',
        estimateMinutes: 45,
      })
      assert.strictEqual(validTask.valid, true)
      assert.strictEqual(validTask.cleanedArgs?.title, 'Build search index')
      assert.strictEqual(validTask.cleanedArgs?.priority, 'high')

      // Missing required argument
      const missingTitle = validateToolArguments('create_task', {
        priority: 'low',
      })
      assert.strictEqual(missingTitle.valid, false)
      assert.ok(missingTitle.error?.includes('Missing required argument "title"'))

      // Invalid enum
      const invalidEnum = validateToolArguments('create_task', {
        title: 'Fix typo',
        priority: 'critical', // not in enum ['low', 'medium', 'high']
      })
      assert.strictEqual(invalidEnum.valid, false)
      assert.ok(invalidEnum.error?.includes('must be one of: low, medium, high'))

      // Unknown tool
      const unknownTool = validateToolArguments('destroy_database', {})
      assert.strictEqual(unknownTool.valid, false)
      assert.ok(unknownTool.error?.includes('Unknown tool'))
    })

    it('exposes all required tools in novaToolDefinitions', () => {
      const toolNames = novaToolDefinitions.map((t) => t.name)
      assert.ok(toolNames.includes('create_task'))
      assert.ok(toolNames.includes('list_tasks'))
      assert.ok(toolNames.includes('complete_task'))
      assert.ok(toolNames.includes('update_task'))
      assert.ok(toolNames.includes('delete_task'))
      assert.ok(toolNames.includes('save_note'))
      assert.ok(toolNames.includes('search_notes'))
      assert.ok(toolNames.includes('delete_note'))
      assert.ok(toolNames.includes('save_memory'))
      assert.ok(toolNames.includes('list_memories'))
      assert.ok(toolNames.includes('create_workspace'))
      assert.ok(toolNames.includes('switch_workspace'))
      assert.ok(toolNames.includes('execute_integration_action'))
    })
  })
})
