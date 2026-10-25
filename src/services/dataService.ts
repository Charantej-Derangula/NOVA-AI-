export {
  isSupabaseConfigured,
  getSupabaseConfigStatus,
  checkSupabaseConnection,
  getCurrentAuthInfo,
  getCurrentUserId,
  signInAnonymously,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  updateUserProfile,
  resetPasswordForEmail,
  onAuthStateChange,
  REQUIRED_TABLES,
  type SupabaseConfigStatus,
  type SupabaseConnectionState,
  type AuthStateResult,
} from '../lib/supabaseClient.ts'
import {
  getSupabaseClient,
  isSupabaseConfigured,
  checkSupabaseConnection,
  getCurrentAuthInfo,
  getCurrentUserId,
} from '../lib/supabaseClient.ts'
import {
  readStoredValue,
  createStorageSnapshot,
} from '../hooks/useLocalStorageState.ts'
import type {
  TaskItem,
  KnowledgeItem,
  MemoryItem,
  WorkspaceItem,
  ChatSession,
  ChatMessage,
} from '../types/index.ts'

export interface RecordCounts {
  tasks: number
  memories: number
  knowledge: number
  workspaces: number
  sessions: number
  messages: number
}

export interface MigrationResult {
  success: boolean
  verified: boolean
  source: 'local' | 'supabase'
  localCounts: RecordCounts
  migratedCounts: RecordCounts
  verifiedCounts: RecordCounts
  error?: string
  timestamp: string
}

export interface PersistenceResult<T> {
  success: boolean
  data: T | null
  source: 'supabase' | 'local'
  error?: string
}

export interface TaskRow {
  id: string
  user_id: string
  workspace_id?: string | null
  title: string
  completed: boolean
  scheduled_at?: string | null
  estimate_minutes?: number | null
  priority: string
  completed_at?: string | null
  created_at: string
  updated_at?: string
}

export interface KnowledgeRow {
  id: string
  user_id: string
  workspace_id?: string | null
  title: string
  kind: string
  content: string
  tags: string[]
  created_at: string
  updated_at?: string
}

export interface MemoryRow {
  id: string
  user_id: string
  workspace_id?: string | null
  category: string
  content: string
  date_added: string
  created_at?: string
  updated_at?: string
}

export interface WorkspaceRow {
  id: string
  user_id: string
  name: string
  description?: string
  kind: string
  created_at: string
  updated_at?: string
}

// ==============================================================================
// MAPPER UTILITIES: Convert between DB snake_case & Application camelCase
// ==============================================================================

export function mapTaskFromDb(row: Record<string, unknown>): TaskItem {
  return {
    id: String(row.id),
    title: String(row.title || ''),
    completed: Boolean(row.completed),
    scheduledAt: row.scheduled_at ? String(row.scheduled_at) : undefined,
    estimateMinutes: typeof row.estimate_minutes === 'number' ? row.estimate_minutes : 30,
    priority: (row.priority as TaskItem['priority']) || 'medium',
    createdAt: String(row.created_at || new Date().toISOString()),
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
    workspaceId: row.workspace_id ? String(row.workspace_id) : undefined,
  }
}

export function mapTaskToDb(task: TaskItem, userId: string): TaskRow {
  return {
    id: task.id,
    user_id: userId,
    workspace_id: task.workspaceId || null,
    title: task.title,
    completed: task.completed,
    scheduled_at: task.scheduledAt || null,
    estimate_minutes: task.estimateMinutes,
    priority: task.priority,
    completed_at: task.completedAt || null,
    created_at: task.createdAt,
    updated_at: new Date().toISOString(),
  }
}

export function mapKnowledgeFromDb(row: Record<string, unknown>): KnowledgeItem {
  return {
    id: String(row.id),
    title: String(row.title || ''),
    kind: (row.kind as KnowledgeItem['kind']) || 'Personal note',
    content: String(row.content || ''),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    workspaceId: row.workspace_id ? String(row.workspace_id) : undefined,
  }
}

export function mapKnowledgeToDb(note: KnowledgeItem, userId: string): KnowledgeRow {
  return {
    id: note.id,
    user_id: userId,
    workspace_id: note.workspaceId || null,
    title: note.title,
    kind: note.kind,
    content: note.content,
    tags: note.tags || [],
    created_at: note.createdAt,
    updated_at: note.updatedAt || new Date().toISOString(),
  }
}

export function mapMemoryFromDb(row: Record<string, unknown>): MemoryItem {
  return {
    id: String(row.id),
    category: String(row.category || 'General'),
    content: String(row.content || ''),
    dateAdded: String(row.date_added || 'Today'),
    workspaceId: row.workspace_id ? String(row.workspace_id) : undefined,
  }
}

