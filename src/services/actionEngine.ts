import type {
  TaskItem,
  TaskDraft,
  MemoryItem,
  KnowledgeItem,
  WorkspaceItem,
  AttachmentItem,
} from '../types/index.ts'

export type {
  TaskItem,
  TaskDraft,
  MemoryItem,
  KnowledgeItem,
  WorkspaceItem,
  AttachmentItem,
}
import {
  formatTaskSchedule,
  isOnLocalDate,
  localDateKey,
  toDateTimeInput,
  fromDateTimeInput,
  isDateOnly,
  parseDateValue,
} from '../utils/dateTime.ts'
import {
  retainMemory,
  deleteMemory,
  recallMemories,
  reflectMemories,
  isReflectionQuery,
  type HindsightClientMemoryItem,
} from './hindsightClient.ts'

export type ActionEntityType =
  | 'task'
  | 'knowledge'
  | 'memory'
  | 'workspace'
  | 'integration'
  | 'document'

export type ActionVerb =
  | 'create'
  | 'list'
  | 'complete'
  | 'uncomplete'
  | 'update'
  | 'delete'
  | 'switch'
  | 'search'
  | 'get'
  | 'sync'
  | 'execute'

export interface ActionPlan {
  entity: ActionEntityType
  verb: ActionVerb
  rawPrompt: string
  title?: string
  content?: string
  category?: string
  kind?: KnowledgeItem['kind']
  tags?: string[]
  scheduledAt?: string
  priority?: TaskItem['priority']
  estimateMinutes?: number
  workspaceId?: string | null
  workspaceName?: string
  targetId?: string
  targetQuery?: string
  updates?: Record<string, unknown>
  integration?: string
  integrationAction?: string
  documentName?: string
  isDestructiveAll?: boolean
  isConfirmed?: boolean
  isConversationalPreference?: boolean
  filter?: 'all' | 'overdue' | 'today' | 'pending' | 'completed' | 'upcoming'
  isReminder?: boolean
  isDuplicateDelete?: boolean
}

export interface ActionResult {
  handled: boolean
  requiresAiFollowup?: boolean
  cleanPromptForAi?: string
  response: string
  entityType?: ActionEntityType
  verb?: ActionVerb
  recordId?: string
  status: 'executed' | 'partially_executed' | 'queried' | 'needs_confirmation' | 'error' | 'none'
  error?: string
  subResults?: ActionResult[]
  retrievedContext?: RetrievedContext
}

export interface RetrievedContext {
  relevantTasks: TaskItem[]
  relevantNotes: KnowledgeItem[]
  relevantMemories: MemoryItem[]
  relevantWorkspaces: WorkspaceItem[]
  activeWorkspace: WorkspaceItem | null
  formattedContextPrompt: string
  totalMatches: number
}

export interface ActionEngineContext {
  prompt: string
  tasks: TaskItem[]
  memories: MemoryItem[]
  knowledge: KnowledgeItem[]
  workspaces: WorkspaceItem[]
  activeWorkspaceId: string | null
  attachment?: AttachmentItem
  currentUser?: { id: string; email?: string } | null
  onAddTask: (draft: TaskDraft) => Promise<TaskItem | void> | TaskItem | void
  onUpdateTask: (id: string, updates: Partial<TaskItem>) => Promise<void> | void
  onDeleteTask: (id: string) => Promise<void> | void
  onToggleTask: (id: string) => Promise<void> | void
  onDeleteAllTasks?: () => Promise<void> | void
  onAddMemory: (category: string, content: string, workspaceId?: string) => Promise<MemoryItem | void> | MemoryItem | void
  onUpdateMemory?: (id: string, updates: Partial<MemoryItem>) => Promise<void> | void
  onDeleteMemory: (id: string) => Promise<void> | void
  onAddKnowledge: (draft: Omit<KnowledgeItem, 'id' | 'createdAt'>) => Promise<KnowledgeItem | void> | KnowledgeItem | void
  onUpdateKnowledge?: (id: string, updates: Partial<KnowledgeItem>) => Promise<void> | void
  onDeleteKnowledge: (id: string) => Promise<void> | void
  onAddWorkspace: (draft: Pick<WorkspaceItem, 'name' | 'description' | 'kind'>) => Promise<string | void> | string | void
  onUpdateWorkspace?: (id: string, updates: Partial<WorkspaceItem>) => Promise<void> | void
  onDeleteWorkspace: (id: string) => Promise<void> | void
  onSelectWorkspace: (id: string | null) => void
}

export interface ToolPropertySchema {
  type: string
  description: string
  enum?: string[]
  items?: { type: string }
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, ToolPropertySchema>
    required: string[]
  }
}

/**
 * Standard typed JSON schema definitions for supported NOVA tools.
 * Can be exposed to LLMs supporting function calling (Groq, Gemini, etc.).
 */
export const novaToolDefinitions: ToolDefinition[] = [
  {
    name: 'create_task',
    description: 'Create and persist a new task in NOVA with scheduling, priority, and optional workspace association.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Clear, actionable title of the task.' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Urgency priority of the task.' },
        scheduledAt: { type: 'string', description: 'Calendar date (YYYY-MM-DD) or ISO datetime in the user local timezone.' },
        estimateMinutes: { type: 'number', description: 'Estimated duration in minutes (e.g. 15, 30, 60).' },
        workspaceId: { type: 'string', description: 'Optional workspace ID to assign this task to.' },
        workspaceName: { type: 'string', description: 'Optional workspace name (e.g. "Product Launch") to assign this task to.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List user tasks from the canonical store filtered by schedule, completion state, or workspace.',
    parameters: {
      type: 'object',
      properties: {
        filter: { type: 'string', enum: ['all', 'today', 'pending', 'completed', 'overdue'], description: 'Task filter scope.' },
        workspaceId: { type: 'string', description: 'Optional workspace ID to filter tasks by.' },
        workspaceName: { type: 'string', description: 'Optional workspace name to filter tasks by.' },
        query: { type: 'string', description: 'Optional search query matching task titles.' },
      },
      required: [],
    },
  },
  {
    name: 'complete_task',
    description: 'Mark a task as completed or toggle its completion status.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The unique task ID or unambiguous title snippet to toggle.' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'update_task',
    description: 'Update properties of an existing task such as title, priority, schedule, or workspace.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The unique ID of the task to update.' },
        title: { type: 'string', description: 'New title for the task.' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'New priority level.' },
        scheduledAt: { type: 'string', description: 'Updated schedule timestamp or date.' },
        estimateMinutes: { type: 'number', description: 'Updated duration estimate in minutes.' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a single task permanently from the user store.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID or unambiguous title of the task to delete.' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'delete_all_tasks',
    description: 'Clear all tasks for the user. Requires explicit confirmation.',
    parameters: {
      type: 'object',
      properties: {
        confirmed: { type: 'boolean', description: 'Must be true to authorize deletion.' },
      },
      required: ['confirmed'],
    },
  },
  {
    name: 'save_note',
    description: 'Save or create a note in the Knowledge base with title, rich content, kind, and tags.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title or subject of the note.' },
        content: { type: 'string', description: 'Detailed content or summary of the note.' },
        body: { type: 'string', description: 'Alternative alias for content: the body or text of the note.' },
        kind: { type: 'string', enum: ['Project notes', 'Reference', 'Personal note'], description: 'Classification of note.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags or category labels for indexing.' },
        workspaceId: { type: 'string', description: 'Optional workspace ID to associate the note with.' },
        workspaceName: { type: 'string', description: 'Optional workspace name (e.g. "Product Launch") to associate the note with.' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'search_notes',
    description: 'Search existing knowledge base and notes by keywords, titles, or tags.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords to search across notes.' },
        workspaceId: { type: 'string', description: 'Optional workspace filter.' },
        workspaceName: { type: 'string', description: 'Optional workspace name filter.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'delete_note',
    description: 'Permanently remove a note from Knowledge base by ID or title.',
    parameters: {
      type: 'object',
      properties: {
        noteId: { type: 'string', description: 'The ID or unambiguous title of the note to remove.' },
      },
      required: ['noteId'],
    },
  },
  {
    name: 'save_memory',
    description: 'Save an important long-term fact, preference, or context detail into NOVA memory bank.',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The fact, rule, or preference to remember.' },
        category: { type: 'string', enum: ['Preferences', 'Work', 'Personal', 'Context'], description: 'Category grouping.' },
        workspaceId: { type: 'string', description: 'Optional workspace ID scoping this memory.' },
      },
      required: ['content'],
    },
  },
  {
    name: 'list_memories',
    description: 'List saved memory items from the user memory bank.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional category filter.' },
      },
      required: [],
    },
  },
  {
    name: 'delete_memory',
    description: 'Forget or remove a specific memory entry by ID or matching text.',
    parameters: {
      type: 'object',
      properties: {
        memoryId: { type: 'string', description: 'The ID or matching phrase of the memory to forget.' },
      },
      required: ['memoryId'],
    },
  },
  {
    name: 'create_workspace',
    description: 'Create a new dedicated workspace for organizing tasks, notes, and chats.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the workspace.' },
        description: { type: 'string', description: 'Short summary of the workspace purpose.' },
        kind: { type: 'string', enum: ['Project', 'Personal', 'Topic', 'Research', 'Engineering'], description: 'Workspace category.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'switch_workspace',
    description: 'Switch the active workspace to scope subsequent operations.',
    parameters: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'The ID or name of the workspace to activate.' },
      },
      required: ['workspaceId'],
    },
  },
  {
    name: 'update_workspace',
    description: 'Rename or update metadata of an existing workspace.',
    parameters: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'The ID of the workspace to update.' },
        name: { type: 'string', description: 'New name for the workspace.' },
        description: { type: 'string', description: 'Updated description.' },
      },
      required: ['workspaceId'],
    },
  },
  {
    name: 'delete_workspace',
    description: 'Delete a workspace, safely re-scoping its child records back to personal lists.',
    parameters: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'The ID of the workspace to remove.' },
      },
      required: ['workspaceId'],
    },
  },
  {
    name: 'execute_integration_action',
    description: 'Execute an external third-party service action (e.g. Google Calendar, GitHub, Slack, Linear).',
    parameters: {
      type: 'object',
      properties: {
        integration: { type: 'string', enum: ['google_calendar', 'github', 'slack', 'linear'], description: 'Target external service.' },
        action: { type: 'string', description: 'The specific operation to trigger on the service.' },
      },
      required: ['integration', 'action'],
    },
  },
]

/**
 * Validate arguments against tool definition schemas.
 */
export function validateToolArguments(
  toolName: string,
  args: Record<string, unknown>
): { valid: boolean; error?: string; cleanedArgs?: Record<string, unknown> } {
  const def = novaToolDefinitions.find((t) => t.name === toolName)
  if (!def) {
    return { valid: false, error: `Unknown tool "${toolName}".` }
  }

  const normalizedArgs: Record<string, unknown> = { ...args }

  // Normalize parameter aliases for robust tool execution
  if (toolName === 'save_note') {
    if (!normalizedArgs.title && (normalizedArgs.name || normalizedArgs.subject || normalizedArgs.heading)) {
      normalizedArgs.title = normalizedArgs.name || normalizedArgs.subject || normalizedArgs.heading
    }
    if (!normalizedArgs.content && (normalizedArgs.body || normalizedArgs.text || normalizedArgs.note || normalizedArgs.description)) {
      normalizedArgs.content = normalizedArgs.body || normalizedArgs.text || normalizedArgs.note || normalizedArgs.description
    }
    if (!normalizedArgs.body && normalizedArgs.content) {
      normalizedArgs.body = normalizedArgs.content
    }
    if (!normalizedArgs.content && normalizedArgs.title) {
      normalizedArgs.content = normalizedArgs.title
    }
    if (normalizedArgs.kind && typeof normalizedArgs.kind === 'string') {
      const k = normalizedArgs.kind.trim().toLowerCase()
      if (k === 'personal note' || k === 'personal') normalizedArgs.kind = 'Personal note'
      else if (k === 'reference') normalizedArgs.kind = 'Reference'
      else if (k === 'project notes' || k === 'project' || k === 'project note') normalizedArgs.kind = 'Project notes'
    }
    if (normalizedArgs.workspaceName && typeof normalizedArgs.workspaceName === 'string') {
      if (/^(?:my\s+)?personal(?:\s+(?:notes?|space))?$/i.test(normalizedArgs.workspaceName.trim())) {
        normalizedArgs.workspaceName = undefined
        if (!normalizedArgs.kind) normalizedArgs.kind = 'Personal note'
      }
    }
  } else if (toolName === 'create_task') {
    if (!normalizedArgs.title && (normalizedArgs.name || normalizedArgs.task || normalizedArgs.text)) {
      normalizedArgs.title = normalizedArgs.name || normalizedArgs.task || normalizedArgs.text
    }
    if (normalizedArgs.priority && typeof normalizedArgs.priority === 'string') {
      const p = normalizedArgs.priority.trim().toLowerCase()
      if (p === 'urgent' || p === 'high') normalizedArgs.priority = 'high'
      else if (p === 'medium' || p === 'normal') normalizedArgs.priority = 'medium'
      else if (p === 'low') normalizedArgs.priority = 'low'
    }
  } else if (toolName === 'delete_task') {
    if (!normalizedArgs.taskId && (normalizedArgs.id || normalizedArgs.task_id)) {
      normalizedArgs.taskId = normalizedArgs.id || normalizedArgs.task_id
    }
  } else if (toolName === 'delete_note') {
    if (!normalizedArgs.noteId && (normalizedArgs.id || normalizedArgs.note_id)) {
      normalizedArgs.noteId = normalizedArgs.id || normalizedArgs.note_id
    }
  } else if (toolName === 'save_memory') {
    if (!normalizedArgs.content && (normalizedArgs.memory || normalizedArgs.text || normalizedArgs.fact)) {
      normalizedArgs.content = normalizedArgs.memory || normalizedArgs.text || normalizedArgs.fact
    }
  }

  const cleanedArgs: Record<string, unknown> = {}
  for (const req of def.parameters.required) {
    if (normalizedArgs[req] === undefined || normalizedArgs[req] === null || String(normalizedArgs[req]).trim() === '') {
      return { valid: false, error: `Missing required argument "${req}" for tool "${toolName}".` }
    }
  }

  for (const [key, prop] of Object.entries(def.parameters.properties)) {
    if (normalizedArgs[key] !== undefined && normalizedArgs[key] !== null) {
      if (prop.type === 'string' && typeof normalizedArgs[key] !== 'string') {
        cleanedArgs[key] = String(normalizedArgs[key])
      } else if (prop.type === 'number' && typeof normalizedArgs[key] !== 'number') {
        const parsed = Number(normalizedArgs[key])
        if (Number.isNaN(parsed)) {
          return { valid: false, error: `Argument "${key}" must be a valid number.` }
        }
        cleanedArgs[key] = parsed
      } else if (prop.type === 'boolean' && typeof normalizedArgs[key] !== 'boolean') {
        cleanedArgs[key] = Boolean(normalizedArgs[key])
      } else {
        cleanedArgs[key] = normalizedArgs[key]
      }

      if (prop.enum && typeof cleanedArgs[key] === 'string' && !prop.enum.includes(cleanedArgs[key] as string)) {
        return {
          valid: false,
          error: `Argument "${key}" must be one of: ${prop.enum.join(', ')}.`,
        }
      }
    }
  }

  return { valid: true, cleanedArgs }
}

export interface IntegrationConnector {
  id: string
  name: string
  displayName: string
  description: string
  connected: boolean
  supportedActions: string[]
}

/**
 * Inspect connected external integrations and report real, verified capability status.
 * Prevents simulated success for disconnected third-party services.
 */
export function getAvailableIntegrations(): IntegrationConnector[] {
  return [
    {
      id: 'google_calendar',
      name: 'google_calendar',
      displayName: 'Google Calendar',
      description: 'Sync scheduled tasks and events with your Google Calendar.',
      connected: false,
      supportedActions: ['sync_tasks', 'create_event', 'list_events'],
    },
    {
      id: 'github',
      name: 'github',
      displayName: 'GitHub',
      description: 'Connect repository issues, pull requests, and project boards.',
      connected: false,
      supportedActions: ['create_issue', 'list_issues', 'sync_prs'],
    },
    {
      id: 'slack',
      name: 'slack',
      displayName: 'Slack',
      description: 'Post updates, summaries, and notifications to your Slack channels.',
      connected: false,
      supportedActions: ['send_message', 'post_summary'],
    },
    {
      id: 'linear',
      name: 'linear',
      displayName: 'Linear',
      description: 'Create and sync issues in Linear project workspaces.',
      connected: false,
      supportedActions: ['create_issue', 'sync_issues'],
    },
  ]
}

