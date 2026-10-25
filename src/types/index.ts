export type NavigationTab = 'home' | 'chat' | 'dashboard' | 'history' | 'my-day' | 'tasks' | 'memory' | 'knowledge' | 'workspaces' | 'settings'

export interface AttachmentItem {
  id: string
  name: string
  size: string
  url?: string
  type?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'system' | 'assistant'
  content: string
  timestamp: string
  attachment?: AttachmentItem
}

export interface ChatSession {
  id: string
  title: string
  updatedAt: string
  messages: ChatMessage[]
  /** Optional so existing browser-saved sessions remain compatible. */
  workspaceId?: string
  isPinned?: boolean
  isArchived?: boolean
}

export interface TaskItem {
  id: string
  title: string
  completed: boolean
  scheduledAt?: string
  estimateMinutes: number
  priority: 'low' | 'medium' | 'high'
  createdAt: string
  completedAt?: string
  /** Tasks without a workspace remain in the personal task list. */
  workspaceId?: string
}

export interface MemoryItem {
  id: string
  category: string
  content: string
  dateAdded: string
  /** A short detail can be personal or scoped to one workspace. */
  workspaceId?: string
}

export interface KnowledgeItem {
  id: string
  title: string
  kind: 'Project notes' | 'Reference' | 'Personal note'
  content: string
  tags: string[]
  createdAt: string
  updatedAt?: string
  /** Detailed notes can be personal or scoped to one workspace. */
  workspaceId?: string
}

export interface WorkspaceItem {
  id: string
  name: string
  description: string
  kind: 'Personal' | 'Project' | 'Research'
  createdAt: string
}

export interface TaskDraft {
  title: string
  priority: TaskItem['priority']
  scheduledAt?: string
  estimateMinutes: number
  /** undefined follows the current workspace; null explicitly saves to Personal. */
  workspaceId?: string | null
}

export type AccentTone = 'violet' | 'indigo' | 'plum'

export type ThemeMode = 'dark' | 'light' | 'system'

export interface AppPreferences {
  accent: AccentTone
  reducedMotion: boolean
  theme?: ThemeMode
  defaultTaskPriority?: 'low' | 'medium' | 'high'
  startOfWeek?: 'monday' | 'sunday'
  defaultVoiceMode?: 'stt' | 'sts'
  preferredVoice?: string
  responseStyle?: 'concise' | 'detailed'
  userName?: string
}

export interface FocusTimerState {
  startedAt: number | null
  startedDate: string | null
  elapsedSeconds: number
  totalsByDate: Record<string, number>
}
