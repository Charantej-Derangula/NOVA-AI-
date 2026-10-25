import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  executeActionIntent,
  cleanTaskTitle,
  type ActionEngineContext,
  type TaskItem,
  type KnowledgeItem,
  type WorkspaceItem,
  type MemoryItem,
} from '../src/services/actionEngine.ts'
import { getBankIdForUser } from '../server/hindsightService.ts'
import { getPathForTab } from '../src/router/index.ts'
import { displayTime } from '../src/utils/dateTime.ts'

const rootDir = path.resolve(import.meta.dirname, '..')

describe('Conversational Action-Execution, Persistence & Mobile Navigation Suite', () => {
  const appSrc = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf-8')
  const appCss = fs.readFileSync(path.join(rootDir, 'src/App.css'), 'utf-8')

  // Shared test fixtures
  const createMockContext = (overrides?: Partial<ActionEngineContext>): {
    ctx: ActionEngineContext
    tasks: TaskItem[]
    memories: MemoryItem[]
    knowledge: KnowledgeItem[]
    workspaces: WorkspaceItem[]
    activeWorkspaceId: string | null
  } => {
    const tasks: TaskItem[] = []
    const memories: MemoryItem[] = []
    const knowledge: KnowledgeItem[] = []
    const workspaces: WorkspaceItem[] = []
    let activeWorkspaceId: string | null = null

    const ctx: ActionEngineContext = {
      prompt: '',
      tasks,
      memories,
      knowledge,
      workspaces,
      activeWorkspaceId,
      onAddTask: async (draft) => {
        const newTask: TaskItem = {
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: draft.title,
          completed: false,
          priority: draft.priority,
          scheduledAt: draft.scheduledAt,
          estimateMinutes: draft.estimateMinutes,
          createdAt: new Date().toISOString(),
          workspaceId: draft.workspaceId || undefined,
        }
        tasks.push(newTask)
        return newTask
      },
      onUpdateTask: async (id, updates) => {
        const idx = tasks.findIndex((t) => t.id === id)
        if (idx !== -1) {
          tasks[idx] = { ...tasks[idx], ...updates }
        }
      },
      onDeleteTask: async (id) => {
        const idx = tasks.findIndex((t) => t.id === id)
        if (idx !== -1) tasks.splice(idx, 1)
      },
      onToggleTask: async (id) => {
        const t = tasks.find((item) => item.id === id)
        if (t) t.completed = !t.completed
      },
      onDeleteAllTasks: async () => {
        tasks.length = 0
      },
      onAddMemory: async (category, content, workspaceId) => {
        const newMemory: MemoryItem = {
          id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          category,
          content,
          dateAdded: 'Oct 26, 2026',
          createdAt: new Date().toISOString(),
          workspaceId: workspaceId || undefined,
        }
        memories.push(newMemory)
        return newMemory
      },
      onUpdateMemory: async (id, updates) => {
        const idx = memories.findIndex((m) => m.id === id)
        if (idx !== -1) memories[idx] = { ...memories[idx], ...updates }
      },
      onDeleteMemory: async (id) => {
        const idx = memories.findIndex((m) => m.id === id)
        if (idx !== -1) memories.splice(idx, 1)
      },
      onAddKnowledge: async (draft) => {
        const newNote: KnowledgeItem = {
          id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: draft.title,
          content: draft.content,
          kind: draft.kind,
          tags: draft.tags || [],
          workspaceId: draft.workspaceId || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        knowledge.push(newNote)
        return newNote
      },
      onUpdateKnowledge: async (id, updates) => {
        const idx = knowledge.findIndex((k) => k.id === id)
        if (idx !== -1) knowledge[idx] = { ...knowledge[idx], ...updates }
      },
      onDeleteKnowledge: async (id) => {
        const idx = knowledge.findIndex((k) => k.id === id)
        if (idx !== -1) knowledge.splice(idx, 1)
      },
      onAddWorkspace: async (draft) => {
        const newWs: WorkspaceItem = {
          id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: draft.name,
          description: draft.description || '',
          kind: draft.kind,
          createdAt: new Date().toISOString(),
        }
        workspaces.push(newWs)
        activeWorkspaceId = newWs.id
        return newWs.id
      },
      onUpdateWorkspace: async (id, updates) => {
        const idx = workspaces.findIndex((w) => w.id === id)
        if (idx !== -1) workspaces[idx] = { ...workspaces[idx], ...updates }
      },
      onDeleteWorkspace: async (id) => {
        const idx = workspaces.findIndex((w) => w.id === id)
        if (idx !== -1) workspaces.splice(idx, 1)
        if (activeWorkspaceId === id) activeWorkspaceId = null
      },
      onSelectWorkspace: (id) => {
        activeWorkspaceId = id
      },
      ...overrides,
    }

    return { ctx, tasks, memories, knowledge, workspaces, activeWorkspaceId }
  }

  // A. Tasks and Reminders
  describe('A. Tasks and Reminders Conversational Pipeline', () => {
    test('natural-language task creation: "create a grocery task at 8:00 AM" creates and persists task', async () => {
      const { ctx, tasks } = createMockContext()
      ctx.prompt = 'create a grocery task at 8:00 AM'

      const result = await executeActionIntent(ctx)

      assert.strictEqual(result.handled, true, 'Action must be handled by action engine')
      assert.strictEqual(result.status, 'executed', 'Status must be executed')
      assert.ok(result.recordId, 'Must return a real task identifier')
      assert.match(result.response, /✓ \*\*Task Created & Persisted\*\*/, 'Response must confirm genuine persistence')
      assert.match(result.response, /Buy groceries|Grocery/i, 'Response must mention groceries title')

      // Authoritative store verification
      assert.strictEqual(tasks.length, 1, 'Task must appear in authoritative tasks store')
      assert.strictEqual(tasks[0].id, result.recordId, 'Authoritative task ID must match returned record ID')
      assert.match(tasks[0].title, /Buy groceries|Grocery/i, 'Task title must be clean')
      assert.ok(tasks[0].scheduledAt, 'Task must have scheduledAt time')
      assert.match(displayTime(tasks[0].scheduledAt), /8:00\s*AM/i, 'Scheduled time must be 8:00 AM')
    })

    test('natural-language task creation: "set a task for you to buy groceries at 8 AM"', async () => {
      const { ctx, tasks } = createMockContext()
      ctx.prompt = 'set a task for you to buy groceries at 8 AM'

      const result = await executeActionIntent(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.ok(result.recordId)
      assert.strictEqual(tasks.length, 1)
      assert.strictEqual(tasks[0].title.toLowerCase(), 'buy groceries')
      assert.match(displayTime(tasks[0].scheduledAt), /8:00\s*AM/i)
    })

    test('natural-language task creation: "add buy groceries at 8 AM to my tasks"', async () => {
      const { ctx, tasks } = createMockContext()
      ctx.prompt = 'add buy groceries at 8 AM to my tasks'

      const result = await executeActionIntent(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(tasks.length, 1)
      assert.strictEqual(tasks[0].title.toLowerCase(), 'buy groceries')
    })

    test('natural-language task creation: "task: buy groceries at 8 AM"', async () => {
      const { ctx, tasks } = createMockContext()
      ctx.prompt = 'task: buy groceries at 8 AM'

      const result = await executeActionIntent(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.strictEqual(tasks.length, 1)
      assert.strictEqual(tasks[0].title.toLowerCase(), 'buy groceries')
    })

    test('failed persistence reports failure truthfully and never claims false success', async () => {
      const { ctx, tasks } = createMockContext({
        onAddTask: async () => {
          throw new Error('Supabase database connection timed out (504 Gateway Timeout)')
        },
      })
      ctx.prompt = 'create a grocery task at 8:00 AM'

      const result = await executeActionIntent(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'error', 'Status must be error on persistence failure')
      assert.match(result.response, /⚠️ \*\*Persistence Failed:\*\*/, 'Must clearly report persistence failure')
      assert.doesNotMatch(result.response, /✓ \*\*Task Created/, 'Must never report success on failed persistence')
      assert.strictEqual(tasks.length, 0, 'No task must be added to authoritative store')
    })

    test('cleanTaskTitle parses descriptors and scheduled times accurately', () => {
      const title1 = cleanTaskTitle('create a grocery task at 8:00 AM')
      assert.match(title1, /Buy groceries|Grocery/i)

      const title2 = cleanTaskTitle('set a task for you to buy groceries at 8 AM')
      assert.strictEqual(title2.toLowerCase(), 'buy groceries')

      const title3 = cleanTaskTitle('add finish project roadmap to my tasks')
      assert.strictEqual(title3.toLowerCase(), 'finish project roadmap')
    })
  })

  // B. Workspaces
  describe('B. Workspaces Conversational Pipeline', () => {
    test('creates workspace conversationally and persists it', async () => {
      const { ctx, workspaces } = createMockContext()
      ctx.prompt = 'create a workspace for Product Launch'

      const result = await executeActionIntent(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.ok(result.recordId)
      assert.match(result.response, /✓ \*\*Workspace Created & Persisted:\*\*/, 'Must confirm persistence')
      assert.strictEqual(workspaces.length, 1)
      assert.strictEqual(workspaces[0].name, 'Product Launch')
      assert.strictEqual(workspaces[0].id, result.recordId)
    })

    test('workspace creation with empty name requests name rather than failing or inventing one', async () => {
      const { ctx, workspaces } = createMockContext()
      ctx.prompt = 'create a workspace'

      const result = await executeActionIntent(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'needs_confirmation')
      assert.match(result.response, /What would you like to name your new workspace\?/i)
      assert.strictEqual(workspaces.length, 0)
    })
  })

  // C. Knowledge
  describe('C. Knowledge & Notes Conversational Pipeline', () => {
    test('saves note conversationally, returns real identifier, and enables subsequent retrieval', async () => {
      const { ctx, knowledge } = createMockContext()
      ctx.prompt = 'save a note titled Robotics Architecture with content: Micro-ROS communicates over UDP.'

      const result = await executeActionIntent(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.ok(result.recordId)
      assert.match(result.response, /✓ \*\*Note Saved & Persisted\*\*/)
      assert.strictEqual(knowledge.length, 1)
      assert.strictEqual(knowledge[0].title, 'Robotics Architecture')
      assert.strictEqual(knowledge[0].content, 'Micro-ROS communicates over UDP.')

      // Subsequent retrieval
      ctx.prompt = 'search note Robotics Architecture'
      const searchResult = await executeActionIntent(ctx)
      assert.strictEqual(searchResult.handled, true)
      assert.strictEqual(searchResult.status, 'queried')
      assert.match(searchResult.response, /Micro-ROS communicates over UDP\./)
    })
  })

  // D. Memory & Isolation
  describe('D. Memory & Isolation Pipeline', () => {
    test('saves memory conversationally and retrieves it truthfully', async () => {
      const { ctx, memories } = createMockContext()
      ctx.prompt = 'Remember that I prefer TypeScript over JavaScript.'

      const result = await executeActionIntent(ctx)

      assert.strictEqual(result.handled, true)
      assert.strictEqual(result.status, 'executed')
      assert.ok(result.recordId)
      assert.match(result.response, /✓ \*\*Memory Saved & Persisted\*\*/)
      assert.strictEqual(memories.length, 1)
      assert.match(memories[0].content, /I prefer TypeScript over JavaScript/i)
      assert.strictEqual(memories[0].category, 'Preferences')

      // List memories
      ctx.prompt = 'what do you remember'
      const listResult = await executeActionIntent(ctx)
      assert.strictEqual(listResult.handled, true)
      assert.match(listResult.response, /TypeScript over JavaScript/i)
    })

    test('user and guest memory bank isolation prevents cross-user memory leakage', () => {
      const userA = 'user-uuid-1111'
      const userB = 'user-uuid-2222'
      const guestSession = 'guest-session-3333'

      const bankA = getBankIdForUser(userA, false)
      const bankB = getBankIdForUser(userB, false)
      const guestBank = getBankIdForUser(null, true, guestSession)

      assert.strictEqual(bankA, 'nova-usr-user-uuid-1111')
      assert.strictEqual(bankB, 'nova-usr-user-uuid-2222')
      assert.strictEqual(guestBank, 'nova-gst-guest-session-3333')

      assert.notStrictEqual(bankA, bankB, 'Different users must have strictly different memory banks')
      assert.notStrictEqual(bankA, guestBank, 'Guest bank must never collide with authenticated user bank')
    })

    test('sign-out in App.tsx resets in-memory data to prevent cross-user leakage', () => {
      assert.match(appSrc, /const handleSignOutApp = async \(\) =>/)
      assert.match(appSrc, /setTasks\(\[\]\)/)
      assert.match(appSrc, /setMemories\(\[\]\)/)
      assert.match(appSrc, /setKnowledge\(\[\]\)/)
      assert.match(appSrc, /setWorkspaces\(\[\]\)/)
      assert.match(appSrc, /setSessions\(\[\]\)/)
      assert.match(appSrc, /setActiveWorkspaceId\(null\)/)
    })
  })

  // E. Non-hallucination System Boundary
  describe('E. Non-Hallucination Guardrails', () => {
    test('App.tsx strictly forbids LLM from fabricating action execution in systemInstruction', () => {
      assert.match(appSrc, /CRITICAL SYSTEM BOUNDARY/)
      assert.match(appSrc, /Real application operations \(creating, updating, or deleting tasks, workspaces, notes, and memories\) are executed exclusively by the authoritative system action engine/)
      assert.match(appSrc, /You must NEVER claim, promise, or hallucinate that you have created, scheduled, saved, or updated a task, workspace, note, or memory item/)
      assert.doesNotMatch(appSrc, /execute immediately with sensible defaults/)
    })
  })

  // F. Mobile Bottom Navigation
  describe('F. Mobile Bottom Navigation: Overview Tab', () => {
    test('mobile navigation renders Home, Overview, My Day, Tasks, Settings', () => {
      assert.match(appSrc, /\['home',\s*'Home'\],\s*\['dashboard',\s*'Overview'\],\s*\['my-day',\s*'My Day'\],\s*\['tasks',\s*'Tasks'\],\s*\['settings',\s*'Settings'\]/)
    })

    test('getPathForTab("dashboard") returns "/overview"', () => {
      assert.strictEqual(getPathForTab('dashboard'), '/overview')
    })

    test('mobile tabbar buttons have even 20% width and responsive safe-area positioning', () => {
      assert.match(appCss, /\.mobile-tabbar button\{[^}]*width:20%/)
      assert.match(appCss, /bottom:max\(\d+px,env\(safe-area-inset-bottom\)\)/)
    })

    test('active mobile tabbar SVG icon receives signature purple glow', () => {
      assert.match(appCss, /\.mobile-tabbar button\.current svg/)
      assert.match(appCss, /#d7a7ff/)
    })

    test('Chat functionality remains fully accessible on desktop sidebar, topbar, and direct route', () => {
      // Desktop sidebar
      const sidebarSrc = fs.readFileSync(path.join(rootDir, 'src/components/Sidebar.tsx'), 'utf-8')
      assert.match(sidebarSrc, /onSelectTab\('chat'\)/)
      // Topbar new chat button
      const headerSrc = fs.readFileSync(path.join(rootDir, 'src/components/Header.tsx'), 'utf-8')
      assert.match(headerSrc, /topbar-new-chat/)
      // Route /chat
      assert.strictEqual(getPathForTab('chat'), '/chat')
    })
  })
})
