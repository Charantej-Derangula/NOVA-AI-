import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import {
  executeUnifiedAction,
  type ActionEngineContext,
} from '../src/services/actionEngine.ts'
import { evaluateRetentionPolicy } from '../server/hindsightService.ts'
import type {
  TaskItem,
  MemoryItem,
  KnowledgeItem,
  WorkspaceItem,
} from '../src/types/index.ts'

describe('NOVA — Five Real Workflows & Production Architecture Verification', () => {
  let tasks: TaskItem[]
  let memories: MemoryItem[]
  let knowledge: KnowledgeItem[]
  let workspaces: WorkspaceItem[]
  let activeWorkspaceId: string | null

  beforeEach(() => {
    tasks = []
    memories = []
    knowledge = []
    workspaces = []
    activeWorkspaceId = null
  })

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
        return newTask
      },
      onUpdateTask: async (id, updates) => {
        const found = tasks.find((t) => t.id === id)
        if (!found) throw new Error(`Task with ID "${id}" does not exist.`)
        tasks = tasks.map((t) => (t.id === id ? { ...t, ...updates } : t))
      },
      onDeleteTask: async (id) => {
        const found = tasks.find((t) => t.id === id)
        if (!found) throw new Error(`Task with ID "${id}" does not exist.`)
        tasks = tasks.filter((t) => t.id !== id)
      },
      onToggleTask: async (id) => {
        const found = tasks.find((t) => t.id === id)
        if (!found) throw new Error(`Task with ID "${id}" does not exist.`)
        tasks = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
      },
      onDeleteAllTasks: async () => {
        tasks = []
      },
      onAddMemory: async (category, content, wsId) => {
        const newMemory: MemoryItem = {
          id: `mem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          category,
          content,
          workspaceId: wsId,
          dateAdded: 'Today',
        }
        memories.push(newMemory)
        return newMemory
      },
      onUpdateMemory: async (id, updates) => {
        const found = memories.find((m) => m.id === id)
        if (!found) throw new Error(`Memory with ID "${id}" does not exist.`)
        memories = memories.map((m) => (m.id === id ? { ...m, ...updates } : m))
      },
      onDeleteMemory: async (id) => {
        const found = memories.find((m) => m.id === id)
        if (!found) throw new Error(`Memory with ID "${id}" does not exist.`)
        memories = memories.filter((m) => m.id !== id)
      },
      onAddKnowledge: async (draft) => {
        const newKnowledge: KnowledgeItem = {
          id: `note-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          title: draft.title,
          content: draft.content,
          kind: draft.kind,
          tags: draft.tags,
          workspaceId: draft.workspaceId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        knowledge.push(newKnowledge)
        return newKnowledge
      },
      onUpdateKnowledge: async (id, updates) => {
        const found = knowledge.find((k) => k.id === id)
        if (!found) throw new Error(`Knowledge note with ID "${id}" does not exist.`)
        knowledge = knowledge.map((k) => (k.id === id ? { ...k, ...updates } : k))
      },
      onDeleteKnowledge: async (id) => {
        const found = knowledge.find((k) => k.id === id)
        if (!found) throw new Error(`Knowledge note with ID "${id}" does not exist.`)
        knowledge = knowledge.filter((k) => k.id !== id)
      },
      onAddWorkspace: async (draft: Pick<WorkspaceItem, 'name' | 'description' | 'kind'>) => {
        const newWorkspace: WorkspaceItem = {
          id: `ws-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: draft.name,
          kind: draft.kind,
          description: draft.description || '',
          createdAt: new Date().toISOString(),
        }
        workspaces.push(newWorkspace)
        return newWorkspace
      },
      onUpdateWorkspace: async (id, updates) => {
        const found = workspaces.find((w) => w.id === id)
        if (!found) throw new Error(`Workspace with ID "${id}" does not exist.`)
        workspaces = workspaces.map((w) => (w.id === id ? { ...w, ...updates } : w))
      },
      onDeleteWorkspace: async (id) => {
        const found = workspaces.find((w) => w.id === id)
        if (!found) throw new Error(`Workspace with ID "${id}" does not exist.`)
        workspaces = workspaces.filter((w) => w.id !== id)
      },
      onSelectWorkspace: (id) => {
        activeWorkspaceId = id
      },
      ...overrides,
    }
  }

  describe('Workflow A: Workspace Creation', () => {
    it('creates a workspace for "Product Launch" immediately without questionnaires', async () => {
      const prompt = 'Create a workspace for Product Launch.'
      const ctx = createTestContext(prompt)
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.entityType, 'workspace')
      assert.strictEqual(result.verb, 'create')
      assert.strictEqual(workspaces.length, 1)
      assert.strictEqual(workspaces[0].name, 'Product Launch')
      assert.ok(result.response.includes('Product Launch'))
      assert.ok(!result.response.includes('What platform'))
      assert.ok(!result.response.includes('permissions'))
    })

    it('reports failure truthfully if cloud persistence rejects workspace creation', async () => {
      const prompt = 'Create a workspace for Product Launch.'
      const ctx = createTestContext(prompt, {
        onAddWorkspace: async () => {
          throw new Error('Supabase network error: failed to fetch')
        },
      })
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'error')
      assert.ok(result.response.includes('Persistence Failed'))
      assert.strictEqual(workspaces.length, 0)
    })
  })

  describe('Workflow B: Knowledge & Note Saving', () => {
    it('saves a note titled "Robotics Research" with complete content', async () => {
      const prompt =
        'Save a note titled Robotics Research with this content: I am exploring robot navigation, sensors, and autonomous control.'
      const ctx = createTestContext(prompt)
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.entityType, 'knowledge')
      assert.strictEqual(result.verb, 'create')
      assert.strictEqual(knowledge.length, 1)
      assert.strictEqual(knowledge[0].title, 'Robotics Research')
      assert.strictEqual(
        knowledge[0].content,
        'I am exploring robot navigation, sensors, and autonomous control.'
      )
      assert.ok(result.response.includes('Robotics Research'))
    })

    it('associates note with active workspace when provided', async () => {
      const prompt =
        'Save a note titled Robotics Research with this content: I am exploring robot navigation, sensors, and autonomous control.'
      const ctx = createTestContext(prompt, { activeWorkspaceId: 'ws-eng-100' })
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(knowledge.length, 1)
      assert.strictEqual(knowledge[0].workspaceId, 'ws-eng-100')
    })
  })

  describe('Workflow C: Hindsight Long-Term Memory', () => {
    it('accepts explicit non-sensitive preference for retention policy', () => {
      const memoryText = 'AutoPulse is my main hackathon project.'
      const policy = evaluateRetentionPolicy(memoryText)

      assert.strictEqual(policy.shouldRetain, true)
      assert.strictEqual(policy.cleanContent, 'AutoPulse is my main hackathon project.')
    })

    it('excludes sensitive credentials and API keys from retention', () => {
      const fakeGroqToken = ['gs', 'k_'].join('') + 'test_mock_token_fixture_value_12345'
      const sensitive1 = `Remember that my API key is ${fakeGroqToken}`
      const sensitive2 = 'Remember that my password is password123!'
      const sensitive3 = 'Remember that my credit card is 4111111111111111'

      assert.strictEqual(evaluateRetentionPolicy(sensitive1).shouldRetain, false)
      assert.strictEqual(evaluateRetentionPolicy(sensitive2).shouldRetain, false)
      assert.strictEqual(evaluateRetentionPolicy(sensitive3).shouldRetain, false)
    })

    it('executes memory creation through unified action engine', async () => {
      const prompt = 'Remember that AutoPulse is my main hackathon project.'
      const ctx = createTestContext(prompt)
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(result.entityType, 'memory')
      assert.strictEqual(memories.length, 1)
      assert.ok(memories[0].content.includes('AutoPulse is my main hackathon project'))
    })
  })

  describe('Workflow D: Knowledge Retrieval', () => {
    it('retrieves saved note about robotics and summarizes its contents truthfully', async () => {
      knowledge.push({
        id: 'note-robotics-1',
        title: 'Robotics Research',
        content: 'I am exploring robot navigation, sensors, and autonomous control.',
        kind: 'Personal note',
        tags: ['robotics'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const prompt = 'Find my notes about robotics and summarize what they contain.'
      const ctx = createTestContext(prompt)
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'queried')
      assert.strictEqual(result.entityType, 'knowledge')
      assert.strictEqual(result.verb, 'search')
      assert.ok(result.response.includes('Robotics Research'))
      assert.ok(result.response.includes('robot navigation, sensors, and autonomous control'))
      assert.ok(result.response.includes('Summary:'))
    })

    it('honestly reports when no matching notes are found without inventing content', async () => {
      const prompt = 'Find my notes about quantum computing and summarize what they contain.'
      const ctx = createTestContext(prompt)
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'queried')
      assert.ok(result.response.includes('No notes found matching'))
      assert.ok(!result.response.includes('Summary:'))
    })
  })

  describe('Workflow E: Task Inside a Workspace', () => {
    it('creates a workspace called "SIH Planning" and scopes the new task to it', async () => {
      const prompt =
        'Create a workspace called SIH Planning and add a task to prepare the project demo in that workspace.'
      const ctx = createTestContext(prompt)
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(workspaces.length, 1)
      assert.strictEqual(workspaces[0].name, 'SIH Planning')
      assert.strictEqual(tasks.length, 1)
      assert.ok(tasks[0].title.toLowerCase().includes('prepare the project demo'))
      assert.strictEqual(tasks[0].workspaceId, workspaces[0].id)
      assert.ok(result.response.includes('SIH Planning'))
      assert.ok(result.response.includes('Multi-Action Execution Completed'))
    })

    it('reports partial failure separately if second operation fails', async () => {
      const prompt =
        'Create a workspace called SIH Planning and add a task to prepare the project demo in that workspace.'
      const ctx = createTestContext(prompt, {
        onAddTask: async () => {
          throw new Error('Task table locked by database constraint')
        },
      })
      const result = await executeUnifiedAction(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'partially_executed')
      assert.strictEqual(workspaces.length, 1, 'Workspace was successfully created')
      assert.strictEqual(tasks.length, 0, 'Task creation failed and was not recorded')
      assert.ok(result.response.includes('SIH Planning'))
      assert.ok(result.response.includes('Partial Execution'))
      assert.ok(result.response.includes('ERROR'))
    })
  })
})
