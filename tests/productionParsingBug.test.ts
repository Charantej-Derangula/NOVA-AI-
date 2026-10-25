import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import {
  executeActionIntent,
  extractStructuredActionDetails,
  cleanTaskTitle,
  isMalformedTitle,
  type ActionEngineContext,
} from '../src/services/actionEngine.ts'
import type {
  TaskItem,
  KnowledgeItem,
  WorkspaceItem,
  TaskDraft,
} from '../src/types/index.ts'

describe('NOVA — Production Parsing Bug & Regression Suite', () => {
  let tasks: TaskItem[]
  let knowledge: KnowledgeItem[]
  let workspaces: WorkspaceItem[]
  let activeWorkspaceId: string | null

  beforeEach(() => {
    tasks = []
    knowledge = []
    workspaces = [
      {
        id: 'ws-prod-launch',
        name: 'Product Launch',
        description: 'Product Launch Workspace',
        kind: 'Project',
        createdAt: new Date().toISOString(),
      },
    ]
    activeWorkspaceId = null
  })

  // --------------------------------------------------------------------------
  // 1. UNIT TESTS: Deterministic Extraction
  // --------------------------------------------------------------------------
  describe('1. Deterministic Extraction Strategy (Unit)', () => {
    it('correctly extracts exact reproduced failing note input', () => {
      const input =
        'Save a note in Product Launch titled Launch Checklist with the content: finalize the prototype, test the app, and prepare the demo.'

      const extracted = extractStructuredActionDetails(input, workspaces)

      assert.strictEqual(extracted.actionType, 'note_create')
      assert.strictEqual(extracted.workspaceName, 'Product Launch')
      assert.strictEqual(extracted.workspaceId, 'ws-prod-launch')
      assert.strictEqual(extracted.title, 'Launch Checklist')
      assert.strictEqual(
        extracted.content,
        'finalize the prototype, test the app, and prepare the demo.'
      )
      assert.strictEqual(extracted.isMalformed, false)
    })

    it('correctly extracts exact reproduced failing task input', () => {
      const input = 'Create a task in Product Launch called Prepare the launch demo.'

      const extracted = extractStructuredActionDetails(input, workspaces)

      assert.strictEqual(extracted.actionType, 'task_create')
      assert.strictEqual(extracted.workspaceName, 'Product Launch')
      assert.strictEqual(extracted.workspaceId, 'ws-prod-launch')
      assert.strictEqual(extracted.title, 'Prepare the launch demo')
      assert.strictEqual(extracted.isMalformed, false)
    })

    it('handles quoted titles and workspaces', () => {
      const noteInput =
        'Save a note in "Product Launch" titled "Launch Checklist" with the content: finalize the prototype, test the app, and prepare the demo.'
      const noteExtracted = extractStructuredActionDetails(noteInput, workspaces)
      assert.strictEqual(noteExtracted.title, 'Launch Checklist')
      assert.strictEqual(noteExtracted.workspaceName, 'Product Launch')
      assert.strictEqual(
        noteExtracted.content,
        'finalize the prototype, test the app, and prepare the demo.'
      )

      const taskInput = 'Create a task in "Product Launch" called "Prepare the launch demo"'
      const taskExtracted = extractStructuredActionDetails(taskInput, workspaces)
      assert.strictEqual(taskExtracted.title, 'Prepare the launch demo')
      assert.strictEqual(taskExtracted.workspaceName, 'Product Launch')
    })

    it('handles trailing workspace placement', () => {
      const taskInput = 'Create a task called Prepare the launch demo in Product Launch.'
      const extracted = extractStructuredActionDetails(taskInput, workspaces)
      assert.strictEqual(extracted.title, 'Prepare the launch demo')
      assert.strictEqual(extracted.workspaceName, 'Product Launch')
      assert.strictEqual(extracted.workspaceId, 'ws-prod-launch')
    })

    it('handles leading workspace placement', () => {
      const taskInput = 'In Product Launch, create a task called Prepare the launch demo.'
      const taskExtracted = extractStructuredActionDetails(taskInput, workspaces)
      assert.strictEqual(taskExtracted.title, 'Prepare the launch demo')
      assert.strictEqual(taskExtracted.workspaceName, 'Product Launch')

      const noteInput =
        'In Product Launch, save a note titled Launch Checklist with the content: finalize the prototype, test the app, and prepare the demo.'
      const noteExtracted = extractStructuredActionDetails(noteInput, workspaces)
      assert.strictEqual(noteExtracted.title, 'Launch Checklist')
      assert.strictEqual(noteExtracted.workspaceName, 'Product Launch')
      assert.strictEqual(
        noteExtracted.content,
        'finalize the prototype, test the app, and prepare the demo.'
      )
    })

    it('handles complex note content with commas, semicolons, and conjunctions', () => {
      const input =
        'Save a note in Product Launch titled Q3 Review with the content: analyzed metrics, finalized budget, and prepared executive slide deck; all systems go.'
      const extracted = extractStructuredActionDetails(input, workspaces)
      assert.strictEqual(extracted.title, 'Q3 Review')
      assert.strictEqual(extracted.workspaceName, 'Product Launch')
      assert.strictEqual(
        extracted.content,
        'analyzed metrics, finalized budget, and prepared executive slide deck; all systems go.'
      )
    })

    it('resolves task scheduling and priority alongside multiword workspace', () => {
      const input =
        'Create a task in Product Launch called Prepare the launch demo tomorrow at 5pm high priority'
      const extracted = extractStructuredActionDetails(input, workspaces)
      assert.strictEqual(extracted.title, 'Prepare the launch demo')
      assert.strictEqual(extracted.workspaceName, 'Product Launch')
      assert.strictEqual(extracted.priority, 'high')
      assert.ok(extracted.scheduledAt)
    })
  })

  // --------------------------------------------------------------------------
  // 2. UNIT TESTS: cleanTaskTitle and isMalformedTitle
  // --------------------------------------------------------------------------
  describe('2. Utility Functions (cleanTaskTitle & isMalformedTitle)', () => {
    it('cleanTaskTitle strips intermediate workspace and introducers', () => {
      const title = cleanTaskTitle('Create a task in Product Launch called Prepare the launch demo.')
      assert.strictEqual(title, 'Prepare the launch demo')
    })

    it('isMalformedTitle correctly flags polluted extraction titles', () => {
      assert.strictEqual(
        isMalformedTitle('in Product Launch titled Launch Checklist with the content'),
        true
      )
      assert.strictEqual(
        isMalformedTitle('in Product Launch called Prepare the launch demo'),
        true
      )
      assert.strictEqual(isMalformedTitle('in Product Launch'), true)
      assert.strictEqual(isMalformedTitle('task'), true)
      assert.strictEqual(isMalformedTitle('note'), true)
      assert.strictEqual(isMalformedTitle('create a task'), true)
      assert.strictEqual(isMalformedTitle('save a note'), true)
      assert.strictEqual(isMalformedTitle(''), true)
      assert.strictEqual(isMalformedTitle('   '), true)
    })

    it('isMalformedTitle permits legitimate task and note titles', () => {
      assert.strictEqual(isMalformedTitle('Launch Checklist'), false)
      assert.strictEqual(isMalformedTitle('Prepare the launch demo'), false)
      assert.strictEqual(isMalformedTitle('To review the PR'), false)
      assert.strictEqual(isMalformedTitle('For team review'), false)
      assert.strictEqual(isMalformedTitle('Inside out exploration'), false)
    })
  })

  // --------------------------------------------------------------------------
  // 3. INTEGRATION TESTS: Production Chat Entry Point
  // --------------------------------------------------------------------------
  describe('3. Production Chat Entry Point (executeActionIntent)', () => {
    const buildContext = (prompt: string, overrides: Partial<ActionEngineContext> = {}): ActionEngineContext => ({
      prompt,
      tasks,
      memories: [],
      knowledge,
      workspaces,
      activeWorkspaceId,
      onAddTask: (draft: TaskDraft) => {
        const item: TaskItem = {
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: draft.title,
          priority: draft.priority ?? 'medium',
          scheduledAt: draft.scheduledAt,
          estimateMinutes: draft.estimateMinutes ?? 30,
          workspaceId: draft.workspaceId,
          completed: false,
          createdAt: new Date().toISOString(),
        }
        tasks.push(item)
        return item
      },
      onUpdateTask: (id: string, updates: Partial<TaskItem>) => {
        tasks = tasks.map((t) => (t.id === id ? { ...t, ...updates } : t))
      },
      onDeleteTask: (id: string) => {
        tasks = tasks.filter((t) => t.id !== id)
      },
      onToggleTask: (id: string) => {
        tasks = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
      },
      onAddKnowledge: (draft: Omit<KnowledgeItem, 'id' | 'createdAt'>) => {
        const item: KnowledgeItem = {
          id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: draft.title,
          content: draft.content,
          kind: draft.kind,
          tags: draft.tags ?? [],
          workspaceId: draft.workspaceId,
          createdAt: new Date().toISOString(),
        }
        knowledge.push(item)
        return item
      },
      onDeleteKnowledge: (id: string) => {
        knowledge = knowledge.filter((k) => k.id !== id)
      },
      onAddMemory: () => {},
      onDeleteMemory: () => {},
      onAddWorkspace: (draft) => {
        const id = `ws-${Date.now()}`
        const ws: WorkspaceItem = {
          id,
          name: draft.name,
          description: draft.description,
          kind: draft.kind ?? 'Project',
          createdAt: new Date().toISOString(),
        }
        workspaces.push(ws)
        return id
      },
      onDeleteWorkspace: () => {},
      onSelectWorkspace: (id) => {
        activeWorkspaceId = id
      },
      ...overrides,
    })

    it('executes exact reproduced note failure prompt and persists unpolluted record', async () => {
      const prompt =
        'Save a note in Product Launch titled Launch Checklist with the content: finalize the prototype, test the app, and prepare the demo.'
      const ctx = buildContext(prompt)

      const result = await executeActionIntent(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.entityType, 'knowledge')
      assert.strictEqual(result.verb, 'create')

      // Assert persisted record in canonical storage
      assert.strictEqual(knowledge.length, 1)
      const saved = knowledge[0]
      assert.strictEqual(saved.title, 'Launch Checklist')
      assert.strictEqual(
        saved.content,
        'finalize the prototype, test the app, and prepare the demo.'
      )
      assert.strictEqual(saved.workspaceId, 'ws-prod-launch')

      // Assert response formatting
      assert.ok(result.response.includes('Launch Checklist'))
      assert.ok(result.response.includes('Product Launch'))
      assert.ok(!result.response.includes('in Product Launch titled'))
    })

    it('executes exact reproduced task failure prompt and persists unpolluted record', async () => {
      const prompt = 'Create a task in Product Launch called Prepare the launch demo.'
      const ctx = buildContext(prompt)

      const result = await executeActionIntent(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.entityType, 'task')
      assert.strictEqual(result.verb, 'create')

      // Assert persisted record in canonical storage
      assert.strictEqual(tasks.length, 1)
      const saved = tasks[0]
      assert.strictEqual(saved.title, 'Prepare the launch demo')
      assert.strictEqual(saved.workspaceId, 'ws-prod-launch')

      // Assert response formatting
      assert.ok(result.response.includes('Prepare the launch demo'))
      assert.ok(result.response.includes('Product Launch'))
      assert.ok(!result.response.includes('in Product Launch called'))
    })

    it('creates workspace dynamically if not already existing', async () => {
      const prompt = 'Create a task in Marketing Sprint called Review copy deck.'
      const ctx = buildContext(prompt)

      const result = await executeActionIntent(ctx)

      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(tasks.length, 1)
      assert.strictEqual(tasks[0].title, 'Review copy deck')
      assert.ok(tasks[0].workspaceId)

      // Workspace should have been created
      const createdWs = workspaces.find((w) => w.name === 'Marketing Sprint')
      assert.ok(createdWs)
      assert.strictEqual(tasks[0].workspaceId, createdWs.id)
    })
  })

  // --------------------------------------------------------------------------
  // 4. DUPLICATE RETRY & MUTATION SAFETY
  // --------------------------------------------------------------------------
  describe('4. Duplicate Task Request Safety', () => {
    it('duplicate task requests do not modify existing task schedule, priority, workspace, or title', async () => {
      let addCallCount = 0
      let updateCallCount = 0

      const originalTask: TaskItem = {
        id: 'task-existing-1',
        title: 'Prepare the launch demo',
        priority: 'high',
        scheduledAt: '2026-10-30T10:00:00.000Z',
        estimateMinutes: 45,
        workspaceId: 'ws-prod-launch',
        completed: false,
        createdAt: '2026-10-25T10:00:00.000Z',
      }
      tasks = [{ ...originalTask }]

      const ctx: ActionEngineContext = {
        prompt: 'Create a task in Product Launch called Prepare the launch demo.',
        tasks,
        memories: [],
        knowledge: [],
        workspaces,
        activeWorkspaceId: null,
        onAddTask: (draft) => {
          addCallCount++
          const item: TaskItem = {
            id: 'task-new',
            title: draft.title,
            priority: draft.priority ?? 'medium',
            scheduledAt: draft.scheduledAt,
            estimateMinutes: draft.estimateMinutes ?? 30,
            workspaceId: draft.workspaceId,
            completed: false,
            createdAt: new Date().toISOString(),
          }
          tasks.push(item)
          return item
        },
        onUpdateTask: () => {
          updateCallCount++
        },
        onDeleteTask: () => {},
        onToggleTask: () => {},
        onAddKnowledge: () => {},
        onDeleteKnowledge: () => {},
        onAddMemory: () => {},
        onDeleteMemory: () => {},
        onAddWorkspace: () => {},
        onDeleteWorkspace: () => {},
        onSelectWorkspace: () => {},
      }

      const result = await executeActionIntent(ctx)

      // Neither add nor update should be called
      assert.strictEqual(addCallCount, 0, 'onAddTask should not be called on duplicate')
      assert.strictEqual(updateCallCount, 0, 'onUpdateTask should not be called on duplicate')

      // Assert response identifies duplicate
      assert.strictEqual(result.handled, true)
      assert.ok(result.response.includes('Task Already Exists'))
      assert.ok(result.response.includes('task-existing-1'))

      // Assert the original task state is strictly identical
      assert.strictEqual(tasks.length, 1)
      assert.strictEqual(tasks[0].id, originalTask.id)
      assert.strictEqual(tasks[0].title, originalTask.title)
      assert.strictEqual(tasks[0].priority, originalTask.priority)
      assert.strictEqual(tasks[0].scheduledAt, originalTask.scheduledAt)
      assert.strictEqual(tasks[0].workspaceId, originalTask.workspaceId)
    })
  })

  // --------------------------------------------------------------------------
  // 5. MALFORMED EXTRACTION & WRITE FAILURE SAFETY
  // --------------------------------------------------------------------------
  describe('5. Safe Failure Modes & Error Reporting', () => {
    it('fails safely when task input is malformed and does not persist', async () => {
      let addCallCount = 0
      const ctx: ActionEngineContext = {
        prompt: 'Create a task in Product Launch called',
        tasks: [],
        memories: [],
        knowledge: [],
        workspaces,
        activeWorkspaceId: null,
        onAddTask: () => {
          addCallCount++
        },
        onUpdateTask: () => {},
        onDeleteTask: () => {},
        onToggleTask: () => {},
        onAddKnowledge: () => {},
        onDeleteKnowledge: () => {},
        onAddMemory: () => {},
        onDeleteMemory: () => {},
        onAddWorkspace: () => {},
        onDeleteWorkspace: () => {},
        onSelectWorkspace: () => {},
      }

      const result = await executeActionIntent(ctx)

      assert.strictEqual(result.status, 'needs_confirmation')
      assert.strictEqual(addCallCount, 0, 'Should not persist malformed task')
      assert.ok(result.response.includes('What would you like the task to be titled?'))
    })

    it('fails safely when note input is malformed and does not persist', async () => {
      let addCallCount = 0
      const ctx: ActionEngineContext = {
        prompt: 'Save a note in Product Launch titled',
        tasks: [],
        memories: [],
        knowledge: [],
        workspaces,
        activeWorkspaceId: null,
        onAddTask: () => {},
        onUpdateTask: () => {},
        onDeleteTask: () => {},
        onToggleTask: () => {},
        onAddKnowledge: () => {
          addCallCount++
        },
        onDeleteKnowledge: () => {},
        onAddMemory: () => {},
        onDeleteMemory: () => {},
        onAddWorkspace: () => {},
        onDeleteWorkspace: () => {},
        onSelectWorkspace: () => {},
      }

      const result = await executeActionIntent(ctx)

      assert.strictEqual(result.status, 'needs_confirmation')
      assert.strictEqual(addCallCount, 0, 'Should not persist malformed note')
      assert.ok(result.response.includes('What would you like the note to be titled?'))
    })

    it('does not report success when task persistence fails', async () => {
      const ctx: ActionEngineContext = {
        prompt: 'Create a task in Product Launch called Prepare the launch demo.',
        tasks: [],
        memories: [],
        knowledge: [],
        workspaces,
        activeWorkspaceId: null,
        onAddTask: () => {
          throw new Error('Database connection failed')
        },
        onUpdateTask: () => {},
        onDeleteTask: () => {},
        onToggleTask: () => {},
        onAddKnowledge: () => {},
        onDeleteKnowledge: () => {},
        onAddMemory: () => {},
        onDeleteMemory: () => {},
        onAddWorkspace: () => {},
        onDeleteWorkspace: () => {},
        onSelectWorkspace: () => {},
      }

      const result = await executeActionIntent(ctx)

      assert.strictEqual(result.status, 'error')
      assert.strictEqual(result.error, 'Database connection failed')
      assert.ok(result.response.includes('Persistence Failed'))
      assert.ok(!result.response.includes('Persisted successfully'))
    })

    it('does not report success when note persistence fails', async () => {
      const ctx: ActionEngineContext = {
        prompt:
          'Save a note in Product Launch titled Launch Checklist with the content: finalize the prototype, test the app, and prepare the demo.',
        tasks: [],
        memories: [],
        knowledge: [],
        workspaces,
        activeWorkspaceId: null,
        onAddTask: () => {},
        onUpdateTask: () => {},
        onDeleteTask: () => {},
        onToggleTask: () => {},
        onAddKnowledge: () => {
          throw new Error('Disk quota exceeded')
        },
        onDeleteKnowledge: () => {},
        onAddMemory: () => {},
        onDeleteMemory: () => {},
        onAddWorkspace: () => {},
        onDeleteWorkspace: () => {},
        onSelectWorkspace: () => {},
      }

      const result = await executeActionIntent(ctx)

      assert.strictEqual(result.status, 'error')
      assert.strictEqual(result.error, 'Disk quota exceeded')
      assert.ok(result.response.includes('Persistence Failed'))
      assert.ok(!result.response.includes('Persisted successfully'))
    })
  })
})