export function checkIntegrationStatus(name: string): {
  connector?: IntegrationConnector
  isAvailable: boolean
  message: string
} {
  const norm = name.toLowerCase().replace(/[\s-_]+/g, '_')
  const integrations = getAvailableIntegrations()
  const found = integrations.find(
    (i) => i.id === norm || i.name === norm || i.displayName.toLowerCase().includes(name.toLowerCase())
  )

  if (!found) {
    return {
      isAvailable: false,
      message: `Unsupported integration service "${name}". Supported services: ${integrations.map((i) => i.displayName).join(', ')}.`,
    }
  }

  if (!found.connected) {
    return {
      connector: found,
      isAvailable: false,
      message: `⚠️ **Integration Not Connected:** ${found.displayName} is not currently connected to NOVA. To execute this action, configure and authorize ${found.displayName} in Settings > Supported Providers.`,
    }
  }

  return {
    connector: found,
    isAvailable: true,
    message: `${found.displayName} is connected and ready.`,
  }
}

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'to', 'for', 'of', 'in',
  'with', 'about', 'my', 'your', 'our', 'what', 'are', 'do', 'i', 'have', 'show', 'list',
  'left', 'me', 'can', 'you', 'please', 'tell', 'get', 'give', 'any', 'from', 'all',
  'this', 'that', 'these', 'those', 'some', 'now', 'be', 'by', 'as', 'so', 'it', 'if',
])

function extractQueryTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w))
}

/**
 * Shared Context Retrieval Mechanism.
 * Retrieves only authorized, strictly relevant records from the current user data
 * based on semantic tokens, active workspace, schedule dates, and relevance scores.
 * Never dumps the entire database or unrelated user records.
 */
export function retrieveActionContext(options: {
  prompt: string
  tasks: TaskItem[]
  memories: MemoryItem[]
  knowledge: KnowledgeItem[]
  workspaces: WorkspaceItem[]
  activeWorkspaceId: string | null
  maxItemsPerCategory?: number
}): RetrievedContext {
  const {
    prompt,
    tasks,
    memories,
    knowledge,
    workspaces,
    activeWorkspaceId,
    maxItemsPerCategory = 4,
  } = options

  const lowerPrompt = prompt.toLowerCase()
  const tokens = extractQueryTokens(prompt)
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || null

  // 1. Filter & Score Relevant Workspaces
  const relevantWorkspaces: WorkspaceItem[] = []
  if (activeWorkspace) {
    relevantWorkspaces.push(activeWorkspace)
  }
  for (const ws of workspaces) {
    if (ws.id !== activeWorkspaceId) {
      const wsLower = ws.name.toLowerCase()
      if (lowerPrompt.includes(wsLower) || tokens.some((t) => wsLower.includes(t))) {
        relevantWorkspaces.push(ws)
      }
    }
  }

  // 2. Filter & Score Relevant Tasks
  const isAskingTasks =
    /\b(tasks?|todos?|schedule|pending|left|incomplete|my\s+day|upcoming)\b/i.test(lowerPrompt)
  const isPendingRequested = /\b(left|pending|incomplete|to\s*do|unfinished)\b/i.test(lowerPrompt)
  const isTodayRequested = /\b(today|now)\b/i.test(lowerPrompt)
  const today = new Date()

  const TASK_CONTROL_WORDS = new Set([
    'task', 'tasks', 'todo', 'todos', 'pending', 'left', 'incomplete', 'schedule', 'today', 'upcoming'
  ])
  const topicalTaskTokens = tokens.filter((t) => !TASK_CONTROL_WORDS.has(t))

  const scoredTasks = tasks.map((t) => {
    let score = 0
    const titleLower = t.title.toLowerCase()

    let hasTopicalMatch = false
    if (topicalTaskTokens.length > 0) {
      for (const token of topicalTaskTokens) {
        if (titleLower.includes(token)) {
          score += 5
          hasTopicalMatch = true
        }
      }
    }

    let hasWorkspaceMatch = false
    if (t.workspaceId && t.workspaceId === activeWorkspaceId) {
      score += 2
      hasWorkspaceMatch = true
    }
    for (const ws of relevantWorkspaces) {
      if (t.workspaceId === ws.id) {
        score += 4
        hasWorkspaceMatch = true
      }
    }

    // Only boost pending / today if there is a topical match, a workspace match, or if no specific topical tokens were requested
    if (topicalTaskTokens.length === 0 || hasTopicalMatch || hasWorkspaceMatch) {
      if (isTodayRequested && isOnLocalDate(t.scheduledAt, today)) score += 3
      if (isPendingRequested && !t.completed) score += 2
      if (!t.completed) score += 1
    }

    return { task: t, score }
  })

  const matchingTasks = scoredTasks
    .filter((st) => (topicalTaskTokens.length > 0 ? st.score >= 5 : isAskingTasks ? st.score >= 1 : st.score >= 3))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItemsPerCategory)
    .map((st) => st.task)

  // 3. Filter & Score Relevant Knowledge & Notes
  const isAskingNotes =
    /\b(notes?|knowledge|doc|docs|documentation|summary|summarize|guide|spec)\b/i.test(lowerPrompt)

  const NOTE_CONTROL_WORDS = new Set([
    'note', 'notes', 'knowledge', 'doc', 'docs', 'documentation', 'summary', 'summarize'
  ])
  const topicalNoteTokens = tokens.filter((t) => !NOTE_CONTROL_WORDS.has(t))

  const scoredKnowledge = knowledge.map((item) => {
    let score = 0
    const titleLower = item.title.toLowerCase()
    const contentLower = item.content.toLowerCase()

    let hasTopicalMatch = false
    for (const token of topicalNoteTokens) {
      if (titleLower.includes(token)) {
        score += 5
        hasTopicalMatch = true
      }
      if (contentLower.includes(token)) {
        score += 2
        hasTopicalMatch = true
      }
      if (item.tags.some((tag) => tag.toLowerCase().includes(token))) {
        score += 4
        hasTopicalMatch = true
      }
    }

    let hasWorkspaceMatch = false
    if (item.workspaceId && item.workspaceId === activeWorkspaceId) {
      score += 3
      hasWorkspaceMatch = true
    }
    for (const ws of relevantWorkspaces) {
      if (item.workspaceId === ws.id) {
        score += 5
        hasWorkspaceMatch = true
      }
    }

    if (topicalNoteTokens.length > 0 && !hasTopicalMatch && !hasWorkspaceMatch) {
      score = 0
    } else if (topicalNoteTokens.length === 0 && isAskingNotes) {
      score += 3
    }

    return { item, score }
  })

  const matchingNotes = scoredKnowledge
    .filter((sk) => sk.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItemsPerCategory)
    .map((sk) => sk.item)

  // 4. Filter & Score Relevant Memories
  const isAskingMemories =
    /\b(remember|memories|memory|preference|preferences|decide|decided|decision|past|last\s+week)\b/i.test(
      lowerPrompt
    )

  const scoredMemories = memories.map((mem) => {
    let score = 0
    const contentLower = mem.content.toLowerCase()
    const catLower = mem.category.toLowerCase()

    for (const token of tokens) {
      if (contentLower.includes(token)) score += 4
      if (catLower.includes(token)) score += 2
    }

    if (mem.workspaceId && mem.workspaceId === activeWorkspaceId) score += 2

    return { mem, score }
  })

  const matchingMemories = scoredMemories
    .filter((sm) => (isAskingMemories ? sm.score >= 1 : sm.score >= 3))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItemsPerCategory)
    .map((sm) => sm.mem)

  const totalMatches =
    matchingTasks.length + matchingNotes.length + matchingMemories.length

  // Build compact, structured context block for AI prompt
  const sections: string[] = []
  if (activeWorkspace) {
    sections.push(`- Active Workspace: "${activeWorkspace.name}" (ID: \`${activeWorkspace.id}\`)`)
  }

  if (matchingTasks.length > 0) {
    const taskLines = matchingTasks.map((t) => {
      const state = t.completed ? '[Completed]' : '[Pending]'
      const sched = t.scheduledAt ? ` | Schedule: ${t.scheduledAt}` : ''
      return `  • ${state} "${t.title}" (Priority: ${t.priority}${sched} | ID: \`${t.id}\`)`
    })
    sections.push(`- Relevant User Tasks (${matchingTasks.length}):\n${taskLines.join('\n')}`)
  }

  if (matchingNotes.length > 0) {
    const noteLines = matchingNotes.map((n) => {
      const preview = n.content.length > 180 ? `${n.content.slice(0, 180)}...` : n.content
      return `  • "${n.title}" [${n.kind} | ID: \`${n.id}\`]:\n    ${preview}`
    })
    sections.push(`- Relevant User Notes (${matchingNotes.length}):\n${noteLines.join('\n')}`)
  }

  if (matchingMemories.length > 0) {
    const memLines = matchingMemories.map(
      (m) => `  • [${m.category}] "${m.content}" (ID: \`${m.id}\`)`
    )
    sections.push(`- Relevant User Memories (${matchingMemories.length}):\n${memLines.join('\n')}`)
  }

  const formattedContextPrompt =
    sections.length > 0
      ? `### AUTHORIZED USER CONTEXT (Strictly relevant to this query)\n${sections.join('\n\n')}`
      : ''

  return {
    relevantTasks: matchingTasks,
    relevantNotes: matchingNotes,
    relevantMemories: matchingMemories,
    relevantWorkspaces,
    activeWorkspace,
    formattedContextPrompt,
    totalMatches,
  }
}

/**
 * Asynchronously enriches action context with Hindsight Cloud long-term conversational
 * memory recall and reflection synthesis, while deduplicating against Supabase records.
 */