export function mapMemoryToDb(memory: MemoryItem, userId: string): MemoryRow {
  return {
    id: memory.id,
    user_id: userId,
    workspace_id: memory.workspaceId || null,
    category: memory.category,
    content: memory.content,
    date_added: memory.dateAdded,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export function mapWorkspaceFromDb(row: Record<string, unknown>): WorkspaceItem {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    description: String(row.description || ''),
    kind: (row.kind as WorkspaceItem['kind']) || 'Project',
    createdAt: String(row.created_at || new Date().toISOString()),
  }
}

export function mapWorkspaceToDb(workspace: WorkspaceItem, userId: string): WorkspaceRow {
  return {
    id: workspace.id,
    user_id: userId,
    name: workspace.name,
    description: workspace.description || '',
    kind: workspace.kind,
    created_at: workspace.createdAt,
    updated_at: new Date().toISOString(),
  }
}

export function mapChatMessageFromDb(row: Record<string, unknown>): ChatMessage {
  return {
    id: String(row.id),
    role: (row.role as ChatMessage['role']) || 'user',
    content: String(row.content || ''),
    timestamp: String(row.timestamp || ''),
    attachment: row.attachment ? (row.attachment as ChatMessage['attachment']) : undefined,
  }
}

export function mapChatMessageToDb(msg: ChatMessage, sessionId: string, userId: string, orderIndex = 0): Record<string, unknown> {
  return {
    id: msg.id,
    session_id: sessionId,
    user_id: userId,
    order_index: orderIndex,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
    attachment: msg.attachment || null,
    created_at: new Date().toISOString(),
  }
}

export function mapChatSessionToDb(session: ChatSession, userId: string): Record<string, unknown> {
  return {
    id: session.id,
    user_id: userId,
    workspace_id: session.workspaceId || null,
    title: session.title,
    updated_at: session.updatedAt,
    created_at: new Date().toISOString(),
  }
}

export function mapChatSessionFromDb(row: Record<string, unknown>, messages: ChatMessage[] = []): ChatSession {
  return {
    id: String(row.id),
    title: String(row.title || 'Conversation'),
    updatedAt: String(row.updated_at || 'Recently'),
    workspaceId: row.workspace_id ? String(row.workspace_id) : undefined,
    messages,
    ...(row.is_pinned !== undefined ? { isPinned: Boolean(row.is_pinned) } : {}),
    ...(row.is_archived !== undefined ? { isArchived: Boolean(row.is_archived) } : {}),
  }
}

export const taskToRow = mapTaskToDb
export const rowToTask = mapTaskFromDb
export const knowledgeToRow = mapKnowledgeToDb
export const rowToKnowledge = mapKnowledgeFromDb
export const memoryToRow = mapMemoryToDb
export const rowToMemory = mapMemoryFromDb
export const workspaceToRow = mapWorkspaceToDb
export const rowToWorkspace = mapWorkspaceFromDb
export const chatSessionToRow = mapChatSessionToDb
export const rowToChatSession = mapChatSessionFromDb
export const chatMessageToRow = mapChatMessageToDb
export const rowToChatMessage = mapChatMessageFromDb

// ==============================================================================
// LOCAL STORAGE BACKUP & INSPECTION
// ==============================================================================

export function countLocalRecords(): RecordCounts {
  const tasks = readStoredValue<TaskItem[]>('nova:tasks:v1', [])
  const memories = readStoredValue<MemoryItem[]>('nova:memories:v1', [])
  const knowledge = readStoredValue<KnowledgeItem[]>('nova:knowledge:v1', [])
  const workspaces = readStoredValue<WorkspaceItem[]>('nova:workspaces:v1', [])
  const sessions = readStoredValue<ChatSession[]>('nova:sessions:v1', [])
  const messagesCount = sessions.reduce((acc, s) => acc + (s.messages?.length || 0), 0)

  return {
    tasks: tasks.length,
    memories: memories.length,
    knowledge: knowledge.length,
    workspaces: workspaces.length,
    sessions: sessions.length,
    messages: messagesCount,
  }
}

// ==============================================================================
// CANONICAL DATA ACCESS LAYER: TASKS
// ==============================================================================

export async function fetchTasks(overrideUserId?: string): Promise<{ data: TaskItem[]; source: 'supabase' | 'local'; error?: string }> {
  const client = getSupabaseClient()
  if (client) {
    try {
      const userId = overrideUserId || (await getCurrentUserId())
      if (!userId) {
        const local = readStoredValue<TaskItem[]>('nova:tasks:v1', [])
        return { data: local, source: 'local', error: 'Authentication required for cloud tasks.' }
      }

      const { data, error } = await client
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (!error && Array.isArray(data)) {
        const mapped = data.map((d) => mapTaskFromDb(d))
        // Update local cache safely
        try {
          localStorage.setItem('nova:tasks:v1', JSON.stringify(mapped))
        } catch { /* Quota */ }
        return { data: mapped, source: 'supabase' }
      }
      if (error) {
        console.warn('[NOVA Supabase] Failed to fetch tasks:', error.message)
        const local = readStoredValue<TaskItem[]>('nova:tasks:v1', [])
        return { data: local, source: 'local', error: error.message }
      }
    } catch (err) {
      console.warn('[NOVA Supabase] Network error fetching tasks:', err)
      const local = readStoredValue<TaskItem[]>('nova:tasks:v1', [])
      return { data: local, source: 'local', error: err instanceof Error ? err.message : String(err) }
    }
  }

  // Fallback to local storage
  const local = readStoredValue<TaskItem[]>('nova:tasks:v1', [])
  return { data: local, source: 'local' }
}

export async function persistTask(task: TaskItem, overrideUserId?: string): Promise<PersistenceResult<TaskItem>> {
  const client = getSupabaseClient()
  if (client) {
    try {
      const userId = overrideUserId || (await getCurrentUserId())
      if (!userId) {
        return {
          success: false,
          data: null,
          source: 'supabase',
          error: 'Authentication required to persist task to Supabase.',
        }
      }

      const payload = mapTaskToDb(task, userId)
      const { error } = await client.from('tasks').upsert(payload, { onConflict: 'id' })

      if (error) {
        return { success: false, data: null, source: 'supabase', error: error.message }
      }

      // Sync into local store on success
      const local = readStoredValue<TaskItem[]>('nova:tasks:v1', [])
      const updated = [task, ...local.filter((t) => t.id !== task.id)]
      localStorage.setItem('nova:tasks:v1', JSON.stringify(updated))

      return { success: true, data: task, source: 'supabase' }
    } catch (err) {
      return {
        success: false,
        data: null,
        source: 'supabase',
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  // Local storage mode
  try {
    const local = readStoredValue<TaskItem[]>('nova:tasks:v1', [])
    const updated = [task, ...local.filter((t) => t.id !== task.id)]
    localStorage.setItem('nova:tasks:v1', JSON.stringify(updated))
    return { success: true, data: task, source: 'local' }
  } catch (err) {
    return {
      success: false,
      data: null,
      source: 'local',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function removeTask(id: string, overrideUserId?: string): Promise<{ success: boolean; source: 'supabase' | 'local'; error?: string }> {
  const client = getSupabaseClient()
  if (client) {
    try {
      const userId = overrideUserId || (await getCurrentUserId())
      if (!userId) {
        return { success: false, source: 'supabase', error: 'Authentication required.' }
      }

      const { error } = await client.from('tasks').delete().eq('id', id).eq('user_id', userId)
      if (error) {
        return { success: false, source: 'supabase', error: error.message }
      }

      // Sync to local
      const local = readStoredValue<TaskItem[]>('nova:tasks:v1', [])
      localStorage.setItem('nova:tasks:v1', JSON.stringify(local.filter((t) => t.id !== id)))
      return { success: true, source: 'supabase' }
    } catch (err) {
      return { success: false, source: 'supabase', error: err instanceof Error ? err.message : String(err) }
    }
  }

  const local = readStoredValue<TaskItem[]>('nova:tasks:v1', [])
  localStorage.setItem('nova:tasks:v1', JSON.stringify(local.filter((t) => t.id !== id)))
  return { success: true, source: 'local' }
}

export async function removeAllTasks(overrideUserId?: string): Promise<{ success: boolean; source: 'supabase' | 'local'; count: number; error?: string }> {
  const client = getSupabaseClient()
  if (client) {
    try {
      const userId = overrideUserId || (await getCurrentUserId())
      if (!userId) {
        return { success: false, source: 'supabase', count: 0, error: 'Authentication required.' }
      }

      const { data, error } = await client.from('tasks').delete().eq('user_id', userId).select('id')
      if (error) {
        return { success: false, source: 'supabase', count: 0, error: error.message }
      }

      localStorage.setItem('nova:tasks:v1', '[]')
      return { success: true, source: 'supabase', count: data?.length || 0 }
    } catch (err) {
      return { success: false, source: 'supabase', count: 0, error: err instanceof Error ? err.message : String(err) }
    }
  }

  const local = readStoredValue<TaskItem[]>('nova:tasks:v1', [])
  const count = local.length
  localStorage.setItem('nova:tasks:v1', '[]')
  return { success: true, source: 'local', count }
}

// ==============================================================================
// CANONICAL DATA ACCESS LAYER: KNOWLEDGE (NOTES)
// ==============================================================================

export async function fetchKnowledge(overrideUserId?: string): Promise<{ data: KnowledgeItem[]; source: 'supabase' | 'local'; error?: string }> {
  const client = getSupabaseClient()
  if (client) {
    try {
      const userId = overrideUserId || (await getCurrentUserId())
      if (!userId) {
        const local = readStoredValue<KnowledgeItem[]>('nova:knowledge:v1', [])
        return { data: local, source: 'local', error: 'Authentication required for cloud notes.' }
      }

      const { data, error } = await client
        .from('knowledge')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (!error && Array.isArray(data)) {
        const mapped = data.map((d) => mapKnowledgeFromDb(d))
        try {
          localStorage.setItem('nova:knowledge:v1', JSON.stringify(mapped))
        } catch { /* Quota */ }
        return { data: mapped, source: 'supabase' }
      }
      if (error) {
        console.warn('[NOVA Supabase] Failed to fetch knowledge:', error.message)
        const local = readStoredValue<KnowledgeItem[]>('nova:knowledge:v1', [])
        return { data: local, source: 'local', error: error.message }
      }
    } catch (err) {
      console.warn('[NOVA Supabase] Network error fetching knowledge:', err)
      const local = readStoredValue<KnowledgeItem[]>('nova:knowledge:v1', [])
      return { data: local, source: 'local', error: err instanceof Error ? err.message : String(err) }
    }
  }

  const local = readStoredValue<KnowledgeItem[]>('nova:knowledge:v1', [])
  return { data: local, source: 'local' }
}

export async function persistKnowledge(note: KnowledgeItem, overrideUserId?: string): Promise<PersistenceResult<KnowledgeItem>> {
  const client = getSupabaseClient()
  if (client) {
    try {
      const userId = overrideUserId || (await getCurrentUserId())
      if (!userId) {
        return { success: false, data: null, source: 'supabase', error: 'Authentication required.' }
      }

      const payload = mapKnowledgeToDb(note, userId)
      const { error } = await client.from('knowledge').upsert(payload, { onConflict: 'id' })

      if (error) {
        return { success: false, data: null, source: 'supabase', error: error.message }
      }

      const local = readStoredValue<KnowledgeItem[]>('nova:knowledge:v1', [])
      const updated = [note, ...local.filter((n) => n.id !== note.id)]
      localStorage.setItem('nova:knowledge:v1', JSON.stringify(updated))
      return { success: true, data: note, source: 'supabase' }
    } catch (err) {
      return { success: false, data: null, source: 'supabase', error: err instanceof Error ? err.message : String(err) }
    }
  }

  try {
    const local = readStoredValue<KnowledgeItem[]>('nova:knowledge:v1', [])
    const updated = [note, ...local.filter((n) => n.id !== note.id)]
    localStorage.setItem('nova:knowledge:v1', JSON.stringify(updated))
    return { success: true, data: note, source: 'local' }
  } catch (err) {
    return { success: false, data: null, source: 'local', error: err instanceof Error ? err.message : String(err) }
  }
}

export async function removeKnowledge(id: string, overrideUserId?: string): Promise<{ success: boolean; source: 'supabase' | 'local'; error?: string }> {
  const client = getSupabaseClient()
  if (client) {
    try {
      const userId = overrideUserId || (await getCurrentUserId())
      if (!userId) {
        return { success: false, source: 'supabase', error: 'Authentication required.' }
      }
      const { error } = await client.from('knowledge').delete().eq('id', id).eq('user_id', userId)
      if (error) {
        return { success: false, source: 'supabase', error: error.message }
      }
      const local = readStoredValue<KnowledgeItem[]>('nova:knowledge:v1', [])
      localStorage.setItem('nova:knowledge:v1', JSON.stringify(local.filter((n) => n.id !== id)))
      return { success: true, source: 'supabase' }
    } catch (err) {
      return { success: false, source: 'supabase', error: err instanceof Error ? err.message : String(err) }
    }
  }

  const local = readStoredValue<KnowledgeItem[]>('nova:knowledge:v1', [])
  localStorage.setItem('nova:knowledge:v1', JSON.stringify(local.filter((n) => n.id !== id)))
  return { success: true, source: 'local' }
}

// ==============================================================================
// CANONICAL DATA ACCESS LAYER: MEMORIES
// ==============================================================================

export async function fetchMemories(overrideUserId?: string): Promise<{ data: MemoryItem[]; source: 'supabase' | 'local'; error?: string }> {
  const local = readStoredValue<MemoryItem[]>('nova:memories:v1', [])
  const client = getSupabaseClient()
  if (client) {
    try {
      const userId = overrideUserId || (await getCurrentUserId())
      let query = client
        .from('memories')
        .select('*')
        .order('created_at', { ascending: false })

      if (userId) {
        query = query.eq('user_id', userId)
      }

      const { data, error } = await query

      if (error) {
        return { data: local, source: 'supabase', error: error.message }
      }

      if (Array.isArray(data)) {
        const mapped = data.map((d) => mapMemoryFromDb(d))
        try {
          localStorage.setItem('nova:memories:v1', JSON.stringify(mapped))
        } catch { /* Quota */ }
        return { data: mapped, source: 'supabase' }
      }
    } catch (err) {
      console.warn('[NOVA Supabase] Network error fetching memories:', err)
      return { data: local, source: 'supabase', error: err instanceof Error ? err.message : String(err) }
    }
  }

  return { data: local, source: 'local' }
}

export async function persistMemory(memory: MemoryItem, overrideUserId?: string): Promise<PersistenceResult<MemoryItem>> {
  const client = getSupabaseClient()
  if (client) {
    try {
      const userId = overrideUserId || (await getCurrentUserId())
      if (!userId) {
        return { success: false, data: null, source: 'supabase', error: 'Authentication required.' }
      }

      const payload = mapMemoryToDb(memory, userId)
      const { error } = await client.from('memories').upsert(payload, { onConflict: 'id' })

      if (error) {
        return { success: false, data: null, source: 'supabase', error: error.message }
      }

      const local = readStoredValue<MemoryItem[]>('nova:memories:v1', [])
      const updated = [memory, ...local.filter((m) => m.id !== memory.id)]
      localStorage.setItem('nova:memories:v1', JSON.stringify(updated))
      return { success: true, data: memory, source: 'supabase' }
    } catch (err) {
      return { success: false, data: null, source: 'supabase', error: err instanceof Error ? err.message : String(err) }
    }
  }

  try {
    const local = readStoredValue<MemoryItem[]>('nova:memories:v1', [])
    const updated = [memory, ...local.filter((m) => m.id !== memory.id)]
    localStorage.setItem('nova:memories:v1', JSON.stringify(updated))
    return { success: true, data: memory, source: 'local' }
  } catch (err) {
    return { success: false, data: null, source: 'local', error: err instanceof Error ? err.message : String(err) }
  }
}

export async function removeMemory(id: string, overrideUserId?: string): Promise<{ success: boolean; source: 'supabase' | 'local'; error?: string }> {
  const client = getSupabaseClient()
  if (client) {
    try {
      const userId = overrideUserId || (await getCurrentUserId())
      if (!userId) {
        return { success: false, source: 'supabase', error: 'Authentication required.' }
      }
      const { error } = await client.from('memories').delete().eq('id', id).eq('user_id', userId)
      if (error) {
        return { success: false, source: 'supabase', error: error.message }
      }
      const local = readStoredValue<MemoryItem[]>('nova:memories:v1', [])
      localStorage.setItem('nova:memories:v1', JSON.stringify(local.filter((m) => m.id !== id)))
      return { success: true, source: 'supabase' }
    } catch (err) {
      return { success: false, source: 'supabase', error: err instanceof Error ? err.message : String(err) }
    }
  }

  const local = readStoredValue<MemoryItem[]>('nova:memories:v1', [])
  localStorage.setItem('nova:memories:v1', JSON.stringify(local.filter((m) => m.id !== id)))
  return { success: true, source: 'local' }
}

// ==============================================================================
// CANONICAL DATA ACCESS LAYER: WORKSPACES
// ==============================================================================

export async function fetchWorkspaces(overrideUserId?: string): Promise<{ data: WorkspaceItem[]; source: 'supabase' | 'local'; error?: string }> {
  const local = readStoredValue<WorkspaceItem[]>('nova:workspaces:v1', [])
  const client = getSupabaseClient()
  if (client) {
    try {
      const userId = overrideUserId || (await getCurrentUserId())
      let query = client
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false })

      if (userId) {
        query = query.eq('user_id', userId)
      }

      const { data, error } = await query

      if (error) {
        return { data: local, source: 'supabase', error: error.message }
      }

      if (Array.isArray(data)) {
        const mapped = data.map((d) => mapWorkspaceFromDb(d))
        try {
          localStorage.setItem('nova:workspaces:v1', JSON.stringify(mapped))
        } catch { /* Quota */ }
        return { data: mapped, source: 'supabase' }
      }
    } catch (err) {
      console.warn('[NOVA Supabase] Network error fetching workspaces:', err)
      return { data: local, source: 'supabase', error: err instanceof Error ? err.message : String(err) }
    }
  }

  return { data: local, source: 'local' }
}

export async function persistWorkspace(workspace: WorkspaceItem, overrideUserId?: string): Promise<PersistenceResult<WorkspaceItem>> {
  const client = getSupabaseClient()
  if (client) {
    try {
      const userId = overrideUserId || (await getCurrentUserId())
      if (!userId) {
        return { success: false, data: null, source: 'supabase', error: 'Authentication required.' }
      }

      const payload = mapWorkspaceToDb(workspace, userId)
      const { error } = await client.from('workspaces').upsert(payload, { onConflict: 'id' })

      if (error) {
        return { success: false, data: null, source: 'supabase', error: error.message }
      }

      const local = readStoredValue<WorkspaceItem[]>('nova:workspaces:v1', [])
      const updated = [workspace, ...local.filter((w) => w.id !== workspace.id)]
      localStorage.setItem('nova:workspaces:v1', JSON.stringify(updated))
      return { success: true, data: workspace, source: 'supabase' }
    } catch (err) {
      return { success: false, data: null, source: 'supabase', error: err instanceof Error ? err.message : String(err) }
    }
  }

  try {
    const local = readStoredValue<WorkspaceItem[]>('nova:workspaces:v1', [])
    const updated = [workspace, ...local.filter((w) => w.id !== workspace.id)]
    localStorage.setItem('nova:workspaces:v1', JSON.stringify(updated))
    return { success: true, data: workspace, source: 'local' }
  } catch (err) {
    return { success: false, data: null, source: 'local', error: err instanceof Error ? err.message : String(err) }
  }
}

export async function removeWorkspace(id: string, overrideUserId?: string): Promise<{ success: boolean; source: 'supabase' | 'local'; error?: string }> {
  const client = getSupabaseClient()
  if (client) {
    try {
      const userId = overrideUserId || (await getCurrentUserId())
      if (!userId) {
        return { success: false, source: 'supabase', error: 'Authentication required.' }
      }
      const { error } = await client.from('workspaces').delete().eq('id', id).eq('user_id', userId)
      if (error) {
        return { success: false, source: 'supabase', error: error.message }
      }
      const local = readStoredValue<WorkspaceItem[]>('nova:workspaces:v1', [])
      localStorage.setItem('nova:workspaces:v1', JSON.stringify(local.filter((w) => w.id !== id)))
      return { success: true, source: 'supabase' }
    } catch (err) {
      return { success: false, source: 'supabase', error: err instanceof Error ? err.message : String(err) }
    }
  }

  const local = readStoredValue<WorkspaceItem[]>('nova:workspaces:v1', [])
  localStorage.setItem('nova:workspaces:v1', JSON.stringify(local.filter((w) => w.id !== id)))
  return { success: true, source: 'local' }
}

// ==============================================================================
// CANONICAL DATA ACCESS LAYER: CHAT SESSIONS & MESSAGES
// ==============================================================================

export async function persistChatSession(session: ChatSession): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient()
  if (client) {
    try {
      const userId = await getCurrentUserId()
      if (userId) {
        const sessionPayload = {
          id: session.id,
          user_id: userId,
          workspace_id: session.workspaceId || null,
          title: session.title,
          updated_at: session.updatedAt,
          created_at: new Date().toISOString(),
        }
        await client.from('chat_sessions').upsert(sessionPayload, { onConflict: 'id' })

        if (session.messages && session.messages.length > 0) {
          const messagesPayload = session.messages.map((m, idx) => mapChatMessageToDb(m, session.id, userId, idx))
          await client.from('chat_messages').upsert(messagesPayload, { onConflict: 'id' })
        }
      }
    } catch (err) {
      console.warn('[NOVA Supabase] Failed to persist chat session:', err)
    }
  }

  // Local storage cache
  try {
    const local = readStoredValue<ChatSession[]>('nova:sessions:v1', [])
    const updated = [session, ...local.filter((s) => s.id !== session.id)]
    localStorage.setItem('nova:sessions:v1', JSON.stringify(updated))
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function deleteChatSession(id: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient()
  if (client) {
    try {
      const userId = await getCurrentUserId()
      if (userId) {
        await client.from('chat_messages').delete().eq('session_id', id).eq('user_id', userId)
        await client.from('chat_sessions').delete().eq('id', id).eq('user_id', userId)
      }
    } catch (err) {
      console.warn('[NOVA Supabase] Failed to delete chat session:', err)
    }
  }

  try {
    const local = readStoredValue<ChatSession[]>('nova:sessions:v1', [])
    localStorage.setItem('nova:sessions:v1', JSON.stringify(local.filter((s) => s.id !== id)))
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function fetchChatSessions(): Promise<{ data: ChatSession[]; source: 'supabase' | 'local'; error?: string }> {
  const client = getSupabaseClient()
  if (client) {
    try {
      const userId = await getCurrentUserId()
      if (userId) {
        const { data: dbSessions, error: sErr } = await client
          .from('chat_sessions')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })

        if (!sErr && Array.isArray(dbSessions)) {
          const { data: dbMessages } = await client
            .from('chat_messages')
            .select('*')
            .eq('user_id', userId)
            .order('order_index', { ascending: true })

          const messagesBySession = new Map<string, ChatMessage[]>()
          if (Array.isArray(dbMessages)) {
            for (const row of dbMessages) {
              const sId = String(row.session_id)
              const mapped = mapChatMessageFromDb(row)
              const list = messagesBySession.get(sId) || []
              list.push(mapped)
              messagesBySession.set(sId, list)
            }
          }

          const cloudSessions = dbSessions.map((row) => {
            const sId = String(row.id)
            const msgs = messagesBySession.get(sId) || []
            return mapChatSessionFromDb(row, msgs)
          })

          // Reconcile safely: never lose or overwrite local sessions or messages
          const local = readStoredValue<ChatSession[]>('nova:sessions:v1', [])
          const map = new Map<string, ChatSession>()

          for (const cs of cloudSessions) {
            map.set(cs.id, cs)
          }

          for (const loc of local) {
            const existing = map.get(loc.id)
            if (!existing) {
              map.set(loc.id, loc)
            } else {
              // If local has more or equal messages, retain local messages
              if ((loc.messages?.length || 0) >= (existing.messages?.length || 0)) {
                map.set(loc.id, {
                  ...existing,
                  title: loc.title || existing.title,
                  messages: loc.messages,
                })
              }
            }
          }

          const merged = Array.from(map.values())
          try {
            localStorage.setItem('nova:sessions:v1', JSON.stringify(merged))
          } catch { /* storage quota */ }

          return { data: merged, source: 'supabase' }
        }
      }
    } catch (err) {
      console.warn('[NOVA Supabase] Network error fetching chat sessions:', err)
    }
  }

  const local = readStoredValue<ChatSession[]>('nova:sessions:v1', [])
  return { data: local, source: 'local' }
}

export async function fetchChatSession(id: string): Promise<{ data: ChatSession | null; source: 'supabase' | 'local'; error?: string }> {
  const local = readStoredValue<ChatSession[]>('nova:sessions:v1', [])
  const localSession = local.find((s) => s.id === id)

  const client = getSupabaseClient()
  if (client) {
    try {
      const userId = await getCurrentUserId()
      if (userId) {
        const { data: dbSession, error: sErr } = await client
          .from('chat_sessions')
          .select('*')
          .eq('id', id)
          .eq('user_id', userId)
          .maybeSingle()

        if (!sErr && dbSession) {
          const { data: dbMessages } = await client
            .from('chat_messages')
            .select('*')
            .eq('session_id', id)
            .eq('user_id', userId)
            .order('order_index', { ascending: true })

          const messages = Array.isArray(dbMessages) ? dbMessages.map(mapChatMessageFromDb) : []
          const cloudSession = mapChatSessionFromDb(dbSession, messages)

          if (localSession && (localSession.messages?.length || 0) >= cloudSession.messages.length) {
            cloudSession.messages = localSession.messages
          }

          return { data: cloudSession, source: 'supabase' }
        }
      }
    } catch (err) {
      console.warn('[NOVA Supabase] Network error fetching chat session:', err)
      if (localSession) {
        return { data: localSession, source: 'local', error: err instanceof Error ? err.message : String(err) }
      }
      return { data: null, source: 'supabase', error: err instanceof Error ? err.message : String(err) }
    }
  }

  return { data: localSession || null, source: 'local' }
}

// ==============================================================================
// IDEMPOTENT MIGRATION: Local Storage -> Supabase PostgreSQL
// ==============================================================================

/**
 * Perform a safe, idempotent migration from browser local storage into Supabase PostgreSQL.
 *
 * Requirements enforced:
 * 1. Step 0: Backup all local records with timestamp before touching anything.
 * 2. Step 1: Pre-flight verify live connection and schema tables in Supabase.
 * 3. Step 2: Verify active user authentication (anonymous or email session).
 * 4. Step 3: Upsert workspaces first (foreign key dependency).
 * 5. Step 4: Upsert tasks, knowledge, memories using stable existing IDs and valid foreign keys.
 * 6. Step 5: Upsert chat sessions and ordered chat messages.
 * 7. Step 6: Verification query: Compare record counts in Supabase to local counts.
 * 8. Step 7: Retain all local storage records permanently (never delete or wipe).
 */
export async function migrateLocalStorageToSupabase(): Promise<MigrationResult> {
  const timestamp = new Date().toISOString()
  const localCounts = countLocalRecords()

  const emptyResult: MigrationResult = {
    success: false,
    verified: false,
    source: 'local',
    localCounts,
    migratedCounts: { tasks: 0, memories: 0, knowledge: 0, workspaces: 0, sessions: 0, messages: 0 },
    verifiedCounts: { tasks: 0, memories: 0, knowledge: 0, workspaces: 0, sessions: 0, messages: 0 },
    timestamp,
  }

  if (!isSupabaseConfigured()) {
    return {
      ...emptyResult,
      error: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) in your environment.',
    }
  }

  const client = getSupabaseClient()
  if (!client) {
    return {
      ...emptyResult,
      error: 'Supabase client could not be initialized.',
    }
  }

  // Step 0: Create emergency pre-migration snapshot in local storage
  try {
    createStorageSnapshot()
    const allSnapshotData = {
      product: 'NOVA',
      migrationTimestamp: timestamp,
      localCounts,
      tasks: readStoredValue('nova:tasks:v1', []),
      memories: readStoredValue('nova:memories:v1', []),
      knowledge: readStoredValue('nova:knowledge:v1', []),
      workspaces: readStoredValue('nova:workspaces:v1', []),
      sessions: readStoredValue('nova:sessions:v1', []),
      preferences: readStoredValue('nova:preferences:v1', null),
    }
    localStorage.setItem(`nova:snapshot:pre-migration-${Date.now()}`, JSON.stringify(allSnapshotData))
  } catch (backupError) {
    console.warn('[NOVA Migration] Could not create emergency pre-migration snapshot:', backupError)
  }

  // Step 1: Pre-flight verify live connection and schema tables in Supabase
  const connectionStatus = await checkSupabaseConnection()
  if (connectionStatus.connectionState === 'unreachable') {
    return {
      ...emptyResult,
      error: `Supabase project unreachable: ${connectionStatus.statusMessage || connectionStatus.error || 'Check network connection'}`,
    }
  }
  if (connectionStatus.connectionState === 'auth_error') {
    return {
      ...emptyResult,
      error: 'Authentication failed: Invalid Supabase API key (401 Unauthorized). Verify your API key in .env.',
    }
  }
  if (connectionStatus.connectionState === 'tables_missing') {
    const missingList = (connectionStatus.missingTables || []).join(', ')
    return {
      ...emptyResult,
      error: `Database tables are missing in Supabase (${missingList}). Please run supabase/migrations/20261024000000_nova_schema.sql in your Supabase SQL Editor before migrating.`,
    }
  }

  // Step 2: Verify active user session
  const authInfo = await getCurrentAuthInfo()
  if (!authInfo.isAuthenticated || !authInfo.userId) {
    if (authInfo.anonymousDisabled) {
      return {
        ...emptyResult,
        error:
          'Migration incomplete: Anonymous sign-ins are disabled on your Supabase project. Enable "Anonymous Sign-ins" under Authentication -> Providers -> Anonymous in your Supabase Dashboard, or sign in with an email account in Settings.',
      }
    }
    return {
      ...emptyResult,
      error: `Migration incomplete: Authentication required (${authInfo.error || 'Please sign in or enable anonymous sign-ins in Supabase'}).`,
    }
  }

  const userId = authInfo.userId

  // Step 3: Read current local records
  const tasks = readStoredValue<TaskItem[]>('nova:tasks:v1', [])
  const memories = readStoredValue<MemoryItem[]>('nova:memories:v1', [])
  const knowledge = readStoredValue<KnowledgeItem[]>('nova:knowledge:v1', [])
  const workspaces = readStoredValue<WorkspaceItem[]>('nova:workspaces:v1', [])
  const sessions = readStoredValue<ChatSession[]>('nova:sessions:v1', [])
  const validWorkspaces = new Set(workspaces.map((w) => w.id))

  const migrated: RecordCounts = {
    workspaces: 0,
    tasks: 0,
    knowledge: 0,
    memories: 0,
    sessions: 0,
    messages: 0,
  }

  try {
    // A. Workspaces must be upserted first due to foreign key relationships
    if (workspaces.length > 0) {
      const payload = workspaces.map((w) => mapWorkspaceToDb(w, userId))
      const { error } = await client.from('workspaces').upsert(payload, { onConflict: 'id' })
      if (error) throw new Error(`Workspaces upsert failed: ${error.message}`)
      migrated.workspaces = workspaces.length
    }

    // B. Tasks upsert (sanitizing dangling workspace foreign keys)
    if (tasks.length > 0) {
      const payload = tasks.map((t) => {
        const row = mapTaskToDb(t, userId)
        if (row.workspace_id && !validWorkspaces.has(row.workspace_id)) {
          row.workspace_id = null
        }
        return row
      })
      const { error } = await client.from('tasks').upsert(payload, { onConflict: 'id' })
      if (error) throw new Error(`Tasks upsert failed: ${error.message}`)
      migrated.tasks = tasks.length
    }

    // C. Knowledge upsert (sanitizing dangling workspace foreign keys)
    if (knowledge.length > 0) {
      const payload = knowledge.map((k) => {
        const row = mapKnowledgeToDb(k, userId)
        if (row.workspace_id && !validWorkspaces.has(row.workspace_id)) {
          row.workspace_id = null
        }
        return row
      })
      const { error } = await client.from('knowledge').upsert(payload, { onConflict: 'id' })
      if (error) throw new Error(`Knowledge upsert failed: ${error.message}`)
      migrated.knowledge = knowledge.length
    }

    // D. Memories upsert (sanitizing dangling workspace foreign keys)
    if (memories.length > 0) {
      const payload = memories.map((m) => {
        const row = mapMemoryToDb(m, userId)
        if (row.workspace_id && !validWorkspaces.has(row.workspace_id)) {
          row.workspace_id = null
        }
        return row
      })
      const { error } = await client.from('memories').upsert(payload, { onConflict: 'id' })
      if (error) throw new Error(`Memories upsert failed: ${error.message}`)
      migrated.memories = memories.length
    }

    // E. Chat sessions and messages upsert
    if (sessions.length > 0) {
      for (const session of sessions) {
        const wsId = session.workspaceId && validWorkspaces.has(session.workspaceId) ? session.workspaceId : null
        const sessionPayload = {
          id: session.id,
          user_id: userId,
          workspace_id: wsId,
          title: session.title,
          updated_at: session.updatedAt,
          created_at: new Date().toISOString(),
        }
        const { error: sessionError } = await client
          .from('chat_sessions')
          .upsert(sessionPayload, { onConflict: 'id' })

        if (sessionError) throw new Error(`Session ${session.id} upsert failed: ${sessionError.message}`)
        migrated.sessions += 1

        if (session.messages && session.messages.length > 0) {
          const messagesPayload = session.messages.map((m, idx) => mapChatMessageToDb(m, session.id, userId, idx))
          const { error: msgError } = await client
            .from('chat_messages')
            .upsert(messagesPayload, { onConflict: 'id' })

          if (msgError) throw new Error(`Messages for session ${session.id} upsert failed: ${msgError.message}`)
          migrated.messages += session.messages.length
        }
      }
    }

    // F. User Preferences upsert
    const localPrefs = readStoredValue<Record<string, unknown> | null>('nova:preferences:v1', null)
    if (localPrefs && typeof localPrefs === 'object') {
      try {
        const activeWs = readStoredValue<string | null>('nova:active-workspace:v1', null)
        const activeWsId = activeWs && validWorkspaces.has(activeWs) ? activeWs : null
        await client.from('user_preferences').upsert(
          {
            user_id: userId,
            accent: localPrefs.accent || 'violet',
            reduced_motion: Boolean(localPrefs.reducedMotion),
            theme: localPrefs.theme || 'dark',
            user_name: localPrefs.userName || undefined,
            active_workspace_id: activeWsId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
      } catch {
        // Preferences upsert is best-effort
      }
    }

    // Step 4: Verification queries to verify records are safely stored in PostgreSQL
    const [tasksRes, knowledgeRes, memoriesRes, workspacesRes, sessionsRes] = await Promise.all([
      client.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      client.from('knowledge').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      client.from('memories').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      client.from('workspaces').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      client.from('chat_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ])

    const verifiedCounts: RecordCounts = {
      tasks: tasksRes.count ?? migrated.tasks,
      knowledge: knowledgeRes.count ?? migrated.knowledge,
      memories: memoriesRes.count ?? migrated.memories,
      workspaces: workspacesRes.count ?? migrated.workspaces,
      sessions: sessionsRes.count ?? migrated.sessions,
      messages: migrated.messages,
    }

    // Step 5: Record migration completion marker
    try {
      localStorage.setItem(
        'nova:supabase-migrated:v1',
        JSON.stringify({
          migratedAt: timestamp,
          userId,
          migratedCounts: migrated,
          verifiedCounts,
        })
      )
    } catch {
      /* Quota */
    }

    const countsVerified =
      verifiedCounts.tasks >= migrated.tasks &&
      verifiedCounts.knowledge >= migrated.knowledge &&
      verifiedCounts.memories >= migrated.memories &&
      verifiedCounts.workspaces >= migrated.workspaces &&
      verifiedCounts.sessions >= migrated.sessions

    return {
      success: countsVerified,
      verified: countsVerified,
      source: 'supabase',
      localCounts,
      migratedCounts: migrated,
      verifiedCounts,
      timestamp,
    }
  } catch (err) {
    return {
      success: false,
      verified: false,
      source: 'supabase',
      localCounts,
      migratedCounts: migrated,
      verifiedCounts: { tasks: 0, memories: 0, knowledge: 0, workspaces: 0, sessions: 0, messages: 0 },
      error: err instanceof Error ? err.message : String(err),
      timestamp,
    }
  }
}