export async function retrieveEnrichedActionContext(options: {
  prompt: string
  tasks: TaskItem[]
  memories: MemoryItem[]
  knowledge: KnowledgeItem[]
  workspaces: WorkspaceItem[]
  activeWorkspaceId: string | null
  maxItemsPerCategory?: number
  enableHindsight?: boolean
}): Promise<RetrievedContext> {
  const baseContext = retrieveActionContext(options)

  if (options.enableHindsight === false) {
    return baseContext
  }

  const lowerPrompt = options.prompt.toLowerCase()
  const isAskingMemories =
    /\b(remember|memories|memory|preference|preferences|decide|decided|decision|past|last\s+week)\b/i.test(
      lowerPrompt
    )
  const isPersonalOrAttributeQuery =
    /\b(?:what(?:'s|\s+is)\s+my|who\s+am\s+i|where\s+do\s+i|where\s+is\s+my|how\s+do\s+i|my\s+(?:favourite|favorite|preferred|preference|preferences|subject|hobby|job|role|name|stack|color|food|city)|do\s+you\s+(?:know|remember)\s+my|tell\s+me\s+about\s+my|what\s+did\s+i|have\s+i\s+ever)\b/i.test(
      lowerPrompt
    )
  const isReflection = isReflectionQuery(options.prompt)

  let reflectionAnswer = ''
  if (isReflection) {
    try {
      const reflectRes = await reflectMemories(options.prompt)
      if (reflectRes.success && reflectRes.answer) {
        reflectionAnswer = reflectRes.answer
      }
    } catch {
      // Non-blocking fallback
    }
  }

  // Recall relevant memories from Hindsight Cloud if asking, personal, or contextual
  let recalledItems: HindsightClientMemoryItem[] = []
  if (
    isAskingMemories ||
    isPersonalOrAttributeQuery ||
    isReflection ||
    baseContext.totalMatches > 0 ||
    options.prompt.trim().length >= 4
  ) {
    try {
      const recallRes = await recallMemories(options.prompt, 5)
      if (recallRes.success && Array.isArray(recallRes.results)) {
        recalledItems = recallRes.results
      }
    } catch {
      // Non-blocking fallback
    }
  }

  if (!reflectionAnswer && recalledItems.length === 0) {
    return baseContext
  }

  // Deduplicate recalled items against existing baseContext.relevantMemories
  const existingContents = new Set(
    baseContext.relevantMemories.map((m) => m.content.toLowerCase().trim())
  )
  const newRecalledMemories: MemoryItem[] = []

  for (const item of recalledItems) {
    const textTrimmed = (item.text || '').trim()
    if (textTrimmed && !existingContents.has(textTrimmed.toLowerCase())) {
      existingContents.add(textTrimmed.toLowerCase())
      newRecalledMemories.push({
        id: item.id || `hs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        category: 'Hindsight Memory',
        content: textTrimmed,
        dateAdded: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Previously',
      })
    }
  }

  const maxMemories = options.maxItemsPerCategory ?? 4
  const combinedMemories = [
    ...baseContext.relevantMemories,
    ...newRecalledMemories,
  ].slice(0, Math.max(maxMemories, baseContext.relevantMemories.length))

  // Rebuild sections with reflection and recalled memories
  const sections: string[] = []
  if (baseContext.activeWorkspace) {
    sections.push(
      `- Active Workspace: "${baseContext.activeWorkspace.name}" (ID: \`${baseContext.activeWorkspace.id}\`)`
    )
  }
  if (baseContext.relevantTasks.length > 0) {
    const taskLines = baseContext.relevantTasks.map((t) => {
      const state = t.completed ? '[Completed]' : '[Pending]'
      const sched = t.scheduledAt ? ` | Schedule: ${t.scheduledAt}` : ''
      return `  • ${state} "${t.title}" (Priority: ${t.priority}${sched} | ID: \`${t.id}\`)`
    })
    sections.push(`- Relevant User Tasks (${baseContext.relevantTasks.length}):\n${taskLines.join('\n')}`)
  }
  if (baseContext.relevantNotes.length > 0) {
    const noteLines = baseContext.relevantNotes.map((n) => {
      const preview = n.content.length > 180 ? `${n.content.slice(0, 180)}...` : n.content
      return `  • "${n.title}" [${n.kind} | ID: \`${n.id}\`]:\n    ${preview}`
    })
    sections.push(`- Relevant User Notes (${baseContext.relevantNotes.length}):\n${noteLines.join('\n')}`)
  }
  if (combinedMemories.length > 0) {
    const memLines = combinedMemories.map(
      (m) => `  • [${m.category}] "${m.content}" (ID: \`${m.id}\`)`
    )
    sections.push(`- Relevant User Memories (${combinedMemories.length}):\n${memLines.join('\n')}`)
  }
  if (reflectionAnswer) {
    sections.push(`- Synthesized Reflection across memories:\n  "${reflectionAnswer}"`)
  }

  const formattedContextPrompt =
    sections.length > 0
      ? `### AUTHORIZED USER CONTEXT (Strictly relevant to this query)\n${sections.join('\n\n')}`
      : ''

  return {
    ...baseContext,
    relevantMemories: combinedMemories,
    formattedContextPrompt,
    totalMatches:
      baseContext.relevantTasks.length + baseContext.relevantNotes.length + combinedMemories.length,
  }
}

const WEEKDAY_NAMES = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
]

/**
 * Accurately match tasks against a query string with disambiguation support.
 */
export function matchTasks(
  tasks: TaskItem[],
  query: string
): {
  exactMatch: TaskItem | null
  exactIdMatch: TaskItem | null
  exactTitleMatches: TaskItem[]
  partialMatches: TaskItem[]
  allMatches: TaskItem[]
} {
  const q = query.toLowerCase().trim().replace(/[.,;:!?]+$/, '').trim()
  if (!q) {
    return {
      exactMatch: null,
      exactIdMatch: null,
      exactTitleMatches: [],
      partialMatches: [],
      allMatches: [],
    }
  }

  // 1. Exact ID match
  const exactIdMatch = tasks.find((t) => t.id.toLowerCase() === q) || null
  if (exactIdMatch) {
    return {
      exactMatch: exactIdMatch,
      exactIdMatch,
      exactTitleMatches: [exactIdMatch],
      partialMatches: [exactIdMatch],
      allMatches: [exactIdMatch],
    }
  }

  // 2. Exact Title match
  const exactTitleMatches = tasks.filter((t) => t.title.toLowerCase() === q)
  if (exactTitleMatches.length > 0) {
    return {
      exactMatch: exactTitleMatches.length === 1 ? exactTitleMatches[0] : null,
      exactIdMatch: null,
      exactTitleMatches,
      partialMatches: exactTitleMatches,
      allMatches: exactTitleMatches,
    }
  }

  // 3. Substring match
  const substringMatches = tasks.filter((t) => t.title.toLowerCase().includes(q))
  if (substringMatches.length > 0) {
    return {
      exactMatch: substringMatches.length === 1 ? substringMatches[0] : null,
      exactIdMatch: null,
      exactTitleMatches: [],
      partialMatches: substringMatches,
      allMatches: substringMatches,
    }
  }

  // 4. Token / Word match: all words in query are present in title
  const queryTokens = q.split(/\s+/).filter(Boolean)
  const tokenMatches = tasks.filter((t) => {
    const titleLower = t.title.toLowerCase()
    return queryTokens.every((token) => titleLower.includes(token))
  })

  return {
    exactMatch: tokenMatches.length === 1 ? tokenMatches[0] : null,
    exactIdMatch: null,
    exactTitleMatches: [],
    partialMatches: tokenMatches,
    allMatches: tokenMatches,
  }
}

/**
 * Accurately resolve relative date and time strings using the user's local timezone.
 */
export function resolveSchedule(
  text: string,
  referenceDate: Date = new Date()
): {
  scheduledAt?: string
  priority?: TaskItem['priority']
  estimateMinutes?: number
} {
  const lower = text.toLowerCase()

  // 1. Priority parsing
  let priority: TaskItem['priority'] | undefined
  if (/\b(urgent|high priority|priority high|asap|crucial)\b/i.test(lower)) {
    priority = 'high'
  } else if (/\b(low priority|priority low|minor|optional)\b/i.test(lower)) {
    priority = 'low'
  } else if (/\b(medium priority|priority medium|normal priority)\b/i.test(lower)) {
    priority = 'medium'
  }

  // 2. Estimate minutes parsing
  let estimateMinutes: number | undefined
  const estMatchMin = lower.match(/\bfor\s+(\d+)\s*(?:min|minute|minutes|m)\b/)
  if (estMatchMin) {
    estimateMinutes = Number(estMatchMin[1])
  } else {
    const estMatchHr = lower.match(/\bfor\s+(\d+(?:\.\d+)?)\s*(?:hour|hours|hr|hrs|h)\b/)
    if (estMatchHr) {
      estimateMinutes = Math.round(Number(estMatchHr[1]) * 60)
    }
  }

  // 3. Date target
  let targetDay: Date | null = null
  let hasExplicitDate = false

  if (/\btomorrow\b/i.test(lower)) {
    targetDay = new Date(referenceDate)
    targetDay.setDate(targetDay.getDate() + 1)
    hasExplicitDate = true
  } else if (/\btoday\b/i.test(lower)) {
    targetDay = new Date(referenceDate)
    hasExplicitDate = true
  } else if (/\byesterday\b/i.test(lower)) {
    targetDay = new Date(referenceDate)
    targetDay.setDate(targetDay.getDate() - 1)
    hasExplicitDate = true
  } else if (/\bnext\s+week\b/i.test(lower)) {
    targetDay = new Date(referenceDate)
    targetDay.setDate(targetDay.getDate() + 7)
    hasExplicitDate = true
  } else {
    const inDaysMatch = lower.match(/\bin\s+(\d+)\s+days?\b/)
    if (inDaysMatch) {
      targetDay = new Date(referenceDate)
      targetDay.setDate(targetDay.getDate() + Number(inDaysMatch[1]))
      hasExplicitDate = true
    } else {
      for (let i = 0; i < WEEKDAY_NAMES.length; i++) {
        const name = WEEKDAY_NAMES[i]
        const regex = new RegExp(`\\b(?:on\\s+|this\\s+|next\\s+|to\\s+|by\\s+)?${name}\\b`, 'i')
        if (regex.test(lower)) {
          targetDay = new Date(referenceDate)
          const currentDayIndex = targetDay.getDay()
          let diff = i - currentDayIndex
          if (diff <= 0) diff += 7
          targetDay.setDate(targetDay.getDate() + diff)
          hasExplicitDate = true
          break
        }
      }
    }
  }

  // Explicit ISO or calendar date: YYYY-MM-DD
  const dateIsoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (dateIsoMatch) {
    const [y, m, d] = dateIsoMatch[1].split('-').map(Number)
    targetDay = new Date(y, m - 1, d, 12, 0, 0, 0)
    hasExplicitDate = true
  }

  // 4. Time target
  let timeHours: number | null = null
  let timeMinutes: number | null = null

  if (/\b(?:at\s+)?noon\b/i.test(lower)) {
    timeHours = 12
    timeMinutes = 0
  } else if (/\b(?:at\s+)?midnight\b/i.test(lower)) {
    timeHours = 0
    timeMinutes = 0
  } else if (/\b(?:tonight|this\s+evening)\b/i.test(lower)) {
    timeHours = 19
    timeMinutes = 0
  } else if (/\bthis\s+afternoon\b/i.test(lower)) {
    timeHours = 14
    timeMinutes = 0
  } else if (/\bthis\s+morning\b/i.test(lower)) {
    timeHours = 9
    timeMinutes = 0
  } else {
    const timeMatch = lower.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/)
    if (timeMatch) {
      let h = Number(timeMatch[1])
      const m = timeMatch[2] ? Number(timeMatch[2]) : 0
      const meridian = timeMatch[3].toLowerCase()
      if (meridian.startsWith('p') && h < 12) h += 12
      if (meridian.startsWith('a') && h === 12) h = 0
      timeHours = h
      timeMinutes = m
    } else {
      const time24Match = lower.match(/(?:at\s+)?(\d{1,2}):(\d{2})\b/)
      if (time24Match) {
        timeHours = Number(time24Match[1])
        timeMinutes = Number(time24Match[2])
      }
    }
  }

  if (timeHours !== null && !targetDay) {
    targetDay = new Date(referenceDate)
    hasExplicitDate = true
  }

  let scheduledAt: string | undefined
  if (targetDay && timeHours !== null) {
    const combined = new Date(
      targetDay.getFullYear(),
      targetDay.getMonth(),
      targetDay.getDate(),
      timeHours,
      timeMinutes ?? 0,
      0,
      0
    )
    scheduledAt = fromDateTimeInput(toDateTimeInput(combined))
  } else if (targetDay && hasExplicitDate) {
    scheduledAt = localDateKey(targetDay)
  }

  return { scheduledAt, priority, estimateMinutes }
}

export function isMalformedTitle(title: string, knownWorkspaces?: WorkspaceItem[]): boolean {
  if (!title || title.trim().length === 0) return true
  const lower = title.toLowerCase().trim()
  if (
    /^(?:in|for|under|inside)\s+.+?\s+(?:called|titled|named)\b/i.test(lower) ||
    /^(?:in|for|under|inside)\s+(?:the\s+)?workspace\b/i.test(lower) ||
    /(?:called|titled|named)\s*$/i.test(lower) ||
    /\bwith\s+(?:the\s+|this\s+)?content\b/i.test(lower) ||
    /^(?:task|note|knowledge|document|workspace)$/i.test(lower) ||
    /^(?:titled|called|named|with\s+content)$/i.test(lower) ||
    /^(?:create|add|save|make|schedule)\s+(?:a\s+)?(?:task|note)$/i.test(lower) ||
    /^(?:(?:create|make|add|save|take|record)\s+(?:a\s+)?)?(?:personal\s+|project\s+|quick\s+|voice\s+)?(?:note|voice\s+note|memo)(?:\s+in\s+(?:my\s+)?personal)?$/i.test(lower) ||
    /^(?:my\s+)?personal(?:\s+(?:notes?|space))?$/i.test(lower) ||
    /^(?:voice\s+note|voice\s+memo)$/i.test(lower)
  ) {
    return true
  }

  if (/^(?:in|inside|under)\s+[a-z0-9_\s-]+$/i.test(lower)) {
    const afterPrep = lower.replace(/^(?:in|inside|under)\s+/i, '').trim()
    if (knownWorkspaces && knownWorkspaces.some((w) => w.name.toLowerCase() === afterPrep)) {
      return true
    }
    if (/^(?:in|inside|under)\s+[A-Z][a-zA-Z0-9_-]*(?:\s+[A-Z][a-zA-Z0-9_-]*)*$/.test(title.trim())) {
      return true
    }
  }

  return false
}

export function extractNoteFromFollowup(speech: string): { title: string; content: string } | null {
  const text = speech.trim()
  if (!text) return null

  // Pattern 1: Explicit content introducer: "Voice Test. The content is voice is working", "Call it Voice Test with content voice is working", etc.
  const matchExplicit = text.match(
    /^(?:(?:create|make|save|take)\s+(?:a\s+)?note\s+)?(?:(?:call\s+it|title\s+(?:is|=|:)?|titled|named)\s+)?(.+?)[.,;]?\s*(?:and\s+)?(?:the\s+)?(?:content|body|text)\s+(?:is|=|:)\s*(.+)$/i
  )
  if (matchExplicit) {
    const title = cleanEntityTitle(matchExplicit[1].trim())
    const content = matchExplicit[2].trim().replace(/^[.,;]+|[.,;]+$/g, '').trim()
    if (title && content) return { title, content }
  }

  // Pattern 2: "Voice Test. It says voice is working" / "Voice Test. It should say voice is working"
  const matchItSays = text.match(
    /^(?:(?:call\s+it|title\s+(?:is|=|:)?|titled|named)\s+)?(.+?)[.,;]\s*(?:it\s+(?:says|should\s+say))\s*(.+)$/i
  )
  if (matchItSays) {
    const title = cleanEntityTitle(matchItSays[1].trim())
    const content = matchItSays[2].trim().replace(/^[.,;]+|[.,;]+$/g, '').trim()
    if (title && content) return { title, content }
  }

  // Pattern 3: Two sentences or hyphen: "Title. Content" or "Title - Content"
  const parts = text.split(/\.\s+|\n|(?<=[a-zA-Z0-9])\s+-\s+/)
  if (parts.length >= 2) {
    const rawTitle = parts[0].replace(/^(?:call\s+it|title\s+(?:is|=|:)?|titled|named)\s+/i, '').trim()
    const title = cleanEntityTitle(rawTitle)
    const content = parts.slice(1).join(' ').trim().replace(/^(?:the\s+content\s+is|the\s+body\s+is|it\s+says|it\s+should\s+say)\s+/i, '').replace(/^[.,;]+|[.,;]+$/g, '').trim()
    if (title && content && !isMalformedTitle(title)) return { title, content }
  }

  return null
}

export interface ExtractedStructuredAction {
  actionType: 'task_create' | 'note_create' | 'none'
  workspaceName?: string
  workspaceId?: string
  title: string
  content?: string
  kind?: KnowledgeItem['kind']
  tags?: string[]
  scheduledAt?: string
  priority?: TaskItem['priority']
  estimateMinutes?: number
  isReminder?: boolean
  isMalformed: boolean
}

export function extractStructuredActionDetails(
  rawInput: string,
  knownWorkspaces?: WorkspaceItem[]
): ExtractedStructuredAction {
  const text = rawInput.trim()

  // 1. Identify Intent
  const isNote =
    // Voice notes / memos: "voice note in my personal", "save a voice note", "voice note", etc.
    /^(?:please\s+)?(?:can\s+you\s+)?(?:(?:save|record|take|create|make|add|store)\s+(?:a\s+)?)?(?:voice\s+note|voice\s+memo)\b/i.test(text) ||
    // Notes in personal: "note in my personal", "make a note in my personal", "in my personal, note...", etc.
    /^(?:please\s+)?(?:can\s+you\s+)?(?:(?:create|make|add|save|take|store)\s+(?:a\s+)?)?note\s+in\s+(?:my\s+)?personal\b/i.test(text) ||
    // Explicit "in my personal" note request: "in my personal, create/make/save a note"
    /^(?:in\s+(?:my\s+)?personal\s*,\s*)(?:please\s+)?(?:create|make|add|save|take|store)?\s*(?:a\s+)?(?:note|voice\s+note)\b/i.test(text) ||
    // Standard note verbs: "create a personal note", "save a note", "user requested note", etc.
    /^(?:please\s+)?(?:in\s+[^,]+,\s*)?(?:user\s+requested|requested|create|add|save|take|make|store|record)\s+(?:a\s+|an\s+)?(?:new\s+|personal\s+|project\s+|quick\s+|voice\s+)?(?:note|knowledge|document|memo)\b/i.test(text) ||
    // Explicit content introducers: "Create a note called Voice Test. The content is voice is working", "Voice Test. The content is voice is working"
    /(?:(?:the\s+)?(?:content|body|text)\s+(?:is|=|:)|with\s+(?:the\s+|this\s+)?content\s*:\s*|with\s+(?:the\s+|this\s+)?body\s*:\s*)/i.test(text) ||
    // Short note starters: "note titled ...", "personal note ...", "note called ...", "note in ..."
    /^(?:personal|project|quick|voice)?\s*note(?:\s+(?:in|titled|called|named|about|with))\b/i.test(text) ||
    // Standalone note utterances: "note", "personal note", "voice note", "create a note", etc.
    /^(?:please\s+)?(?:create|make|save|add|take)?\s*(?:a\s+)?(?:personal|project|quick|voice)?\s*note[.!?]*$/i.test(text)

  const isReminder = /^(?:please\s+)?(?:in\s+[^,]+,\s*)?(?:remind\s+me\s+|set\s+(?:a\s+)?reminder\s+)/i.test(text)
  const isTask =
    !isNote &&
    (isReminder ||
      /^(?:please\s+)?(?:in\s+[^,]+,\s*)?(?:can\s+you\s+)?(?:create|add|schedule|set\s+up|make)\s+(?:a\s+)?(?:new\s+)?task\b/i.test(text) ||
      /^(?:please\s+)?(?:add\s+to\s+(?:my\s+)?(?:tasks|todo|schedule|plan))\b/i.test(text) ||
      /^(?:schedule\s+task)\b/i.test(text))

  if (!isNote && !isTask) {
    return {
      actionType: 'none',
      title: '',
      isMalformed: false,
    }
  }

  // 2. Extract Workspace
  let workspaceName: string | undefined
  let workingText = text

  // Pattern A: Leading Workspace, e.g. "In Product Launch, create a task..."
  const leadingWsMatch = workingText.match(
    /^(?:in|for|under|inside)\s+(?:the\s+)?(?:workspace\s+)?(?:["'“]([^"'”]+)["'”]|([^,]+?))\s*,\s*(?:please\s+)?/i
  )
  if (leadingWsMatch) {
    const candidateLeadingWs = (leadingWsMatch[1] || leadingWsMatch[2] || '').trim()
    if (/^(?:my\s+)?personal(?:\s+(?:notes?|space))?$/i.test(candidateLeadingWs)) {
      workspaceName = undefined
    } else {
      workspaceName = candidateLeadingWs
    }
    workingText = workingText.slice(leadingWsMatch[0].length).trim()
  }

  // Pattern B: Intermediate Workspace (between action verb and title/content introducer)
  if (!workspaceName) {
    const intermediateWsMatch = workingText.match(
      /^(?:please\s+)?(?:can\s+you\s+)?(?:create|add|save|take|schedule|set\s+up|make)\s+(?:a\s+|an\s+)?(?:new\s+|personal\s+|project\s+|quick\s+)?(?:note|knowledge|document|task)(?:\s+(?:in|into|under|inside)(?:\s+(?:the\s+)?workspace)?|\s+(?:for|to)\s+(?:the\s+)?workspace)\s+(?:["'“]([^"'”]+)["'”]|([a-zA-Z0-9_\s-]+?))\s+(?=(?:titled|called|named|with\s+(?:title|content|the\s+content|this\s+content|body|the\s+body)|that\s+says|to\b|:\s*))/i
    )
    if (intermediateWsMatch) {
      const candidateWs = (intermediateWsMatch[1] || intermediateWsMatch[2] || '').trim()
      if (!/^(?:that|this|the|current|same)(?:\s+(?:workspace|project|space))?$|^(?:it)$/i.test(candidateWs)) {
        if (/^(?:my\s+)?personal(?:\s+(?:notes?|space))?$/i.test(candidateWs)) {
          workspaceName = undefined
        } else {
          workspaceName = candidateWs
        }
      }
      workingText = workingText.slice(intermediateWsMatch[0].length).trim()
    }
  }

  // Pattern C: Trailing Workspace, e.g. "... in Product Launch."
  if (!workspaceName) {
    const trailingWsMatch = workingText.match(
      /(?:(?:\s+in|\s+into|\s+under|\s+inside)(?:\s+(?:the\s+)?workspace)?|(?:\s+for|\s+to)\s+(?:the\s+)?workspace)\s+(?:["'“]([^"'”]+)["'”]|([a-zA-Z0-9_\s-]+?))[.!?]*$/i
    )
    if (trailingWsMatch) {
      const candidateWs = (trailingWsMatch[1] || trailingWsMatch[2] || '').trim()
      if (
        !/^(?:\d+\s*(?:mins?|minutes?|hours?|hrs?|h)|tomorrow|today|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(
          candidateWs
        ) &&
        !/\b(?:called|titled|named|with\s+(?:the\s+|this\s+)?content)\b/i.test(candidateWs)
      ) {
        if (!/^(?:that|this|the|current|same)(?:\s+(?:workspace|project|space))?$|^(?:it)$/i.test(candidateWs)) {
          if (/^(?:my\s+)?personal(?:\s+(?:notes?|space))?$/i.test(candidateWs)) {
            workspaceName = undefined
          } else {
            workspaceName = candidateWs
          }
        }
        workingText = workingText.slice(0, trailingWsMatch.index).trim()
      }
    }
  }

  if (/\s+in\s+(?:my\s+)?personal[.!?]*$/i.test(workingText)) {
    workingText = workingText.replace(/\s+in\s+(?:my\s+)?personal[.!?]*$/i, '').trim()
    workspaceName = undefined
  }

  if (workspaceName && /^(?:my\s+)?personal(?:\s+(?:notes?|space))?$/i.test(workspaceName)) {
    workspaceName = undefined
  }

  // Resolve against known workspaces if provided
  let workspaceId: string | undefined
  if (workspaceName) {
    workspaceName = cleanEntityTitle(workspaceName)
    if (knownWorkspaces && knownWorkspaces.length > 0) {
      const found = knownWorkspaces.find(
        (w) =>
          w.name.toLowerCase() === workspaceName!.toLowerCase() ||
          w.id.toLowerCase() === workspaceName!.toLowerCase()
      )
      if (found) {
        workspaceId = found.id
        workspaceName = found.name
      }
    }
  }

  // Strip action prefix if still present
  workingText = workingText
    .replace(
      /^(?:please\s+)?(?:can\s+you\s+)?(?:user\s+requested|requested|create|add|save|take|schedule|set\s+up|make|store|record)\s+(?:a\s+|an\s+)?(?:new\s+|personal\s+|project\s+|quick\s+|voice\s+)?(?:note|knowledge|document|task|memo|voice\s+note|voice\s+memo)(?:\s*:\s*|\s+to\s+|\s+for\s+|\s+in\s+(?:my\s+)?personal|\s+|$)/i,
      ''
    )
    .replace(/^(?:personal|project|quick|voice)?\s*(?:note|voice\s+note|voice\s+memo)(?:\s+in\s+(?:my\s+)?personal)?(?:\s*:\s*|\s+|$)/i, '')
    .replace(/^(?:in\s+(?:my\s+)?personal\s*,?\s*)/i, '')
    .replace(/^(?:please\s+)?remind\s+me(?:\s+at\s+[^to]+)?\s+to\s+/i, '')
    .replace(/^(?:please\s+)?set\s+(?:a\s+)?reminder(?:\s+at\s+[^to]+)?\s+to\s+/i, '')
    .replace(/^(?:please\s+)?add\s+to\s+(?:my\s+)?(?:tasks|todo|schedule|plan)(?:\s*:\s*|\s+)/i, '')
    .trim()

  if (isNote) {
    // 3. Note Title & Content Extraction
    let content: string | undefined
    let title: string

    let kind: KnowledgeItem['kind'] = 'Personal note'
    if (/\b(?:reference)\b/i.test(text)) {
      kind = 'Reference'
    } else if (/\b(?:project\s+notes?)\b/i.test(text)) {
      kind = 'Project notes'
    } else if (/\b(?:personal\s+notes?|in\s+(?:my\s+)?personal|voice\s+note|voice\s+memo)\b/i.test(text)) {
      kind = 'Personal note'
    }

    // Extract hashtags
    const tags: string[] = []
    const tagMatches = workingText.match(/#([a-zA-Z0-9_-]+)/g)
    if (tagMatches) {
      for (const t of tagMatches) tags.push(t.slice(1))
      workingText = workingText.replace(/#([a-zA-Z0-9_-]+)/g, '').trim()
    }

    // Check for explicit body separator:
    // e.g. ". The content is ...", "The content is ...", "with the content:", "with body:", etc.
    const bodySeparatorMatch = workingText.match(
      /(?:[.,;]?\s*(?:and\s+)?(?:the\s+)?(?:content|body|text)\s+(?:is|=|:)\s*|[.,;]\s*(?:it\s+(?:says|should\s+say))\s*|\s+with\s+(?:the\s+|this\s+)?content\s*:\s*|\s+with\s+(?:the\s+|this\s+)?content\s+|\s+with\s+(?:the\s+|this\s+)?body\s*:\s*|\s+with\s+(?:the\s+|this\s+)?body\s+|\s+body\s*:\s*|\s+content\s*:\s*|\s+that\s+says\s*:\s*|\s+that\s+says\s+|\s*:\s*)([\s\S]+)$/i
    )

    if (bodySeparatorMatch && bodySeparatorMatch.index !== undefined) {
      content = bodySeparatorMatch[1].trim()
      const titleSegment = workingText.slice(0, bodySeparatorMatch.index).trim().replace(/[.,;]+$/, '').trim()
      title = titleSegment.replace(/^(?:titled|called|named|with\s+title|about)\s+/i, '').trim()
      title = cleanEntityTitle(title)
    } else {
      const titleIntroMatch = workingText.match(
        /^(?:titled|called|named|with\s+title|about)\s+(?:["'“]([^"'”]+)["'”]|([^:\n]+?))$/i
      )
      if (titleIntroMatch) {
        title = cleanEntityTitle(titleIntroMatch[1] || titleIntroMatch[2] || '')
        content = title
      } else {
        const parts = workingText.split(/\n|\.\s+|(?<=[a-zA-Z0-9])\s+-\s+/)
        if (parts.length > 1 && parts[0].length < 80) {
          title = cleanEntityTitle(parts[0])
          content = parts.slice(1).join('\n').trim()
        } else {
          title = workingText.length > 40 ? `${workingText.slice(0, 40).trim()}...` : workingText
          content = workingText
          title = cleanEntityTitle(title)
        }
      }
    }

    title = cleanEntityTitle(title)
    const isMalformed = isMalformedTitle(title)

    return {
      actionType: 'note_create',
      workspaceName,
      workspaceId,
      title,
      content: content || title,
      kind,
      tags,
      isMalformed,
    }
  }

  // 4. Task Title & Scheduling Extraction
  const { scheduledAt, priority, estimateMinutes } = resolveSchedule(text)

  let taskTitle = workingText
    .replace(/^(?:called|named|titled|to)\s+/i, '')
    .replace(/\b(?:priority\s+(?:high|medium|low)|(?:high|medium|low)\s+priority|urgent|asap)\b/gi, '')
    .replace(/\b(?:for\s+\d+\s*(?:mins?|minutes?|hours?|hrs?|h))\b/gi, '')
    .replace(/\b(?:tomorrow|today|yesterday|on\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/gi, '')
    .replace(/\b(?:this\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/gi, '')
    .replace(/\b(?:at\s+(?:\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)|\d{1,2}:\d{2}|noon|midnight))\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  taskTitle = cleanEntityTitle(taskTitle)
  taskTitle = taskTitle.replace(/\s+(?:at|for|on|by|with|to)$/i, '').replace(/[.,;:!?]+$/, '').trim()

  const isMalformed = isMalformedTitle(taskTitle)

  return {
    actionType: 'task_create',
    workspaceName,
    workspaceId,
    title: taskTitle,
    scheduledAt,
    priority: priority ?? 'medium',
    estimateMinutes: estimateMinutes ?? (isReminder ? 15 : 30),
    isReminder,
    isMalformed,
  }
}

export function cleanTaskTitle(text: string): string {
  const extracted = extractStructuredActionDetails(text)
  if (extracted.actionType === 'task_create' && extracted.title && !extracted.isMalformed) {
    return extracted.title
  }

  let cleaned = text
    .replace(
      /^(?:please\s+)?(?:can\s+you\s+)?(?:create|add|schedule|set\s+up|make)\s+(?:a\s+)?(?:new\s+)?task(?:\s*:\s*|\s+to\s+|\s+for\s+|\s+)/i,
      ''
    )
    .replace(/^(?:please\s+)?remind\s+me(?:\s+at\s+[^to]+)?\s+to\s+/i, '')
    .replace(/^(?:please\s+)?set\s+(?:a\s+)?reminder(?:\s+at\s+[^to]+)?\s+to\s+/i, '')
    .replace(
      /^(?:please\s+)?(?:add\s+to\s+(?:my\s+)?(?:tasks|todo|schedule|plan)(?:\s*:\s*|\s+))/i,
      ''
    )
    .replace(
      /\b(?:priority\s+(?:high|medium|low)|(?:high|medium|low)\s+priority|urgent|asap)\b/gi,
      ''
    )
    .replace(/\b(?:for\s+\d+\s*(?:mins?|minutes?|hours?|hrs?|h))\b/gi, '')
    .replace(
      /\b(?:tomorrow|today|yesterday|on\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/gi,
      ''
    )
    .replace(
      /\b(?:this\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/gi,
      ''
    )
    .replace(
      /\b(?:at\s+(?:\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)|\d{1,2}:\d{2}|noon|midnight))\b/gi,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim()

  cleaned = cleanEntityTitle(cleaned)
  cleaned = cleaned.replace(/\s+(?:at|for|on|by|with|to)$/i, '').replace(/[.,;:!?]+$/, '').trim()
  return cleaned
}

export function cleanEntityTitle(raw: string): string {
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/[.!?]+$/, '').trim()
  cleaned = cleaned.replace(/^["'“`]+|["'”`]+$/g, '').trim()
  cleaned = cleaned.replace(/^(?:for|named|called|titled|about)\s+/i, '').trim()
  cleaned = cleaned.replace(/^["'“`]+|["'”`]+$/g, '').trim()
  return cleaned
}

/**
 * Detect user action intent from a single prompt segment.
 */
export function parseActionPlan(
  prompt: string,
  contextData?: { knowledge?: KnowledgeItem[]; tasks?: TaskItem[]; workspaces?: WorkspaceItem[] }
): ActionPlan | null {
  const text = prompt.trim()
  const lower = text.toLowerCase()

  // 1. Destructive Confirmation Commands
  if (lower === 'confirm delete all tasks' || lower === 'confirm clear all tasks') {
    return { entity: 'task', verb: 'delete', rawPrompt: text, isDestructiveAll: true, isConfirmed: true }
  }

  // 2. Integration Commands (Google Calendar, GitHub, Slack, Linear)
  const syncMatch = text.match(
    /\b(?:sync\s+(?:with\s+|to\s+)?|connect\s+(?:to\s+|with\s+)?|post\s+(?:message\s+|update\s+)?to\s+|send\s+(?:message\s+|update\s+)?to\s+|create\s+(?:issue\s+on\s+|ticket\s+on\s+)?|export\s+to\s+)(google\s+calendar|github|slack|linear)\b/i
  )
  if (syncMatch) {
    const rawName = syncMatch[1].toLowerCase().replace(/\s+/g, '_')
    return {
      entity: 'integration',
      verb: 'sync',
      rawPrompt: text,
      integration: rawName,
      integrationAction: 'sync',
    }
  }

  // 3. Document / Note Derivation Action: "Create a task based on these notes"
  if (
    /\bcreate\s+(?:a\s+)?task\s+based\s+on\s+(?:these|the|my)?\s*notes?\b/i.test(lower) ||
    /\bcreate\s+task\s+from\s+note\b/i.test(lower)
  ) {
    let noteTitle = 'Action items from notes'
    let workspaceId: string | null = null

    if (contextData?.knowledge && contextData.knowledge.length > 0) {
      // Find the most relevant or recent note
      const note = contextData.knowledge[0]
      noteTitle = `Follow up on: ${note.title}`
      workspaceId = note.workspaceId ?? null
    }

    return {
      entity: 'task',
      verb: 'create',
      rawPrompt: text,
      title: noteTitle,
      priority: 'medium',
      estimateMinutes: 30,
      workspaceId,
    }
  }

  // 4. Task Actions
  // 4a. Delete all tasks
  if (/\b(?:delete|clear|remove)\s+all\s+(?:my\s+)?tasks\b/i.test(lower)) {
    return { entity: 'task', verb: 'delete', rawPrompt: text, isDestructiveAll: true, isConfirmed: false }
  }

  // 4b. Complete / Toggle Task
  const completeMatch = text.match(
    /\b(?:mark\s+(?:the\s+|my\s+)?|complete\s+(?:the\s+|my\s+)?|finish\s+(?:the\s+|my\s+)?|done\s+with\s+(?:the\s+|my\s+)?)(?:["'“]([^"'”]+)["'”]|(.+?))\s+(?:task\s+)?(?:as\s+(completed|done|finished))\b/i
  ) || text.match(
    /(?:mark\s+task\s+|complete\s+task\s+|done\s+with\s+task\s+|finish\s+task\s+)(?:["'“]([^"'”]+)["'”]|(.+?))(?:\s+as\s+(?:completed|done|finished))?$/i
  ) || text.match(
    /\b(?:mark\s+(?:the\s+|my\s+)?task\s+|complete\s+(?:the\s+|my\s+)?task\s+|finish\s+(?:the\s+|my\s+)?task\s+)(?:["'“]([^"'”]+)["'”]|(.+))$/i
  )
  if (completeMatch) {
    let target = (completeMatch[1] || completeMatch[2] || '').trim()
    target = target.replace(/^(?:the\s+|my\s+)/i, '').replace(/\s+task$/i, '').trim()
    if (target) {
      return { entity: 'task', verb: 'complete', rawPrompt: text, targetQuery: target }
    }
  }

  // 4c. Move deadline / Reschedule / Postpone / Update Task
  const moveDeadlineMatch = text.match(
    /\b(?:move|reschedule|postpone|shift|push\s+back|extend)\s+(?:the\s+|my\s+)?(?:deadline\s+(?:for|of)\s+|due\s+date\s+(?:for|of)\s+)?(.+?)\s+(?:deadline\s+|due\s+date\s+)?(?:from\s+[^\s]+\s+)?to\s+(.+)$/i
  ) || text.match(
    /\b(?:change|update|set)\s+(?:the\s+|my\s+)?(?:deadline\s+(?:for|of)\s+|due\s+date\s+(?:for|of)\s+)(.+?)\s+to\s+(.+)$/i
  ) || text.match(
    /\b(?:change|update|set)\s+(?:the\s+|my\s+)?(.+?)\s+(?:deadline|due\s+date)\s+to\s+(.+)$/i
  )
  if (moveDeadlineMatch) {
    const rawTarget = (moveDeadlineMatch[1] || '').trim()
    const updateText = (moveDeadlineMatch[2] || '').trim()
    const target = rawTarget.replace(/^(?:the|my)\s+/i, '').replace(/\s+(?:deadline|due\s+date)$/i, '').trim()
    if (target && updateText) {
      const { scheduledAt, priority, estimateMinutes } = resolveSchedule(updateText)
      const updates: Record<string, unknown> = {}
      if (scheduledAt) updates.scheduledAt = scheduledAt
      if (priority) updates.priority = priority
      if (estimateMinutes) updates.estimateMinutes = estimateMinutes
      return { entity: 'task', verb: 'update', rawPrompt: text, targetQuery: target, updates }
    }
  }

  // General Update Task: e.g. "update task [id/title] to high priority" or "rename task [x] to [y]"
  const updateTaskMatch = text.match(
    /(?:update\s+task\s+|change\s+task\s+)(?:["'“]([^"'”]+)["'”]|([a-zA-Z0-9-_]+))\s+(?:to\s+|with\s+)(.+)$/i
  )
  if (updateTaskMatch) {
    const target = (updateTaskMatch[1] || updateTaskMatch[2] || '').trim()
    const updateText = updateTaskMatch[3]?.trim() || ''
    const { scheduledAt, priority, estimateMinutes } = resolveSchedule(updateText)
    const updates: Record<string, unknown> = {}
    if (priority) updates.priority = priority
    if (scheduledAt) updates.scheduledAt = scheduledAt
    if (estimateMinutes) updates.estimateMinutes = estimateMinutes
    if (!priority && !scheduledAt && !estimateMinutes && updateText) {
      updates.title = updateText
    }
    return { entity: 'task', verb: 'update', rawPrompt: text, targetQuery: target, updates }
  }

  // 4d. Delete duplicate task
  const deleteDuplicateMatch = text.match(
    /\b(?:delete|remove)\s+(?:the\s+)?duplicate\s+tasks?\s+(?:about\s+|titled\s+|for\s+|on\s+)?(?:["'“]([^"'”]+)["'”]|(.+?))(?:\s+task)?$/i
  )
  if (deleteDuplicateMatch) {
    let target = (deleteDuplicateMatch[1] || deleteDuplicateMatch[2] || '').trim()
    target = target.replace(/^(?:the\s+|my\s+)/i, '').replace(/\s+task$/i, '').replace(/[.,;:!?]+$/, '').trim()
    if (target) {
      return { entity: 'task', verb: 'delete', rawPrompt: text, targetQuery: target, isDuplicateDelete: true }
    }
  }

  // Delete specific Task
  const deleteTaskMatch = text.match(
    /\b(?:delete|remove)\s+(?:the\s+)?task\s+(?:about\s+|titled\s+|for\s+|on\s+)?(?:["'“]([^"'”]+)["'”]|(.+?))$/i
  ) || text.match(
    /\b(?:delete|remove)\s+(?:["'“]([^"'”]+)["'”]|(.+?))\s+task$/i
  ) || text.match(
    /(?:delete\s+task\s+|remove\s+task\s+)(?:["'“]([^"'”]+)["'”]|(.+))$/i
  )
  if (deleteTaskMatch && !/\ball\b/i.test(deleteTaskMatch[1] || deleteTaskMatch[2] || '')) {
    let target = (deleteTaskMatch[1] || deleteTaskMatch[2] || '').trim()
    target = target.replace(/^(?:the\s+|my\s+)/i, '').replace(/\s+task$/i, '').trim()
    if (target) {
      return { entity: 'task', verb: 'delete', rawPrompt: text, targetQuery: target }
    }
  }

  // 4e. List Tasks
  if (
    /\b(?:show(?:\s+me)?\s+(?:my\s+)?overdue\s+tasks?|what\s+tasks?\s+are\s+overdue|list\s+(?:my\s+)?overdue\s+tasks?|what(?:'s|\s+is)\s+overdue|any\s+overdue\s+tasks?|show\s+overdue)\b/i.test(
      lower
    )
  ) {
    return { entity: 'task', verb: 'list', filter: 'overdue', rawPrompt: text }
  }

  if (
    /\b(?:what\s+are\s+my\s+tasks|show\s+(?:me\s+)?(?:my\s+)?tasks|list\s+(?:me\s+)?(?:my\s+)?tasks|what(?:'s|\s+is)\s+on\s+my\s+schedule|view\s+(?:my\s+)?tasks|what\s+tasks\s+do\s+i\s+have)\b/i.test(
      lower
    )
  ) {
    let filter: 'all' | 'today' | 'pending' | 'completed' | 'overdue' = 'all'
    if (/\boverdue\b/i.test(lower)) filter = 'overdue'
    else if (/\btoday\b/i.test(lower)) filter = 'today'
    else if (/\b(?:pending|incomplete|to\s*do|left)\b/i.test(lower)) filter = 'pending'
    else if (/\bcompleted\b/i.test(lower)) filter = 'completed'

    return { entity: 'task', verb: 'list', filter, rawPrompt: text }
  }

  // 4f. Create Task / Reminder
  const isReminder = /^(?:please\s+)?(?:in\s+[^,]+,\s*)?(?:remind\s+me\s+|set\s+(?:a\s+)?reminder\s+)/i.test(lower)
  const isTaskCreation =
    isReminder ||
    /^(?:please\s+)?(?:in\s+[^,]+,\s*)?(?:can\s+you\s+)?(?:create|add|schedule|set\s+up|make)\s+(?:a\s+)?(?:new\s+)?task\b/i.test(
      lower
    ) ||
    /^(?:please\s+)?(?:add\s+to\s+(?:my\s+)?(?:tasks|todo|schedule|plan))\b/i.test(lower) ||
    /^(?:schedule\s+task)\b/i.test(lower)

  if (isTaskCreation) {
    const extractedTask = extractStructuredActionDetails(text, contextData?.workspaces)
    if (extractedTask.actionType === 'task_create') {
      if (extractedTask.isMalformed || !extractedTask.title) {
        return {
          entity: 'task',
          verb: 'create',
          rawPrompt: text,
          title: '',
        }
      }
      return {
        entity: 'task',
        verb: 'create',
        rawPrompt: text,
        title: extractedTask.title,
        scheduledAt: extractedTask.scheduledAt,
        priority: extractedTask.priority ?? 'medium',
        estimateMinutes: extractedTask.estimateMinutes ?? (extractedTask.isReminder ? 15 : 30),
        workspaceId: extractedTask.workspaceId,
        workspaceName: extractedTask.workspaceName,
        isReminder: extractedTask.isReminder,
      }
    }
  }

  // 5. Knowledge / Note Actions
  // 5a. List Notes
  if (
    /\b(?:show\s+(?:my\s+)?(?:notes|knowledge)|list\s+(?:my\s+)?(?:notes|knowledge)|what\s+notes\s+do\s+i\s+have)\b/i.test(
      lower
    )
  ) {
    return { entity: 'knowledge', verb: 'list', rawPrompt: text }
  }

  // 5b. Search / Get Note Content
  const searchNoteMatch = text.match(
    /\b(?:search\s+(?:(?:my\s+)?(?:notes?|knowledge)(?:\s+(?:for|about))?|for\s+notes?)\s+|find\s+(?:my\s+)?(?:notes?|knowledge)(?:\s+(?:about|on|for))?\s+|get\s+note\s+|read\s+note\s+)(?:["'“]([^"'”]+)["'”]|(.+))$/i
  )
  if (searchNoteMatch) {
    let query = (searchNoteMatch[1] || searchNoteMatch[2] || '').trim()
    // Clean trailing conversational appendages: e.g. "and summarize what they contain", "and tell me what is in them"
    query = query.replace(/\s+(?:and\s+summarize(?:\s+what\s+(?:they\s+contain|is\s+in\s+them))?|and\s+tell\s+me\s+what\s+(?:they\s+say|is\s+in\s+them)|and\s+show\s+them)[.!?]*$/i, '').trim()
    query = cleanEntityTitle(query)
    if (query) {
      return { entity: 'knowledge', verb: 'search', rawPrompt: text, targetQuery: query }
    }
  }

  // 5c. Create Note
  const extractedNote = extractStructuredActionDetails(text, contextData?.workspaces)
  if (extractedNote.actionType === 'note_create') {
    if (extractedNote.isMalformed || !extractedNote.title) {
      return {
        entity: 'knowledge',
        verb: 'create',
        rawPrompt: text,
        title: '',
        content: '',
        kind: extractedNote.kind || 'Personal note',
        workspaceId: extractedNote.workspaceId,
        workspaceName: extractedNote.workspaceName,
      }
    }
    return {
      entity: 'knowledge',
      verb: 'create',
      rawPrompt: text,
      title: extractedNote.title,
      content: extractedNote.content || extractedNote.title,
      tags: extractedNote.tags || [],
      kind: extractedNote.kind || 'Personal note',
      workspaceId: extractedNote.workspaceId,
      workspaceName: extractedNote.workspaceName,
    }
  }

  // 5d. Delete Note
  const deleteNoteMatch = text.match(
    /(?:delete\s+note\s+|remove\s+note\s+)(?:["'“]([^"'”]+)["'”]|(.+))$/i
  )
  if (deleteNoteMatch) {
    const target = cleanEntityTitle(deleteNoteMatch[1] || deleteNoteMatch[2] || '')
    if (target) {
      return { entity: 'knowledge', verb: 'delete', rawPrompt: text, targetQuery: target }
    }
  }

  // 6. Memory Actions
  // 6a. List Memories
  if (
    /\b(?:what\s+do\s+you\s+remember|show\s+(?:my\s+)?memories|list\s+(?:my\s+)?memories|show\s+(?:my\s+)?memory\s+bank|what(?:'s|\s+is)\s+in\s+(?:my\s+)?memory)\b/i.test(
      lower
    )
  ) {
    return { entity: 'memory', verb: 'list', rawPrompt: text }
  }

  // 6b. Create Memory
  const memoryCreateMatch = text.match(
    /^(?:please\s+)?(?:remember\s+that\s+|remember\s*:\s*|add\s+to\s+memory\s*:\s*|save\s+memory\s*:\s*|keep\s+in\s+mind\s+that\s+)([\s\S]+)$/i
  )
  if (memoryCreateMatch) {
    const memoryContent = memoryCreateMatch[1].trim().replace(/[.!?]+$/, '').trim()
    if (memoryContent) {
      let category = 'Context'
      if (/\b(?:prefer|preference|favorite|favourite|like|dislike|always|never)\b/i.test(memoryContent)) {
        category = 'Preferences'
      } else if (/\b(?:project|code|work|task|deadline|client|deploy)\b/i.test(memoryContent)) {
        category = 'Work'
      } else if (/\b(?:birthday|family|health|personal|home|subject)\b/i.test(memoryContent)) {
        category = 'Personal'
      }

      return {
        entity: 'memory',
        verb: 'create',
        rawPrompt: text,
        content: memoryContent,
        category,
      }
    }
  }

  // 6c. Explicit User Preference or Profile Fact Declaration:
  // e.g. "My favourite subject is Robotics", "My favorite color is Blue", "I prefer TypeScript", "My name is Alice"
  const explicitPrefMatch = text.match(
    /^(?:my\s+(?:favourite|favorite|preferred)\s+([^.!?\n]+?)\s+is\s+([^.!?\n]+)|i\s+(?:prefer|like|love|dislike)\s+([^.!?\n]+)|my\s+(?:name|role|job|title|stack|city|dog|cat)\s+is\s+([^.!?\n]+)|i\s+live\s+in\s+([^.!?\n]+)|i\s+work\s+(?:at|as)\s+([^.!?\n]+))(?:\.|!|\?)?$/i
  )
  if (explicitPrefMatch) {
    let category = 'Preferences'
    if (/\b(?:work|job|role|title|company|stack)\b/i.test(text)) {
      category = 'Work'
    } else if (/\b(?:live|city|home|name|birthday|dog|cat)\b/i.test(text)) {
      category = 'Personal'
    }

    return {
      entity: 'memory',
      verb: 'create',
      rawPrompt: text,
      content: text,
      category,
      isConversationalPreference: true,
    }
  }

  // 6d. Delete Memory
  const deleteMemMatch = text.match(
    /^(?:forget\s+that\s+|delete\s+memory\s+|remove\s+memory\s+)(?:["'“]([^"'”]+)["'”]|(.+))$/i
  )
  if (deleteMemMatch) {
    const target = cleanEntityTitle(deleteMemMatch[1] || deleteMemMatch[2] || '')
    if (target) {
      return { entity: 'memory', verb: 'delete', rawPrompt: text, targetQuery: target }
    }
  }

  // 7. Workspace Actions
  // 7a. List Workspaces
  if (/\b(?:show\s+workspaces|list\s+workspaces|what\s+workspaces\s+do\s+i\s+have)\b/i.test(lower)) {
    return { entity: 'workspace', verb: 'list', rawPrompt: text }
  }

  // 7b. Create Workspace
  const wsCreateMatch = text.match(
    /^(?:please\s+)?(?:create|add|make|set\s+up|start|new)\s+(?:a\s+|an\s+)?(?:new\s+)?workspace(?:\s*:\s*|\s+(?:for|named|called|titled)\s+|\s+)(?:["'“]([^"'”]+)["'”]|(.+))$/i
  ) || text.match(
    /^(?:please\s+)?(?:create|add|make|set\s+up|start|new)\s+(?:a\s+|an\s+)?(?:new\s+)?workspace$/i
  )
  if (wsCreateMatch) {
    const raw = wsCreateMatch[1] || wsCreateMatch[2] || ''
    const name = cleanEntityTitle(raw)
    if (name) {
      return { entity: 'workspace', verb: 'create', rawPrompt: text, title: name }
    }
  }

  // 7c. Switch Workspace
  const wsSwitchMatch = text.match(
    /^(?:please\s+)?(?:switch\s+to|open|go\s+to)\s+(?:the\s+)?workspace(?:\s+(?:named|called|titled))?(?:\s+(?:["'“]([^"'”]+)["'”]|(.+)))?$/i
  )
  if (wsSwitchMatch) {
    const raw = wsSwitchMatch[1] || wsSwitchMatch[2] || ''
    const name = cleanEntityTitle(raw)
    if (name) {
      return { entity: 'workspace', verb: 'switch', rawPrompt: text, targetQuery: name }
    }
  }

  // 7d. Update / Rename Workspace
  const wsUpdateMatch = text.match(
    /^(?:please\s+)?(?:rename|update)\s+(?:the\s+)?workspace\s+(?:["'“]([^"'”]+)["'”]|(.+?))\s+to\s+(?:["'“]([^"'”]+)["'”]|(.+))$/i
  )
  if (wsUpdateMatch) {
    const target = cleanEntityTitle(wsUpdateMatch[1] || wsUpdateMatch[2] || '')
    const newName = cleanEntityTitle(wsUpdateMatch[3] || wsUpdateMatch[4] || '')
    if (target && newName) {
      return {
        entity: 'workspace',
        verb: 'update',
        rawPrompt: text,
        targetQuery: target,
        title: newName,
        updates: { name: newName },
      }
    }
  }

  // 7e. Delete Workspace
  const wsDeleteMatch = text.match(
    /^(?:please\s+)?(?:delete|remove)\s+(?:the\s+)?workspace\s+(?:["'“]([^"'”]+)["'”]|(.+))$/i
  )
  if (wsDeleteMatch) {
    const raw = wsDeleteMatch[1] || wsDeleteMatch[2] || ''
    const target = cleanEntityTitle(raw)
    if (target) {
      return { entity: 'workspace', verb: 'delete', rawPrompt: text, targetQuery: target }
    }
  }

  return null
}

/**
 * Parses user input into one or more sequential ActionPlans (multi-action support).
 */
export function parseMultiActionPlan(
  prompt: string,
  contextData?: { knowledge?: KnowledgeItem[]; tasks?: TaskItem[]; workspaces?: WorkspaceItem[] }
): ActionPlan[] {
  const text = prompt.trim()

  // If the prompt is a single note creation with explicit content marker, do not split content on internal conjunctions
  if (
    /^(?:please\s+)?(?:in\s+[^,]+,\s*)?(?:user\s+requested|requested|create|add|save|take|make|store|record)\s+(?:a\s+|an\s+)?(?:new\s+|personal\s+|project\s+|quick\s+|voice\s+)?(?:note|knowledge|document|memo)\b/i.test(text) &&
    /(?:[.,;]?\s*(?:and\s+)?(?:the\s+)?(?:content|body|text)\s+(?:is|=|:)|(?:\s+with\s+(?:the\s+|this\s+)?content\s*:\s*|\s+that\s+says\s*:\s*|\s*:\s*))/i.test(text)
  ) {
    const single = parseActionPlan(text, contextData)
    if (single && single.entity === 'knowledge' && single.verb === 'create' && single.title) {
      return [single]
    }
  }

  // Conjunction pattern: "and add a note...", "and then create a task...", etc.
  const conjunctionRegex =
    /\s+(?:and\s+also|and\s+then|and)\s+(?=(?:create|add|save|make|schedule|set\s+up|delete|remove|switch|remember|sync|send|mark)\b)/i

  const segments = text.split(conjunctionRegex).map((s) => s.trim()).filter(Boolean)

  if (segments.length <= 1) {
    const single = parseActionPlan(text, contextData)
    return single ? [single] : []
  }

  const plans: ActionPlan[] = []
  for (const seg of segments) {
    const plan = parseActionPlan(seg, contextData)
    if (plan) {
      plans.push(plan)
    }
  }

  return plans
}

/**
 * Execute a single action plan with full lifecycle validation and persistence checking.
 */
async function executeSingleAction(
  plan: ActionPlan,
  ctx: ActionEngineContext
): Promise<ActionResult> {
  // 1. TASK DESTRUCTION CONFIRMATION
  if (plan.entity === 'task' && plan.verb === 'delete' && plan.isDestructiveAll) {
    if (!plan.isConfirmed) {
      return {
        handled: true,
        entityType: 'task',
        verb: 'delete',
        status: 'needs_confirmation',
        response: `⚠️ **Confirmation Required:** Deleting all tasks will permanently remove ${ctx.tasks.length} task(s) from this browser's local storage.\n\nTo confirm, reply with: **Confirm delete all tasks**`,
      }
    }

    try {
      if (ctx.onDeleteAllTasks) {
        await ctx.onDeleteAllTasks()
      } else {
        for (const t of ctx.tasks) {
          await ctx.onDeleteTask(t.id)
        }
      }
      return {
        handled: true,
        entityType: 'task',
        verb: 'delete',
        status: 'executed',
        response: `✓ **All Tasks Cleared:** Successfully removed all ${ctx.tasks.length} task(s).`,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        handled: true,
        status: 'error',
        error: msg,
        response: `⚠️ **Delete All Failed:** ${msg}`,
      }
    }
  }

  // 2. INTEGRATION ACTIONS
  if (plan.entity === 'integration') {
    const status = checkIntegrationStatus(plan.integration || '')
    return {
      handled: true,
      entityType: 'integration',
      verb: 'sync',
      status: status.isAvailable ? 'executed' : 'error',
      error: status.isAvailable ? undefined : status.message,
      response: status.message,
    }
  }

  // 3. TASK ACTIONS
  if (plan.entity === 'task') {
    if (plan.verb === 'create') {
      const title = plan.title?.trim()
      if (!title || isMalformedTitle(title)) {
        return {
          handled: true,
          status: 'needs_confirmation',
          response: 'What would you like the task to be titled? (e.g. "Create a task to finish my AutoPulse presentation tomorrow")',
        }
      }

      let effectiveWorkspaceId = plan.workspaceId !== undefined
        ? plan.workspaceId
        : ctx.activeWorkspaceId

      if (plan.workspaceName && ctx.workspaces) {
        const matchedWs = ctx.workspaces.find(
          (w) =>
            w.name.toLowerCase() === plan.workspaceName!.toLowerCase() ||
            w.id.toLowerCase() === plan.workspaceName!.toLowerCase()
        )
        if (matchedWs) {
          effectiveWorkspaceId = matchedWs.id
        } else {
          try {
            const createdWs = await ctx.onAddWorkspace({
              name: plan.workspaceName,
              kind: 'Project',
              description: `Workspace created for task "${title}"`,
            })
            if (typeof createdWs === 'string' && createdWs.trim().length > 0) {
              effectiveWorkspaceId = createdWs.trim()
            } else if (createdWs && typeof createdWs === 'object' && 'id' in createdWs) {
              effectiveWorkspaceId = (createdWs as WorkspaceItem).id
            }
          } catch {
            // fallback to activeWorkspaceId
          }
        }
      }

      // Prevent accidental duplicate task requests without modifying existing task
      const existingDuplicate = ctx.tasks.find(
        (t) =>
          t.title.toLowerCase() === title.toLowerCase() &&
          !t.completed &&
          (effectiveWorkspaceId === undefined || !t.workspaceId || t.workspaceId === effectiveWorkspaceId)
      )
      if (existingDuplicate) {
        return {
          handled: true,
          status: 'executed',
          recordId: existingDuplicate.id,
          entityType: 'task',
          verb: 'create',
          response: `ℹ️ **Task Already Exists:** "${existingDuplicate.title}" is already in your tasks list (ID: \`${existingDuplicate.id}\`).\n- **Schedule:** ${formatTaskSchedule(existingDuplicate.scheduledAt, existingDuplicate.createdAt)}\n- **Priority:** ${existingDuplicate.priority.toUpperCase()}`,
        }
      }

      try {
        const isReminder = Boolean(plan.isReminder)

        const created = await ctx.onAddTask({
          title,
          priority: plan.priority ?? 'medium',
          scheduledAt: plan.scheduledAt,
          estimateMinutes: plan.estimateMinutes ?? (isReminder ? 15 : 30),
          workspaceId: effectiveWorkspaceId,
        })

        const assignedId =
          created && typeof created === 'object' && 'id' in created
            ? (created as TaskItem).id
            : `task-${Date.now()}`

        const scheduleLabel = plan.scheduledAt
          ? formatTaskSchedule(plan.scheduledAt)
          : 'Flexible'

        const headline = isReminder ? '✓ **Reminder Set & Persisted**' : '✓ **Task Created & Persisted**'

        const wsObj = effectiveWorkspaceId && ctx.workspaces
          ? ctx.workspaces.find((w) => w.id === effectiveWorkspaceId)
          : null
        const wsLine = wsObj
          ? `\n- **Workspace:** ${wsObj.name}`
          : (plan.workspaceName ? `\n- **Workspace:** ${plan.workspaceName}` : '')

        return {
          handled: true,
          entityType: 'task',
          verb: 'create',
          recordId: assignedId,
          status: 'executed',
          response: `${headline}\n- **Title:** ${title}${wsLine}\n- **Schedule:** ${scheduleLabel}\n- **Priority:** ${(plan.priority ?? 'medium').toUpperCase()}\n- **Estimate:** ${plan.estimateMinutes ?? (isReminder ? 15 : 30)} min\n- **ID:** \`${assignedId}\`\n\nPersisted successfully and visible in Tasks and My Day.`,
        }
      } catch (persistErr) {
        const msg = persistErr instanceof Error ? persistErr.message : String(persistErr)
        const isAuthError = /auth|authentication required|session/i.test(msg)
        const recoveryGuidance = isAuthError
          ? '\n\nTo save tasks to your account, please sign in or restore your session at [Login](/login).'
          : ''
        return {
          handled: true,
          status: 'error',
          error: msg,
          response: `⚠️ **Persistence Failed:** ${msg}\n\nThe task was not saved and was not added to your tasks view.${recoveryGuidance}`,
        }
      }
    }

    if (plan.verb === 'list') {
      if (ctx.tasks.length === 0) {
        return {
          handled: true,
          status: 'queried',
          entityType: 'task',
          verb: 'list',
          response:
            'You currently have no tasks in your local task list. You can add one by typing "Create task: [title]".',
        }
      }

      const today = new Date()
      const todayKey = localDateKey(today)
      const nowMs = today.getTime()

      let filtered = ctx.tasks
      let scopeLabel = 'Your Tasks'

      const isOverdue = plan.filter === 'overdue' || /\boverdue\b/i.test(ctx.prompt)
      const isToday = plan.filter === 'today' || /\btoday\b/i.test(ctx.prompt)
      const isPending = plan.filter === 'pending' || /\b(?:pending|incomplete|to\s*do|left)\b/i.test(ctx.prompt)
      const isCompleted = plan.filter === 'completed' || /\bcompleted\b/i.test(ctx.prompt)

      if (isOverdue) {
        scopeLabel = 'Overdue Tasks'
        filtered = ctx.tasks.filter((t) => {
          if (t.completed || !t.scheduledAt) return false
          if (isDateOnly(t.scheduledAt)) {
            return t.scheduledAt < todayKey
          }
          const parsed = parseDateValue(t.scheduledAt)
          return parsed ? parsed.getTime() < nowMs : false
        })

        if (filtered.length === 0) {
          return {
            handled: true,
            status: 'queried',
            entityType: 'task',
            verb: 'list',
            response: '✓ **No Overdue Tasks:** All your scheduled tasks are on track!',
          }
        }
      } else if (isToday) {
        scopeLabel = "Today's Tasks"
        filtered = filtered.filter((t) => isOnLocalDate(t.scheduledAt, today))
      } else if (isPending) {
        scopeLabel = 'Pending Tasks'
        filtered = filtered.filter((t) => !t.completed)
      } else if (isCompleted) {
        scopeLabel = 'Completed Tasks'
        filtered = filtered.filter((t) => t.completed)
      }

      if (filtered.length === 0) {
        return {
          handled: true,
          status: 'queried',
          entityType: 'task',
          verb: 'list',
          response: isToday
            ? 'No tasks are scheduled for today in your local list.'
            : `No matching tasks found for ${scopeLabel.toLowerCase()}.`,
        }
      }

      const listItems = filtered.map((t, idx) => {
        const mark = t.completed ? '[x]' : '[ ]'
        const schedule = formatTaskSchedule(t.scheduledAt, t.createdAt)
        return `${idx + 1}. ${mark} **${t.title}** (${schedule} · Priority: ${t.priority.toUpperCase()} · \`${t.id}\`)`
      })

      return {
        handled: true,
        status: 'queried',
        entityType: 'task',
        verb: 'list',
        response: `📋 **${scopeLabel} (${filtered.length} item${filtered.length === 1 ? '' : 's'}):**\n\n${listItems.join('\n')}`,
      }
    }

    if (plan.verb === 'complete') {
      const q = (plan.targetQuery || '').trim()
      if (!q) {
        return {
          handled: true,
          status: 'needs_confirmation',
          response: 'Which task would you like to mark as completed? Please specify the task title or ID.',
        }
      }

      const { allMatches } = matchTasks(ctx.tasks, q)

      if (allMatches.length === 0) {
        return {
          handled: true,
          status: 'error',
          error: `Task not found matching "${q}".`,
          response: `Could not find a task matching "${q}". Check your task list for the exact title or ID.`,
        }
      }

      if (allMatches.length > 1) {
        const candidates = allMatches.map((t, i) => `${i + 1}. **${t.title}** (\`${t.id}\`)`).join('\n')
        return {
          handled: true,
          entityType: 'task',
          verb: 'complete',
          status: 'needs_confirmation',
          response: `⚠️ Multiple tasks matched "${q}":\n\n${candidates}\n\nPlease specify which task you want to complete by title or ID (e.g. "complete task ${allMatches[0].id}").`,
        }
      }

      const target = allMatches[0]
      if (target.completed) {
        return {
          handled: true,
          status: 'executed',
          recordId: target.id,
          entityType: 'task',
          verb: 'complete',
          response: `ℹ️ "**${target.title}**" (\`${target.id}\`) is already marked as completed.`,
        }
      }

      try {
        await ctx.onToggleTask(target.id)
        return {
          handled: true,
          status: 'executed',
          recordId: target.id,
          entityType: 'task',
          verb: 'complete',
          response: `✓ **Task Updated:** Marked "**${target.title}**" (\`${target.id}\`) as completed.`,
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return {
          handled: true,
          status: 'error',
          error: msg,
          response: `⚠️ **Update Failed:** ${msg}`,
        }
      }
    }

    if (plan.verb === 'update') {
      const q = (plan.targetQuery || '').trim()
      if (!q) {
        return {
          handled: true,
          status: 'needs_confirmation',
          response: 'Which task would you like to update? Please provide the task title or ID.',
        }
      }

      const { allMatches } = matchTasks(ctx.tasks, q)

      if (allMatches.length === 0) {
        return {
          handled: true,
          status: 'error',
          error: `Task not found matching "${q}".`,
          response: `Could not find a task matching "${q}".`,
        }
      }

      if (allMatches.length > 1) {
        const candidates = allMatches.map((t, i) => `${i + 1}. **${t.title}** (\`${t.id}\`)`).join('\n')
        return {
          handled: true,
          entityType: 'task',
          verb: 'update',
          status: 'needs_confirmation',
          response: `⚠️ Multiple tasks matched "${q}":\n\n${candidates}\n\nPlease specify which task you want to update by ID (e.g. "update task ${allMatches[0].id}").`,
        }
      }

      const target = allMatches[0]
      try {
        await ctx.onUpdateTask(target.id, plan.updates || {})

        let details = ''
        if (plan.updates?.scheduledAt) {
          details = `Deadline moved to **${formatTaskSchedule(String(plan.updates.scheduledAt))}**.`
        } else if (plan.updates?.priority) {
          details = `Priority updated to **${String(plan.updates.priority).toUpperCase()}**.`
        } else if (plan.updates?.title) {
          details = `Renamed to "**${String(plan.updates.title)}**".`
        }

        return {
          handled: true,
          status: 'executed',
          recordId: target.id,
          entityType: 'task',
          verb: 'update',
          response: `✓ **Task Updated:** Updated "**${target.title}**" (\`${target.id}\`). ${details}`.trim(),
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return {
          handled: true,
          status: 'error',
          error: msg,
          response: `⚠️ **Update Failed:** ${msg}`,
        }
      }
    }

    if (plan.verb === 'delete') {
      const q = (plan.targetQuery || '').trim()
      if (!q) {
        return {
          handled: true,
          status: 'needs_confirmation',
          response: 'Which task would you like to delete? Please specify the task title or ID.',
        }
      }

      const { allMatches } = matchTasks(ctx.tasks, q)

      if (allMatches.length === 0) {
        return {
          handled: true,
          status: 'error',
          error: `Task not found matching "${q}".`,
          response: `Could not find a task matching "${q}".`,
        }
      }

      // Handle duplicate deletion
      if (plan.isDuplicateDelete) {
        // Group matches by normalized title
        const groupedByTitle = new Map<string, TaskItem[]>()
        for (const t of allMatches) {
          const norm = t.title.toLowerCase().trim()
          const list = groupedByTitle.get(norm) || []
          list.push(t)
          groupedByTitle.set(norm, list)
        }

        const duplicateGroup = Array.from(groupedByTitle.values()).find((g) => g.length > 1)

        if (duplicateGroup) {
          // Remove the newest duplicate (last in group)
          const targetToDelete = duplicateGroup[duplicateGroup.length - 1]
          try {
            await ctx.onDeleteTask(targetToDelete.id)
            const remaining = duplicateGroup.length - 1
            return {
              handled: true,
              status: 'executed',
              recordId: targetToDelete.id,
              entityType: 'task',
              verb: 'delete',
              response: `✓ **Duplicate Task Removed:** Deleted duplicate copy of "**${targetToDelete.title}**" (\`${targetToDelete.id}\`). ${remaining} copy remains in your task list.`,
            }
          } catch (delErr) {
            const msg = delErr instanceof Error ? delErr.message : String(delErr)
            return {
              handled: true,
              status: 'error',
              error: msg,
              response: `⚠️ **Delete Failed:** ${msg}`,
            }
          }
        }

        // Multiple distinct tasks
        if (allMatches.length > 1) {
          const candidates = allMatches.map((t, i) => `${i + 1}. **${t.title}** (\`${t.id}\`)`).join('\n')
          return {
            handled: true,
            entityType: 'task',
            verb: 'delete',
            status: 'needs_confirmation',
            response: `⚠️ Multiple distinct tasks matched "${q}":\n\n${candidates}\n\nNone appear to be identical duplicates. Please specify which task ID to remove (e.g. "delete task ${allMatches[0].id}").`,
          }
        }

        // Only 1 task found with this title
        return {
          handled: true,
          status: 'queried',
          entityType: 'task',
          verb: 'delete',
          response: `ℹ️ Found only one task matching "**${allMatches[0].title}**" (\`${allMatches[0].id}\`). No duplicates were found to delete. If you want to delete it, say "delete task ${allMatches[0].id}".`,
        }
      }

      // Normal single deletion
      if (allMatches.length > 1) {
        const candidates = allMatches.map((t, i) => `${i + 1}. **${t.title}** (\`${t.id}\`)`).join('\n')
        return {
          handled: true,
          entityType: 'task',
          verb: 'delete',
          status: 'needs_confirmation',
          response: `⚠️ Multiple tasks matched "${q}":\n\n${candidates}\n\nPlease specify which task you want to delete by ID (e.g. "delete task ${allMatches[0].id}").`,
        }
      }

      const target = allMatches[0]
      try {
        await ctx.onDeleteTask(target.id)
        return {
          handled: true,
          status: 'executed',
          recordId: target.id,
          entityType: 'task',
          verb: 'delete',
          response: `✓ **Task Removed:** Deleted "**${target.title}**" (\`${target.id}\`).`,
        }
      } catch (delErr) {
        const msg = delErr instanceof Error ? delErr.message : String(delErr)
        return {
          handled: true,
          status: 'error',
          error: msg,
          response: `⚠️ **Delete Failed:** ${msg}`,
        }
      }
    }
  }

  // 4. KNOWLEDGE / NOTE ACTIONS
  if (plan.entity === 'knowledge') {
    if (plan.verb === 'create') {
      const title = plan.title?.trim()
      const content = plan.content?.trim() || title
      if (!title || isMalformedTitle(title)) {
        const isTitledTrailing = plan.rawPrompt ? /(?:titled|called|named)\s*$/i.test(plan.rawPrompt.trim()) : false
        return {
          handled: true,
          status: 'needs_confirmation',
          response: isTitledTrailing
            ? 'What would you like the note to be titled? (e.g. "Save a note titled Research Notes with content: ...")'
            : 'Sure — what should I call the note, and what should it say?',
        }
      }

      try {
        let effectiveWorkspaceId = plan.workspaceId !== undefined
          ? (plan.workspaceId ?? undefined)
          : (ctx.activeWorkspaceId ?? undefined)

        if (plan.workspaceName && ctx.workspaces) {
          const matchedWs = ctx.workspaces.find(
            (w) =>
              w.name.toLowerCase() === plan.workspaceName!.toLowerCase() ||
              w.id.toLowerCase() === plan.workspaceName!.toLowerCase()
          )
          if (matchedWs) {
            effectiveWorkspaceId = matchedWs.id
          } else {
            try {
              const createdWs = await ctx.onAddWorkspace({
                name: plan.workspaceName,
                kind: 'Project',
                description: `Workspace created for note "${title}"`,
              })
              if (typeof createdWs === 'string' && createdWs.trim().length > 0) {
                effectiveWorkspaceId = createdWs.trim()
              } else if (createdWs && typeof createdWs === 'object' && 'id' in createdWs) {
                effectiveWorkspaceId = (createdWs as WorkspaceItem).id
              }
            } catch {
              // fallback
            }
          }
        }

        // If the record is missing, create it only after confirming it does not already exist; avoid duplicates.
        const existingNote = ctx.knowledge.find((k) => {
          const sameTitle = k.title.trim().toLowerCase() === title.toLowerCase()
          const sameContent = k.content.trim().toLowerCase() === (content || title).toLowerCase()
          const sameWs = !effectiveWorkspaceId || k.workspaceId === effectiveWorkspaceId
          return sameTitle && sameContent && sameWs
        })

        if (existingNote) {
          const wsObj = existingNote.workspaceId && ctx.workspaces
            ? ctx.workspaces.find((w) => w.id === existingNote.workspaceId)
            : null
          const wsLine = wsObj
            ? `\n- **Workspace:** ${wsObj.name}`
            : (plan.workspaceName ? `\n- **Workspace:** ${plan.workspaceName}` : '')
          return {
            handled: true,
            entityType: 'knowledge',
            verb: 'create',
            recordId: existingNote.id,
            status: 'executed',
            response: `✓ **Note Already Saved & Verified**\n- **Title:** ${existingNote.title}${wsLine}\n- **Kind:** ${existingNote.kind}\n- **Tags:** ${existingNote.tags && existingNote.tags.length > 0 ? existingNote.tags.join(', ') : 'None'}\n- **ID:** \`${existingNote.id}\`\n\nVerified existing note in Knowledge base.`,
          }
        }

        const created = await ctx.onAddKnowledge({
          title,
          content: content || title,
          kind: plan.kind ?? 'Personal note',
          tags: plan.tags ?? [],
          workspaceId: effectiveWorkspaceId,
        })

        if (!created || typeof created !== 'object' || !created.id) {
          return {
            handled: true,
            status: 'error',
            error: 'Storage service did not confirm note creation.',
            response: '⚠️ **Persistence Failed:** Storage service did not confirm note creation.\n\nThe note was not saved.',
          }
        }

        const assignedId = created.id
        const wsObj = effectiveWorkspaceId && ctx.workspaces
          ? ctx.workspaces.find((w) => w.id === effectiveWorkspaceId)
          : null
        const wsLine = wsObj
          ? `\n- **Workspace:** ${wsObj.name}`
          : (plan.workspaceName ? `\n- **Workspace:** ${plan.workspaceName}` : '')

        return {
          handled: true,
          entityType: 'knowledge',
          verb: 'create',
          recordId: assignedId,
          status: 'executed',
          response: `✓ **Note Saved & Persisted**\n- **Title:** ${created.title}${wsLine}\n- **Kind:** ${created.kind}\n- **Tags:** ${created.tags && created.tags.length > 0 ? created.tags.join(', ') : 'None'}\n- **ID:** \`${assignedId}\`\n\nPersisted successfully and visible in Knowledge.`,
        }
      } catch (persistErr) {
        const msg = persistErr instanceof Error ? persistErr.message : String(persistErr)
        return {
          handled: true,
          status: 'error',
          error: msg,
          response: `⚠️ **Persistence Failed:** ${msg}\n\nThe note was not saved.`,
        }
      }
    }

    if (plan.verb === 'list') {
      if (ctx.knowledge.length === 0) {
        return {
          handled: true,
          status: 'queried',
          entityType: 'knowledge',
          verb: 'list',
          response: 'You currently have no notes in your Knowledge library.',
        }
      }

      const listItems = ctx.knowledge.slice(0, 10).map((note, idx) => {
        const preview = note.content
          ? `\n   ${note.content.length > 80 ? note.content.slice(0, 80) + '...' : note.content}`
          : ''
        return `${idx + 1}. 📄 **${note.title}** (${note.kind} · \`${note.id}\`)${preview}`
      })

      return {
        handled: true,
        status: 'queried',
        entityType: 'knowledge',
        verb: 'list',
        response: `📚 **Knowledge Notes (${ctx.knowledge.length} documents):**\n\n${listItems.join('\n')}`,
      }
    }

    if (plan.verb === 'search') {
      const q = (plan.targetQuery || '').toLowerCase().trim()
      const matches = ctx.knowledge.filter(
        (n) =>
          n.id.toLowerCase() === q ||
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      )

      if (matches.length === 0) {
        return {
          handled: true,
          status: 'queried',
          entityType: 'knowledge',
          verb: 'search',
          response: `No notes found matching "${plan.targetQuery}".`,
        }
      }

      const matchSummaries = matches.slice(0, 5).map((n) => {
        return `📄 **${n.title}** (\`${n.id}\` | ${n.kind}):\n${n.content}`
      })

      const isSummarize = /\bsummar/i.test(plan.rawPrompt)
      const summarySection = isSummarize
        ? `\n\n**Summary:**\n${matches.map((m) => `• **${m.title}**: ${m.content}`).join('\n')}`
        : ''

      return {
        handled: true,
        status: 'queried',
        entityType: 'knowledge',
        verb: 'search',
        recordId: matches[0].id,
        response: `🔍 **Found ${matches.length} matching note(s):**\n\n${matchSummaries.join('\n\n---\n\n')}${summarySection}`,
      }
    }

    if (plan.verb === 'delete') {
      const q = (plan.targetQuery || '').toLowerCase().trim()
      const match = ctx.knowledge.find(
        (n) => n.id.toLowerCase() === q || n.title.toLowerCase().includes(q)
      )

      if (!match) {
        return {
          handled: true,
          status: 'error',
          error: `Note not found matching "${plan.targetQuery}".`,
          response: `Could not find a note matching "${plan.targetQuery}".`,
        }
      }

      try {
        await ctx.onDeleteKnowledge(match.id)
        return {
          handled: true,
          status: 'executed',
          recordId: match.id,
          entityType: 'knowledge',
          verb: 'delete',
          response: `✓ **Note Removed:** Deleted "**${match.title}**" (\`${match.id}\`) from Knowledge.`,
        }
      } catch (delErr) {
        const msg = delErr instanceof Error ? delErr.message : String(delErr)
        return {
          handled: true,
          status: 'error',
          error: msg,
          response: `⚠️ **Delete Failed:** ${msg}`,
        }
      }
    }
  }

  // 5. MEMORY ACTIONS
  if (plan.entity === 'memory') {
    if (plan.verb === 'create') {
      const content = plan.content?.trim()
      if (!content) {
        return {
          handled: true,
          status: 'error',
          error: 'Memory detail cannot be empty.',
          response: 'Memory creation failed: Detail text cannot be empty.',
        }
      }

      const category = plan.category || 'Context'
      try {
        const effectiveWorkspaceId = plan.workspaceId !== undefined
          ? (plan.workspaceId ?? undefined)
          : (ctx.activeWorkspaceId ?? undefined)

        const created = await ctx.onAddMemory(category, content, effectiveWorkspaceId)

        const assignedId =
          created && typeof created === 'object' && 'id' in created
            ? (created as MemoryItem).id
            : `mem-${Date.now()}`

        // Retain in Hindsight Cloud long-term conversational memory bank
        let hindsightStatusNote = ''
        try {
          const hindsightRes = await retainMemory(
            content,
            `Category: ${category}${effectiveWorkspaceId ? `, Workspace: ${effectiveWorkspaceId}` : ''}`,
            ['nova', 'assistant', category.toLowerCase()]
          )
          if (hindsightRes.retained) {
            hindsightStatusNote = '\n- **Hindsight Cloud:** Retained in long-term memory bank.'
          } else if (hindsightRes.error === 'INSUFFICIENT_CREDITS') {
            hindsightStatusNote = '\n- **Hindsight Cloud:** Credit limit reached. Retained in local store.'
          }
        } catch {
          // Supabase remains canonical store; non-blocking
        }

        if (plan.isConversationalPreference) {
          return {
            handled: true,
            requiresAiFollowup: true,
            entityType: 'memory',
            verb: 'create',
            recordId: assignedId,
            status: 'executed',
            response: '',
          }
        }

        return {
          handled: true,
          entityType: 'memory',
          verb: 'create',
          recordId: assignedId,
          status: 'executed',
          response: `✓ **Memory Saved & Persisted**\n- **Detail:** "${content}"\n- **Category:** ${category}\n- **ID:** \`${assignedId}\`${hindsightStatusNote}\n\nPersisted successfully and retained in your memory bank.`,
        }
      } catch (persistErr) {
        const msg = persistErr instanceof Error ? persistErr.message : String(persistErr)
        return {
          handled: true,
          status: 'error',
          error: msg,
          response: `⚠️ **Persistence Failed:** ${msg}\n\nThe memory detail was not saved.`,
        }
      }
    }

    if (plan.verb === 'list') {
      if (ctx.memories.length === 0) {
        return {
          handled: true,
          status: 'queried',
          entityType: 'memory',
          verb: 'list',
          response:
            'Your memory bank is currently empty. Add preferences or facts with "Remember that [detail]".',
        }
      }

      const listItems = ctx.memories.map((m, idx) => {
        return `${idx + 1}. • **${m.category}:** "${m.content}" (\`${m.id}\`)`
      })

      return {
        handled: true,
        status: 'queried',
        entityType: 'memory',
        verb: 'list',
        response: `🧠 **Saved Memories (${ctx.memories.length} items):**\n\n${listItems.join('\n')}`,
      }
    }

    if (plan.verb === 'delete') {
      const q = (plan.targetQuery || '').toLowerCase().trim()
      const match = ctx.memories.find(
        (m) => m.id.toLowerCase() === q || m.content.toLowerCase().includes(q)
      )

      if (!match) {
        return {
          handled: true,
          status: 'error',
          error: `Memory entry not found matching "${plan.targetQuery}".`,
          response: `Could not find a memory entry matching "${plan.targetQuery}".`,
        }
      }

      try {
        await ctx.onDeleteMemory(match.id)
        try {
          await deleteMemory(match.id)
        } catch {
          // Safe non-blocking delete
        }
        return {
          handled: true,
          status: 'executed',
          recordId: match.id,
          entityType: 'memory',
          verb: 'delete',
          response: `✓ **Memory Removed:** Deleted detail "${match.content}" (\`${match.id}\`).`,
        }
      } catch (delErr) {
        const msg = delErr instanceof Error ? delErr.message : String(delErr)
        return {
          handled: true,
          status: 'error',
          error: msg,
          response: `⚠️ **Delete Failed:** ${msg}`,
        }
      }
    }
  }

  // 6. WORKSPACE ACTIONS
  if (plan.entity === 'workspace') {
    if (plan.verb === 'create') {
      const name = plan.title?.trim()
      if (!name) {
        return {
          handled: true,
          status: 'error',
          error: 'Workspace name is required.',
          response: 'Workspace creation failed: Name is required.',
        }
      }

      try {
        const rawResult: unknown = await ctx.onAddWorkspace({
          name,
          description: `Workspace created on ${new Date().toLocaleDateString()}`,
          kind: 'Project',
        })

        const assignedId =
          typeof rawResult === 'string'
            ? rawResult
            : rawResult && typeof rawResult === 'object' && 'id' in rawResult
            ? String((rawResult as { id: unknown }).id)
            : `space-${Date.now()}`

        return {
          handled: true,
          entityType: 'workspace',
          verb: 'create',
          recordId: assignedId,
          status: 'executed',
          response: `✓ **Workspace Created & Persisted:** "${name}" has been added and set as your active workspace.`,
        }
      } catch (persistErr) {
        const msg = persistErr instanceof Error ? persistErr.message : String(persistErr)
        return {
          handled: true,
          status: 'error',
          error: msg,
          response: `⚠️ **Persistence Failed:** ${msg}\n\nThe workspace was not created.`,
        }
      }
    }

    if (plan.verb === 'list') {
      if (ctx.workspaces.length === 0) {
        return {
          handled: true,
          status: 'queried',
          entityType: 'workspace',
          verb: 'list',
          response:
            'You have no dedicated workspaces yet. Everything is currently saved in your Personal space.',
        }
      }

      const listItems = ctx.workspaces.map((w, idx) => {
        const isActive = w.id === ctx.activeWorkspaceId ? ' (Active)' : ''
        return `${idx + 1}. 🏢 **${w.name}** [${w.kind}]${isActive} (\`${w.id}\`)`
      })

      return {
        handled: true,
        status: 'queried',
        entityType: 'workspace',
        verb: 'list',
        response: `🏢 **Workspaces (${ctx.workspaces.length} spaces):**\n\n${listItems.join('\n')}`,
      }
    }

    if (plan.verb === 'switch') {
      const q = (plan.targetQuery || '').toLowerCase().trim()
      const match = ctx.workspaces.find(
        (w) => w.id.toLowerCase() === q || w.name.toLowerCase().includes(q)
      )

      if (!match) {
        return {
          handled: true,
          status: 'error',
          error: `Workspace not found matching "${plan.targetQuery}".`,
          response: `Could not find a workspace matching "${plan.targetQuery}".`,
        }
      }

      ctx.onSelectWorkspace(match.id)
      return {
        handled: true,
        status: 'executed',
        recordId: match.id,
        entityType: 'workspace',
        verb: 'switch',
        response: `✓ **Switched Workspace:** Active workspace set to "**${match.name}**".`,
      }
    }

    if (plan.verb === 'update') {
      const q = (plan.targetQuery || '').toLowerCase().trim()
      const match = ctx.workspaces.find(
        (w) => w.id.toLowerCase() === q || w.name.toLowerCase().includes(q)
      )

      if (!match) {
        return {
          handled: true,
          status: 'error',
          error: `Workspace not found matching "${plan.targetQuery}".`,
          response: `Could not find a workspace matching "${plan.targetQuery}".`,
        }
      }

      if (ctx.onUpdateWorkspace) {
        try {
          await ctx.onUpdateWorkspace(match.id, plan.updates || {})
          return {
            handled: true,
            status: 'executed',
            recordId: match.id,
            entityType: 'workspace',
            verb: 'update',
            response: `✓ **Workspace Updated:** Updated "**${plan.updates?.name || match.name}**".`,
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          return {
            handled: true,
            status: 'error',
            error: msg,
            response: `⚠️ **Update Failed:** ${msg}`,
          }
        }
      }
    }

    if (plan.verb === 'delete') {
      const q = (plan.targetQuery || '').toLowerCase().trim()
      const match = ctx.workspaces.find(
        (w) => w.id.toLowerCase() === q || w.name.toLowerCase().includes(q)
      )

      if (!match) {
        return {
          handled: true,
          status: 'error',
          error: `Workspace not found matching "${plan.targetQuery}".`,
          response: `Could not find a workspace matching "${plan.targetQuery}".`,
        }
      }

      try {
        await ctx.onDeleteWorkspace(match.id)
        return {
          handled: true,
          status: 'executed',
          recordId: match.id,
          entityType: 'workspace',
          verb: 'delete',
          response: `✓ **Workspace Deleted:** Removed workspace "**${match.name}**". Associated tasks and notes have been moved to your personal lists.`,
        }
      } catch (delErr) {
        const msg = delErr instanceof Error ? delErr.message : String(delErr)
        return {
          handled: true,
          status: 'error',
          error: msg,
          response: `⚠️ **Delete Failed:** ${msg}`,
        }
      }
    }
  }

  return { handled: false, response: '', status: 'none' }
}

/**
 * Execute a validated unified action plan (supporting single and multi-actions)
 * and connect text chat, voice interactions, and user commands reliably.
 */
export async function executeUnifiedAction(ctx: ActionEngineContext): Promise<ActionResult> {
  // 1. Retrieve authorized contextual records matching the prompt (with Hindsight recall & reflect)
  const retrievedContext = await retrieveEnrichedActionContext({
    prompt: ctx.prompt,
    tasks: ctx.tasks,
    memories: ctx.memories,
    knowledge: ctx.knowledge,
    workspaces: ctx.workspaces,
    activeWorkspaceId: ctx.activeWorkspaceId,
  })

  // 2. Identify Action Intent(s)
  const plans = parseMultiActionPlan(ctx.prompt, {
    knowledge: ctx.knowledge,
    tasks: ctx.tasks,
    workspaces: ctx.workspaces,
  })

  // If no direct mutating or querying action was identified, check if contextual question
  if (plans.length === 0) {
    const isContextualInquiry =
      retrievedContext.totalMatches > 0 &&
      (/\b(summarize|what|how|show|explain|list|describe|tell|review|analyze|who|where|which|do|can|any)\b/i.test(
        ctx.prompt
      ) ||
        /\?$/.test(ctx.prompt.trim()))

    if (isContextualInquiry) {
      return {
        handled: true,
        requiresAiFollowup: true,
        status: 'queried',
        response: '',
        retrievedContext,
      }
    }

    return {
      handled: false,
      response: '',
      status: 'none',
      retrievedContext,
    }
  }

  // 3. Single Action Execution
  if (plans.length === 1) {
    const res = await executeSingleAction(plans[0], ctx)
    return {
      ...res,
      retrievedContext,
    }
  }

  // 4. Multi-Action Sequential Execution with Independent Tracking
  const subResults: ActionResult[] = []
  let dynamicActiveWorkspaceId = ctx.activeWorkspaceId
  for (const p of plans) {
    if (dynamicActiveWorkspaceId && !p.workspaceId && p.entity !== 'workspace') {
      p.workspaceId = dynamicActiveWorkspaceId
    }
    const currentCtx: ActionEngineContext = {
      ...ctx,
      activeWorkspaceId: dynamicActiveWorkspaceId,
    }
    const res = await executeSingleAction(p, currentCtx)
    if (res.entityType === 'workspace' && (res.verb === 'create' || res.verb === 'switch') && res.recordId) {
      dynamicActiveWorkspaceId = res.recordId
    }
    subResults.push(res)
  }

  const successCount = subResults.filter((r) => r.status === 'executed' || r.status === 'queried').length
  const failureCount = subResults.filter((r) => r.status === 'error').length

  let combinedStatus: ActionResult['status'] = 'executed'
  if (failureCount > 0 && successCount > 0) {
    combinedStatus = 'partially_executed'
  } else if (failureCount > 0 && successCount === 0) {
    combinedStatus = 'error'
  }

  const summaryHeader =
    combinedStatus === 'partially_executed'
      ? `⚠️ **Partial Execution (${successCount}/${plans.length} actions completed):**\n\n`
      : combinedStatus === 'error'
      ? `⚠️ **Multi-Action Execution Failed (${failureCount} errors):**\n\n`
      : `✓ **Multi-Action Execution Completed (${successCount}/${plans.length} actions):**\n\n`

  const details = subResults
    .map((r, i) => {
      const bullet = r.status === 'executed' || r.status === 'queried' ? '✓' : '⚠️'
      return `### Operation ${i + 1} (${bullet} ${r.status.toUpperCase()})\n${r.response}`
    })
    .join('\n\n---\n\n')

  return {
    handled: true,
    status: combinedStatus,
    response: `${summaryHeader}${details}`,
    subResults,
    retrievedContext,
  }
}

/**
 * Backward-compatible alias for existing callers and test suites.
 */
export const executeActionIntent = executeUnifiedAction

/**
 * Execute a structured tool invocation directly by name and parameters.
 * Shares the exact same validation, execution, and persistence pipeline as text chat and voice.
 */
export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ActionEngineContext
): Promise<ActionResult> {
  const validation = validateToolArguments(toolName, args)
  if (!validation.valid) {
    return {
      handled: true,
      status: 'error',
      error: validation.error,
      response: `Invalid tool arguments: ${validation.error}`,
    }
  }

  const cleaned = validation.cleanedArgs || args

  if (toolName === 'create_task') {
    const rawWorkspace = cleaned.workspaceName || cleaned.workspace || cleaned.workspaceId
    let workspaceId: string | undefined = undefined
    let workspaceName: string | undefined = undefined

    if (rawWorkspace) {
      const wsStr = String(rawWorkspace).trim()
      if (/^[0-9a-f-]{36}$/i.test(wsStr)) {
        workspaceId = wsStr
      } else {
        workspaceName = wsStr
      }
    }
    if (cleaned.workspaceId && /^[0-9a-f-]{36}$/i.test(String(cleaned.workspaceId))) {
      workspaceId = String(cleaned.workspaceId).trim()
    }
    if (cleaned.workspaceName) {
      workspaceName = String(cleaned.workspaceName).trim()
    }

    const plan: ActionPlan = {
      entity: 'task',
      verb: 'create',
      rawPrompt: `create task ${cleaned.title}`,
      title: String(cleaned.title || ''),
      priority: (cleaned.priority as TaskItem['priority']) || 'medium',
      scheduledAt: cleaned.scheduledAt ? String(cleaned.scheduledAt) : undefined,
      estimateMinutes: typeof cleaned.estimateMinutes === 'number' ? cleaned.estimateMinutes : 30,
      workspaceId,
      workspaceName,
    }
    return executeSingleAction(plan, ctx)
  }

  if (toolName === 'list_tasks') {
    const rawWorkspace = cleaned.workspaceName || cleaned.workspace || cleaned.workspaceId
    let workspaceId: string | undefined = undefined
    let workspaceName: string | undefined = undefined
    if (rawWorkspace) {
      const wsStr = String(rawWorkspace).trim()
      if (/^[0-9a-f-]{36}$/i.test(wsStr)) {
        workspaceId = wsStr
      } else {
        workspaceName = wsStr
      }
    }
    if (cleaned.workspaceId && /^[0-9a-f-]{36}$/i.test(String(cleaned.workspaceId))) {
      workspaceId = String(cleaned.workspaceId).trim()
    }
    if (cleaned.workspaceName) {
      workspaceName = String(cleaned.workspaceName).trim()
    }
    const plan: ActionPlan = {
      entity: 'task',
      verb: 'list',
      rawPrompt: 'list tasks',
      filter: (cleaned.filter as ActionPlan['filter']) || 'all',
      workspaceId,
      workspaceName,
      targetQuery: cleaned.query ? String(cleaned.query) : undefined,
    }
    return executeSingleAction(plan, ctx)
  }

  if (toolName === 'complete_task') {
    const rawId = cleaned.taskId || cleaned.id || ''
    const plan: ActionPlan = {
      entity: 'task',
      verb: 'complete',
      rawPrompt: `complete task ${rawId}`,
      targetQuery: String(rawId),
    }
    return executeSingleAction(plan, ctx)
  }

  if (toolName === 'update_task') {
    const rawId = cleaned.taskId || cleaned.id || ''
    const updates: Record<string, unknown> = {}
    if (cleaned.title) updates.title = cleaned.title
    if (cleaned.priority) updates.priority = cleaned.priority
    if (cleaned.scheduledAt) updates.scheduledAt = cleaned.scheduledAt
    if (cleaned.estimateMinutes) updates.estimateMinutes = cleaned.estimateMinutes
    const plan: ActionPlan = {
      entity: 'task',
      verb: 'update',
      rawPrompt: `update task ${rawId}`,
      targetQuery: String(rawId),
      updates,
    }
    return executeSingleAction(plan, ctx)
  }

  if (toolName === 'delete_task') {
    const rawId = cleaned.taskId || cleaned.id || ''
    const plan: ActionPlan = {
      entity: 'task',
      verb: 'delete',
      rawPrompt: `delete task ${rawId}`,
      targetQuery: String(rawId),
    }
    return executeSingleAction(plan, ctx)
  }

  if (toolName === 'delete_all_tasks') {
    const plan: ActionPlan = {
      entity: 'task',
      verb: 'delete',
      rawPrompt: 'delete all tasks',
      isDestructiveAll: true,
      isConfirmed: Boolean(cleaned.confirmed),
    }
    return executeSingleAction(plan, ctx)
  }

  if (toolName === 'create_workspace') {
    const plan: ActionPlan = {
      entity: 'workspace',
      verb: 'create',
      rawPrompt: `create workspace ${cleaned.name}`,
      title: String(cleaned.name || ''),
      content: cleaned.description ? String(cleaned.description) : undefined,
    }
    return executeSingleAction(plan, ctx)
  }

  if (toolName === 'list_workspaces') {
    const plan: ActionPlan = {
      entity: 'workspace',
      verb: 'list',
      rawPrompt: 'list workspaces',
    }
    return executeSingleAction(plan, ctx)
  }

  if (toolName === 'switch_workspace') {
    const rawId = cleaned.workspaceId || ''
    const plan: ActionPlan = {
      entity: 'workspace',
      verb: 'switch',
      rawPrompt: `switch workspace ${rawId}`,
      targetQuery: String(rawId),
    }
    return executeSingleAction(plan, ctx)
  }

  if (toolName === 'update_workspace') {
    const rawId = cleaned.workspaceId || ''
    const updates: Record<string, unknown> = {}
    if (cleaned.name) updates.name = cleaned.name
    if (cleaned.description) updates.description = cleaned.description
    const plan: ActionPlan = {
      entity: 'workspace',
      verb: 'update',
      rawPrompt: `update workspace ${rawId}`,
      targetQuery: String(rawId),
      title: cleaned.name ? String(cleaned.name) : undefined,
      updates,
    }
    return executeSingleAction(plan, ctx)
  }

  if (toolName === 'delete_workspace') {
    const rawId = cleaned.workspaceId || ''
    const plan: ActionPlan = {
      entity: 'workspace',
      verb: 'delete',
      rawPrompt: `delete workspace ${rawId}`,
      targetQuery: String(rawId),
    }
    return executeSingleAction(plan, ctx)
  }

  if (toolName === 'save_note') {
    const rawWorkspace = cleaned.workspaceName || cleaned.workspace || cleaned.workspaceId
    let workspaceId: string | undefined = undefined
    let workspaceName: string | undefined = undefined

    if (rawWorkspace) {
      const wsStr = String(rawWorkspace).trim()
      if (/^[0-9a-f-]{36}$/i.test(wsStr)) {
        workspaceId = wsStr
      } else {
        workspaceName = wsStr
      }
    }
    if (cleaned.workspaceId && /^[0-9a-f-]{36}$/i.test(String(cleaned.workspaceId))) {
      workspaceId = String(cleaned.workspaceId).trim()
    }
    if (cleaned.workspaceName) {
      workspaceName = String(cleaned.workspaceName).trim()
    }

    if (workspaceName && /^(?:my\s+)?personal(?:\s+(?:notes?|space))?$/i.test(workspaceName)) {
      workspaceName = undefined
    }

    const title = String(cleaned.title || cleaned.name || '').trim()
    const content = String(cleaned.content || cleaned.body || cleaned.text || title).trim()
    let kind = cleaned.kind as KnowledgeItem['kind'] | undefined
    if (!kind || !['Project notes', 'Reference', 'Personal note'].includes(kind)) {
      const rawKind = String(cleaned.kind || '').toLowerCase()
      if (rawKind.includes('personal')) kind = 'Personal note'
      else if (rawKind.includes('reference')) kind = 'Reference'
      else if (rawKind.includes('project')) kind = 'Project notes'
      else kind = 'Personal note'
    }

    const plan: ActionPlan = {
      entity: 'knowledge',
      verb: 'create',
      rawPrompt: `save note ${title}`,
      title,
      content,
      kind,
      tags: Array.isArray(cleaned.tags) ? (cleaned.tags as string[]) : [],
      workspaceId,
      workspaceName,
    }
    return executeSingleAction(plan, ctx)
  }

  if (toolName === 'search_notes') {
    const rawWorkspace = cleaned.workspaceName || cleaned.workspace || cleaned.workspaceId
    let workspaceId: string | undefined = undefined
    let workspaceName: string | undefined = undefined
    if (rawWorkspace) {
      const wsStr = String(rawWorkspace).trim()
      if (/^[0-9a-f-]{36}$/i.test(wsStr)) {
        workspaceId = wsStr
      } else {
        workspaceName = wsStr
      }
    }
    if (cleaned.workspaceId && /^[0-9a-f-]{36}$/i.test(String(cleaned.workspaceId))) {
      workspaceId = String(cleaned.workspaceId).trim()
    }
    if (cleaned.workspaceName) {
      workspaceName = String(cleaned.workspaceName).trim()
    }
    const plan: ActionPlan = {
      entity: 'knowledge',
      verb: 'search',
      rawPrompt: `search notes ${cleaned.query}`,
      targetQuery: String(cleaned.query || ''),
      workspaceId,
      workspaceName,
    }
    return executeSingleAction(plan, ctx)
  }

  if (toolName === 'delete_note') {
    const rawId = cleaned.noteId || cleaned.id || ''
    const plan: ActionPlan = {
      entity: 'knowledge',
      verb: 'delete',
      rawPrompt: `delete note ${rawId}`,
      targetQuery: String(rawId),
    }
    return executeSingleAction(plan, ctx)
  }

  if (toolName === 'save_memory') {
    const plan: ActionPlan = {
      entity: 'memory',
      verb: 'create',
      rawPrompt: `save memory ${cleaned.content}`,
      content: String(cleaned.content || ''),
      category: cleaned.category ? String(cleaned.category) : 'Context',
      workspaceId: cleaned.workspaceId ? String(cleaned.workspaceId) : undefined,
    }
    return executeSingleAction(plan, ctx)
  }

  if (toolName === 'list_memories') {
    const plan: ActionPlan = {
      entity: 'memory',
      verb: 'list',
      rawPrompt: 'list memories',
    }
    return executeSingleAction(plan, ctx)
  }

  if (toolName === 'delete_memory') {
    const rawId = cleaned.memoryId || cleaned.id || ''
    const plan: ActionPlan = {
      entity: 'memory',
      verb: 'delete',
      rawPrompt: `delete memory ${rawId}`,
      targetQuery: String(rawId),
    }
    return executeSingleAction(plan, ctx)
  }

  return {
    handled: false,
    status: 'none',
    response: `Unsupported tool "${toolName}".`,
  }
}
