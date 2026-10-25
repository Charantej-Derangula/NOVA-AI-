import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { LayoutDashboard, Sun, MessageCircle, CheckSquare, Settings, Home } from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { HomeView } from './components/HomeView'
import { ChatView } from './components/ChatView'
import { MessageComposer } from './components/MessageComposer'
import { VoiceExperience } from './components/VoiceExperience'
import { MyDayView } from './components/MyDayView'
import { TasksView } from './components/TasksView'
import { MemoryView } from './components/MemoryView'
import { HistoryView } from './components/HistoryView'
import { SettingsView } from './components/SettingsView'
import { DashboardView } from './components/DashboardView'
import { KnowledgeView } from './components/KnowledgeView'
import { WorkspacesView } from './components/WorkspacesView'
import { ToolStudioModal } from './components/ToolStudioModal'
import { LoginPage } from './components/LoginPage'
import { NotFoundView } from './components/NotFoundView'
import { useAppRouter, getPathForTab, VALID_NAV_TABS } from './router'
import { useLocalStorageState, restoreStorageBackup, readStoredValue } from './hooks/useLocalStorageState'
import { streamChatMessage } from './services/chatService'
import { executeActionIntent, executeToolCall } from './services/actionEngine'
import { retainMemory } from './services/hindsightClient'
import {
  isSupabaseConfigured,
  getSupabaseConfigStatus,
  checkSupabaseConnection,
  getCurrentAuthInfo,
  signInAnonymously,
  onAuthStateChange,
  signOutUser,
  fetchTasks,
  fetchKnowledge,
  fetchMemories,
  fetchWorkspaces,
  persistTask,
  removeTask,
  removeAllTasks,
  persistKnowledge,
  removeKnowledge,
  persistMemory,
  removeMemory,
  persistWorkspace,
  removeWorkspace,
  persistChatSession,
  deleteChatSession,
  fetchChatSessions,
  fetchChatSession,
  migrateLocalStorageToSupabase,
} from './services/dataService'
import type {
  NavigationTab,
  ChatSession,
  ChatMessage,
  TaskItem,
  MemoryItem,
  AttachmentItem,
  TaskDraft,
  KnowledgeItem,
  WorkspaceItem,
  AppPreferences,
  FocusTimerState,
} from './types'

export default function App() {
  const [persistedTab, setPersistedTab] = useLocalStorageState<NavigationTab>('nova:active-tab:v1', 'home')
  const { route, navigate } = useAppRouter()
  const activeTab: NavigationTab = (route.tab in VALID_NAV_TABS
    ? route.tab as NavigationTab
    : (route.tab === 'voice' ? 'chat' : 'home'))

  useEffect(() => {
    if (activeTab && activeTab !== persistedTab) {
      setPersistedTab(activeTab)
    }
  }, [activeTab, persistedTab, setPersistedTab])

  const voiceOriginRef = useRef<{
    sessionId: string
    url: string
    isNewChat: boolean
  }>({
    sessionId: 'session-first',
    url: '/home',
    isNewChat: false,
  })
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return window.matchMedia('(min-width: 701px)').matches && localStorage.getItem('nova-sidebar-collapsed') === 'true'
    } catch {
      return false
    }
  })
  const [composerPrompt, setComposerPrompt] = useState('')
  const [activeTool, setActiveTool] = useState<'image' | 'presentation' | 'developer' | null>(null)
  const [activeVoiceMode, setActiveVoiceMode] = useState<'stt' | 'sts' | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [assistantActivityStatus, setAssistantActivityStatus] = useState<string | null>(null)
  const [hasApiKey, setHasApiKey] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const toggleSidebar = () => {
    setIsSidebarCollapsed((previous) => {
      const next = !previous
      try {
        localStorage.setItem('nova-sidebar-collapsed', String(next))
      } catch {
        // The sidebar remains usable when browser storage is unavailable.
      }
      return next
    })
  }

  const [sessions, setSessions, sessionsSaveStatus] = useLocalStorageState<ChatSession[]>('nova:sessions:v1', () => [{
    id: 'session-first',
    title: 'New Conversation',
    updatedAt: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date()),
    messages: [],
  }])
  const [currentSessionId, setCurrentSessionId, currentSessionSaveStatus] = useLocalStorageState('nova:current-session:v1', 'session-first')
  const [tasks, setTasks, tasksSaveStatus] = useLocalStorageState<TaskItem[]>('nova:tasks:v1', [])
  const [memories, setMemories, memoriesSaveStatus] = useLocalStorageState<MemoryItem[]>('nova:memories:v1', [])
  const [knowledge, setKnowledge, knowledgeSaveStatus] = useLocalStorageState<KnowledgeItem[]>('nova:knowledge:v1', [])
  const [workspaces, setWorkspaces, workspacesSaveStatus] = useLocalStorageState<WorkspaceItem[]>('nova:workspaces:v1', [])
  const [activeWorkspaceId, setActiveWorkspaceId, activeWorkspaceSaveStatus] = useLocalStorageState<string | null>('nova:active-workspace:v1', null)
  const [preferences, setPreferences, preferencesSaveStatus] = useLocalStorageState<AppPreferences>('nova:preferences:v1', { accent: 'violet', reducedMotion: false, theme: 'dark' })
  const [focusTimer, setFocusTimer, focusTimerSaveStatus] = useLocalStorageState<FocusTimerState>('nova:focus-timer:v1', { startedAt: null, startedDate: null, elapsedSeconds: 0, totalsByDate: {} })
  const localSaveAvailable = [sessionsSaveStatus, currentSessionSaveStatus, tasksSaveStatus, memoriesSaveStatus, knowledgeSaveStatus, workspacesSaveStatus, activeWorkspaceSaveStatus, preferencesSaveStatus, focusTimerSaveStatus].every((status) => status === 'saved')
  const [supabaseStatus, setSupabaseStatus] = useState(() => getSupabaseConfigStatus())
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string; displayName?: string } | null>(null)
  const [isGuestMode, setIsGuestMode] = useLocalStorageState<boolean>('nova:guest-mode:v1', false)
  const [isAuthChecking, setIsAuthChecking] = useState(true)
  const [tasksSyncStatus, setTasksSyncStatus] = useState<'cloud' | 'offline' | 'local' | 'syncing'>('local')
  const [tasksSyncError, setTasksSyncError] = useState<string | null>(null)

  // Verify live Supabase connection status & active user session on initial load
  useEffect(() => {
    let isMounted = true

    async function verifyConnectionAndAuth() {
      if (!isSupabaseConfigured()) {
        if (isMounted) setIsAuthChecking(false)
        return
      }

      try {
        const [liveStatus, authInfo] = await Promise.all([
          checkSupabaseConnection(),
          getCurrentAuthInfo(),
        ])

        if (!isMounted) return
        setSupabaseStatus(liveStatus)

        if (authInfo.isAuthenticated && authInfo.userId) {
          setCurrentUser({
            id: authInfo.userId,
            email: authInfo.userEmail,
            displayName: authInfo.displayName || (authInfo.isAnonymous ? 'Guest User' : undefined),
          })
        } else if (isGuestMode) {
          try {
            const anonRes = await signInAnonymously()
            if (anonRes.success && anonRes.user && isMounted) {
              const u = anonRes.user as { id: string }
              setCurrentUser({ id: u.id, displayName: 'Guest User' })
            }
          } catch (err) {
            console.warn('[NOVA Auth] Failed to restore anonymous session:', err)
          }
        }
      } catch (err) {
        console.warn('[NOVA Auth] Auth verification error:', err)
      } finally {
        if (isMounted) {
          setIsAuthChecking(false)
        }
      }
    }

    verifyConnectionAndAuth()

    const { unsubscribe } = onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null)
        setIsGuestMode(false)
        return
      }

      if (session && typeof session === 'object' && 'user' in session) {
        const u = (session as {
          user: {
            id: string
            email?: string
            is_anonymous?: boolean
            user_metadata?: Record<string, unknown>
          }
        }).user
        if (u) {
          const meta = u.user_metadata || {}
          const displayName =
            (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
            (typeof meta.name === 'string' && meta.name.trim()) ||
            (typeof meta.display_name === 'string' && meta.display_name.trim()) ||
            (u.email ? u.email.split('@')[0] : (u.is_anonymous ? 'Guest User' : undefined))

          setCurrentUser({
            id: u.id,
            email: u.email,
            displayName,
          })
          if (!u.is_anonymous) {
            setIsGuestMode(false)
          }
        }
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [isGuestMode, setIsGuestMode])

  // Load initial data from Supabase if configured, merging with existing local records safely without overwriting
  useEffect(() => {
    if (!supabaseStatus.configured) {
      return
    }
    if (isAuthChecking) return
    if (!currentUser) {
      return
    }
    let isMounted = true

    async function loadCloudData() {
      setTasksSyncStatus('syncing')
      try {
        const userId = currentUser?.id
        const [cloudTasksRes, cloudKnowledgeRes, cloudMemoriesRes, cloudWorkspacesRes, cloudSessionsRes] = await Promise.all([
          fetchTasks(userId).catch((err) => ({ data: [] as TaskItem[], source: 'local' as const, error: String(err) })),
          fetchKnowledge(userId).catch(() => null),
          fetchMemories(userId).catch(() => null),
          fetchWorkspaces(userId).catch(() => null),
          fetchChatSessions().catch(() => null),
        ])

        if (!isMounted) return

        if (cloudTasksRes && cloudTasksRes.source === 'supabase') {
          let currentTasks = cloudTasksRes.data || []
          // Check for local unsynced tasks (such as AutoPulse presentation task) that exist locally but not yet in Supabase
          const localTasks = readStoredValue<TaskItem[]>('nova:tasks:v1', [])
          const remoteIds = new Set(currentTasks.map((t) => t.id))
          const unsynced = localTasks.filter((t) => !remoteIds.has(t.id))

          if (unsynced.length > 0 && userId) {
            for (const t of unsynced) {
              await persistTask(t, userId).catch((err) => {
                console.warn('[NOVA Sync] Failed to persist unsynced task to Supabase:', t.id, err)
              })
            }
            const refreshed = await fetchTasks(userId).catch(() => null)
            if (refreshed && refreshed.source === 'supabase') {
              currentTasks = refreshed.data
            }
          }

          setTasks(currentTasks)
          setTasksSyncStatus('cloud')
          setTasksSyncError(null)
        } else {
          if (supabaseStatus.configured && currentUser) {
            setTasksSyncStatus('offline')
            setTasksSyncError(cloudTasksRes?.error || 'Offline: using local tasks cache')
          } else {
            setTasksSyncStatus('local')
          }
        }

        const cloudKnowledge = cloudKnowledgeRes?.data
        if (cloudKnowledge && cloudKnowledge.length > 0) {
          setKnowledge((prev) => {
            const map = new Map(prev.map((k) => [k.id, k]))
            for (const ck of cloudKnowledge) {
              map.set(ck.id, ck)
            }
            return Array.from(map.values())
          })
        }

        const cloudMemories = cloudMemoriesRes?.data
        if (cloudMemories && cloudMemories.length > 0) {
          setMemories((prev) => {
            const map = new Map(prev.map((m) => [m.id, m]))
            for (const cm of cloudMemories) {
              map.set(cm.id, cm)
            }
            return Array.from(map.values())
          })
        }

        const cloudWorkspaces = cloudWorkspacesRes?.data
        if (cloudWorkspaces && cloudWorkspaces.length > 0) {
          setWorkspaces((prev) => {
            const map = new Map(prev.map((w) => [w.id, w]))
            for (const cw of cloudWorkspaces) {
              map.set(cw.id, cw)
            }
            return Array.from(map.values())
          })
        }

        const cloudSessions = cloudSessionsRes?.data
        if (cloudSessions && cloudSessions.length > 0) {
          setSessions((prev) => {
            const map = new Map(prev.map((s) => [s.id, s]))
            for (const cs of cloudSessions) {
              const existing = map.get(cs.id)
              if (!existing) {
                map.set(cs.id, cs)
              } else {
                if ((cs.messages?.length || 0) > (existing.messages?.length || 0)) {
                  map.set(cs.id, cs)
                }
              }
            }
            return Array.from(map.values())
          })
        }
      } catch {
        // Fallback gracefully to local data if cloud fetch fails
      }
    }

    loadCloudData()

    return () => {
      isMounted = false
    }
  }, [supabaseStatus.configured, isAuthChecking, currentUser, setKnowledge, setMemories, setTasks, setWorkspaces, setSessions])

  // Session loading state & identity ref for cancellation of stale async responses
  const [sessionLoadingState, setSessionLoadingState] = useState<{
    isLoading: boolean
    sessionId: string | null
    error: string | null
  }>({
    isLoading: false,
    sessionId: null,
    error: null,
  })
  const activeLoadingSessionIdRef = useRef<string | null>(null)

  // Treat the conversation ID in the current URL as authoritative when on the chat tab
  const activeChatId = (route.tab === 'chat' && route.conversationId)
    ? route.conversationId
    : currentSessionId

  // Non-destructive conversation resolution: checks memory then local storage directly
  const currentSession = useMemo(() => {
    // 1. Check in-memory sessions
    const fromMemory = sessions.find((s) => s.id === activeChatId)
    if (fromMemory && fromMemory.messages && fromMemory.messages.length > 0) {
      return fromMemory
    }

    // 2. Check stored sessions in localStorage directly to prevent any hydration lag or race
    const stored = readStoredValue<ChatSession[]>('nova:sessions:v1', [])
    const fromStored = stored.find((s) => s.id === activeChatId)
    if (fromStored && fromStored.messages && fromStored.messages.length > 0) {
      return fromStored
    }

    if (fromMemory) return fromMemory
    if (fromStored) return fromStored

    // 3. Fallback for new chat route
    if (route.tab === 'chat' && route.conversationId) {
      return {
        id: route.conversationId,
        title: 'New Conversation',
        updatedAt: new Date().toISOString(),
        messages: [],
        workspaceId: activeWorkspaceId ?? undefined,
      }
    }

    return sessions[0] || {
      id: 'session-first', title: 'New Conversation', updatedAt: 'Today', messages: [],
    }
  }, [sessions, activeChatId, route.tab, route.conversationId, activeWorkspaceId])

  const activeWorkspaceName = workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.name
  const isChatLanding = activeTab === 'home'

  // Synchronize route conversationId with currentSessionId on route changes without wiping data
  useEffect(() => {
    if (route.tab === 'chat' && route.conversationId) {
      const targetId = route.conversationId
      if (currentSessionId !== targetId) {
        setCurrentSessionId(targetId)
      }

      setSessions((prev) => {
        // If already present in memory, keep as is - NEVER overwrite
        if (prev.some((s) => s.id === targetId)) {
          return prev
        }

        // Check if it exists in local storage
        const stored = readStoredValue<ChatSession[]>('nova:sessions:v1', [])
        const inStorage = stored.find((s) => s.id === targetId)
        if (inStorage) {
          return [inStorage, ...prev]
        }

        // If Supabase is configured and not in storage, trigger async load
        if (isSupabaseConfigured()) {
          activeLoadingSessionIdRef.current = targetId
          setSessionLoadingState({ isLoading: true, sessionId: targetId, error: null })

          fetchChatSession(targetId)
            .then((res) => {
              // Ensure this is still the active requested session (prevent stale async response)
              if (activeLoadingSessionIdRef.current !== targetId) return
              if (res.data) {
                setSessions((current) => {
                  if (current.some((s) => s.id === targetId)) {
                    return current.map((s) => s.id === targetId ? res.data! : s)
                  }
                  return [res.data!, ...current]
                })
                setSessionLoadingState({ isLoading: false, sessionId: targetId, error: null })
              } else if (res.error) {
                setSessionLoadingState({ isLoading: false, sessionId: targetId, error: res.error })
              } else {
                setSessionLoadingState({ isLoading: false, sessionId: targetId, error: null })
              }
            })
            .catch((err) => {
              if (activeLoadingSessionIdRef.current !== targetId) return
              setSessionLoadingState({
                isLoading: false,
                sessionId: targetId,
                error: err instanceof Error ? err.message : String(err),
              })
            })
        }

        // If not in memory and not in storage, register as new draft session
        const draftSession: ChatSession = {
          id: targetId,
          title: 'New Conversation',
          updatedAt: new Date().toISOString(),
          messages: [],
          workspaceId: activeWorkspaceId ?? undefined,
        }
        return [draftSession, ...prev]
      })
    } else {
      if (activeLoadingSessionIdRef.current !== null) {
        activeLoadingSessionIdRef.current = null
        setTimeout(() => {
          setSessionLoadingState({ isLoading: false, sessionId: null, error: null })
        }, 0)
      }
    }
  }, [route.tab, route.conversationId, currentSessionId, activeWorkspaceId, setCurrentSessionId, setSessions])

  const handleRetryLoadSession = useCallback(() => {
    if (!route.conversationId) return
    const targetId = route.conversationId
    activeLoadingSessionIdRef.current = targetId
    setSessionLoadingState({ isLoading: true, sessionId: targetId, error: null })
    fetchChatSession(targetId)
      .then((res) => {
        if (activeLoadingSessionIdRef.current !== targetId) return
        if (res.data) {
          setSessions((current) => {
            if (current.some((s) => s.id === targetId)) {
              return current.map((s) => s.id === targetId ? res.data! : s)
            }
            return [res.data!, ...current]
          })
          setSessionLoadingState({ isLoading: false, sessionId: targetId, error: null })
        } else if (res.error) {
          setSessionLoadingState({ isLoading: false, sessionId: targetId, error: res.error })
        } else {
          setSessionLoadingState({ isLoading: false, sessionId: targetId, error: null })
        }
      })
      .catch((err) => {
        if (activeLoadingSessionIdRef.current !== targetId) return
        setSessionLoadingState({
          isLoading: false,
          sessionId: targetId,
          error: err instanceof Error ? err.message : String(err),
        })
      })
  }, [route.conversationId, setSessions])

  // Synchronize voice mode if URL is /voice
  if (route.tab === 'voice' && activeVoiceMode === null) {
    setActiveVoiceMode(route.voiceMode || 'sts')
  }

  // Navigation handlers
  const handleSelectTab = useCallback((tab: NavigationTab) => {
    if (tab === 'chat') {
      const activeId = (route.tab === 'chat' && route.conversationId)
        ? route.conversationId
        : currentSessionId
      const dest = activeId ? `/chat/${encodeURIComponent(activeId)}` : '/chat'
      navigate(dest)
    } else {
      navigate(getPathForTab(tab))
    }
    setIsSidebarOpen(false)
  }, [currentSessionId, navigate, route.conversationId, route.tab])

  const handleSelectSession = useCallback((id: string) => {
    setCurrentSessionId(id)
    const targetSession = sessions.find((session) => session.id === id)
      ?? readStoredValue<ChatSession[]>('nova:sessions:v1', []).find((s) => s.id === id)
    setActiveWorkspaceId(targetSession?.workspaceId ?? null)
    navigate(`/chat/${encodeURIComponent(id)}`)
    setIsSidebarOpen(false)
  }, [navigate, sessions, setActiveWorkspaceId, setCurrentSessionId])

  // Create a new chat session
  const handleNewChat = useCallback((workspaceId: string | null = activeWorkspaceId) => {
    const newId = `session-${crypto.randomUUID()}`
    const newSession: ChatSession = {
      id: newId,
      title: 'New Conversation',
      updatedAt: new Date().toISOString(),
      messages: [],
      workspaceId: workspaceId ?? undefined,
    }

    setSessions((prev) => [newSession, ...prev])
    setCurrentSessionId(newId)
    setActiveWorkspaceId(workspaceId)
    setComposerPrompt('')
    setIsSidebarOpen(false)
    navigate(`/chat/${encodeURIComponent(newId)}`)
  }, [activeWorkspaceId, navigate, setActiveWorkspaceId, setCurrentSessionId, setSessions])

  const handleOpenChatWithPrompt = useCallback((prompt: string) => {
    if (currentSession.workspaceId !== activeWorkspaceId) {
      handleNewChat(activeWorkspaceId)
    } else {
      navigate(`/chat/${encodeURIComponent(currentSession.id)}`)
    }
    setComposerPrompt(prompt)
  }, [activeWorkspaceId, currentSession.id, currentSession.workspaceId, handleNewChat, navigate])

  // Voice lifecycle management
  const handleOpenVoice = useCallback((mode: 'stt' | 'sts', explicitOriginUrl?: string) => {
    let originUrl = explicitOriginUrl
    if (!originUrl) {
      if (route.tab === 'chat' && currentSessionId) {
        originUrl = `/chat/${encodeURIComponent(currentSessionId)}`
      } else {
        originUrl = route.pathname || '/home'
      }
    }

    let activeId = currentSessionId
    let targetSession = sessions.find((s) => s.id === activeId)

    if (!targetSession) {
      activeId = `session-${crypto.randomUUID()}`
      targetSession = {
        id: activeId,
        title: 'New Conversation',
        updatedAt: new Date().toISOString(),
        messages: [],
        workspaceId: activeWorkspaceId ?? undefined,
      }
      setSessions((prev) => [targetSession!, ...prev])
      setCurrentSessionId(activeId)
    }

    const isDraft = targetSession.messages.length === 0

    voiceOriginRef.current = {
      sessionId: activeId,
      url: originUrl,
      isNewChat: isDraft,
    }

    setActiveVoiceMode(mode)
    const voiceUrl = `/voice?from=${encodeURIComponent(originUrl)}&sessionId=${encodeURIComponent(activeId)}&mode=${mode}`
    navigate(voiceUrl)
  }, [activeWorkspaceId, currentSessionId, navigate, route.pathname, route.tab, sessions, setCurrentSessionId, setSessions])

  const handleCloseVoice = useCallback(() => {
    setActiveVoiceMode(null)

    const searchParams = new URLSearchParams(route.search || window.location.search)
    const paramFrom = searchParams.get('from')
    const paramSessionId = searchParams.get('sessionId')

    const originUrl = voiceOriginRef.current.url || paramFrom || '/chat'
    const originSessionId = voiceOriginRef.current.sessionId || paramSessionId || currentSessionId

    if (originSessionId) {
      setCurrentSessionId(originSessionId)
      setSessions((prev) => {
        if (!prev.some((s) => s.id === originSessionId)) {
          const restoredDraft: ChatSession = {
            id: originSessionId,
            title: 'New Conversation',
            updatedAt: new Date().toISOString(),
            messages: [],
            workspaceId: activeWorkspaceId ?? undefined,
          }
          return [restoredDraft, ...prev]
        }
        return prev
      })
    }

    navigate(originUrl)
  }, [activeWorkspaceId, currentSessionId, navigate, route.search, setCurrentSessionId, setSessions])

  // Keyboard shortcut listener (⌘K / Ctrl+K and Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        handleNewChat()
      } else if (e.key === 'Escape') {
        setIsSidebarOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNewChat])

  // Check backend health & Groq API key status on mount
  useEffect(() => {
    let isMounted = true
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) {
          const hasKey = typeof data.hasGroqKey === 'boolean' ? data.hasGroqKey : Boolean(data.hasApiKey)
          setHasApiKey(hasKey)
        }
      })
      .catch(() => {
        // Backend offline or local storage mode
      })
    return () => {
      isMounted = false
    }
  }, [])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsGenerating(false)
    setAssistantActivityStatus('Response cancelled')
  }, [])

  const handleRetryTasksSync = useCallback(async () => {
    setTasksSyncStatus('syncing')
    setTasksSyncError(null)
    try {
      const userId = currentUser?.id
      const res = await fetchTasks(userId)
      if (res.source === 'supabase') {
        let currentTasks = res.data || []
        const localTasks = readStoredValue<TaskItem[]>('nova:tasks:v1', [])
        const remoteIds = new Set(currentTasks.map((t) => t.id))
        const unsynced = localTasks.filter((t) => !remoteIds.has(t.id))
        if (unsynced.length > 0 && userId) {
          for (const t of unsynced) {
            await persistTask(t, userId).catch(() => {})
          }
          const refreshed = await fetchTasks(userId)
          if (refreshed.source === 'supabase') {
            currentTasks = refreshed.data
          }
        }
        setTasks(currentTasks)
        setTasksSyncStatus('cloud')
        setTasksSyncError(null)
      } else {
        setTasksSyncStatus('offline')
        setTasksSyncError(res.error || 'Failed to sync tasks with Supabase.')
      }
    } catch (err) {
      setTasksSyncStatus('offline')
      setTasksSyncError(err instanceof Error ? err.message : String(err))
    }
  }, [currentUser, setTasks])

  // Task actions
  const handleToggleTask = async (id: string) => {
    const target = tasks.find((task) => task.id === id) || readStoredValue<TaskItem[]>('nova:tasks:v1', []).find((t) => t.id === id)
    if (!target) {
      throw new Error(`Task with ID "${id}" was not found.`)
    }
    const updatedTask: TaskItem = {
      ...target,
      completed: !target.completed,
      completedAt: target.completed ? undefined : new Date().toISOString(),
    }
    if (isSupabaseConfigured() && currentUser?.id) {
      const res = await persistTask(updatedTask, currentUser.id)
      if (res.success) {
        setTasksSyncStatus('cloud')
        setTasksSyncError(null)
      } else {
        setTasksSyncStatus('offline')
        setTasksSyncError(res.error || 'Failed to update task in Supabase.')
        setTasks((prev) => prev.map((task) => (task.id === id ? updatedTask : task)))
        throw new Error(res.error || 'Failed to update task in Supabase.')
      }
    } else if (isSupabaseConfigured()) {
      setTasksSyncStatus('offline')
    } else {
      setTasksSyncStatus('local')
    }
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? updatedTask : task))
    )
  }

  const handleAddTask = async ({ title, priority, scheduledAt, estimateMinutes, workspaceId }: TaskDraft): Promise<TaskItem> => {
    const createdAt = new Date().toISOString()
    const newTask: TaskItem = {
      id: `task-${crypto.randomUUID()}`,
      title,
      completed: false,
      priority,
      scheduledAt,
      estimateMinutes,
      createdAt,
      workspaceId: workspaceId === undefined ? activeWorkspaceId ?? undefined : workspaceId ?? undefined,
    }
    if (isSupabaseConfigured() && currentUser?.id) {
      const res = await persistTask(newTask, currentUser.id)
      if (res.success) {
        setTasksSyncStatus('cloud')
        setTasksSyncError(null)
      } else {
        setTasksSyncStatus('offline')
        setTasksSyncError(res.error || 'Failed to persist task to Supabase.')
        // Preserve unsynced local data in localStorage and UI state
        setTasks((prev) => [newTask, ...prev.filter((t) => t.id !== newTask.id)])
        throw new Error(res.error || 'Failed to persist task to Supabase.')
      }
    } else if (isSupabaseConfigured() && !isGuestMode && !currentUser) {
      setTasksSyncStatus('offline')
      setTasksSyncError('Authentication required to persist task to Supabase.')
      // Preserve local data
      setTasks((prev) => [newTask, ...prev.filter((t) => t.id !== newTask.id)])
      throw new Error('Authentication required to persist task to Supabase.')
    } else {
      setTasksSyncStatus('local')
      setTasksSyncError(null)
    }
    setTasks((prev) => [newTask, ...prev.filter((t) => t.id !== newTask.id)])
    return newTask
  }

  const handleUpdateTask = async (id: string, updates: Partial<TaskItem>) => {
    const target = tasks.find((t) => t.id === id) || readStoredValue<TaskItem[]>('nova:tasks:v1', []).find((t) => t.id === id)
    if (!target) {
      throw new Error(`Task with ID "${id}" was not found.`)
    }
    const updatedTask: TaskItem = { ...target, ...updates }
    if (isSupabaseConfigured() && currentUser?.id) {
      const res = await persistTask(updatedTask, currentUser.id)
      if (res.success) {
        setTasksSyncStatus('cloud')
        setTasksSyncError(null)
      } else {
        setTasksSyncStatus('offline')
        setTasksSyncError(res.error || 'Failed to update task in Supabase.')
        setTasks((prev) => prev.map((task) => (task.id === id ? updatedTask : task)))
        throw new Error(res.error || 'Failed to update task in Supabase.')
      }
    } else if (isSupabaseConfigured() && !isGuestMode && !currentUser) {
      setTasksSyncStatus('offline')
    } else {
      setTasksSyncStatus('local')
    }
    setTasks((prev) => prev.map((task) => (task.id === id ? updatedTask : task)))
  }

  const handleDeleteTask = async (id: string) => {
    if (isSupabaseConfigured() && currentUser?.id) {
      const res = await removeTask(id, currentUser.id)
      if (res.success) {
        setTasksSyncStatus('cloud')
        setTasksSyncError(null)
      } else {
        setTasksSyncStatus('offline')
        setTasksSyncError(res.error || 'Failed to remove task from Supabase.')
        throw new Error(res.error || 'Failed to remove task from Supabase.')
      }
    } else if (isSupabaseConfigured() && !isGuestMode && !currentUser) {
      setTasksSyncStatus('offline')
    } else {
      setTasksSyncStatus('local')
    }
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const handleDeleteAllTasks = async () => {
    if (isSupabaseConfigured() && currentUser?.id) {
      const res = await removeAllTasks(currentUser.id)
      if (res.success) {
        setTasksSyncStatus('cloud')
        setTasksSyncError(null)
      } else {
        setTasksSyncStatus('offline')
        setTasksSyncError(res.error || 'Failed to clear all tasks from Supabase.')
        throw new Error(res.error || 'Failed to clear all tasks from Supabase.')
      }
    } else if (isSupabaseConfigured() && !isGuestMode && !currentUser) {
      setTasksSyncStatus('offline')
    } else {
      setTasksSyncStatus('local')
    }
    setTasks([])
  }

  // Memory actions
  const handleAddMemory = async (category: string, content: string, workspaceId?: string): Promise<MemoryItem> => {
    const nowFormatted = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date())

    const newMemory: MemoryItem = {
      id: `mem-${crypto.randomUUID()}`,
      category,
      content,
      dateAdded: nowFormatted,
      workspaceId,
    }
    if (isSupabaseConfigured() && currentUser?.id) {
      const res = await persistMemory(newMemory, currentUser.id)
      if (!res.success) {
        setMemories((prev) => [newMemory, ...prev.filter((m) => m.id !== newMemory.id)])
        throw new Error(res.error || 'Failed to persist memory to Supabase.')
      }
    } else if (isSupabaseConfigured() && !isGuestMode && !currentUser) {
      setMemories((prev) => [newMemory, ...prev.filter((m) => m.id !== newMemory.id)])
      throw new Error('Authentication required to persist memory to Supabase.')
    }
    setMemories((prev) => [newMemory, ...prev.filter((m) => m.id !== newMemory.id)])
    return newMemory
  }

  const handleDeleteMemory = async (id: string) => {
    if (isSupabaseConfigured() && currentUser?.id) {
      const res = await removeMemory(id, currentUser.id)
      if (!res.success) {
        throw new Error(res.error || 'Failed to remove memory from Supabase.')
      }
    } else if (isSupabaseConfigured() && !isGuestMode && !currentUser) {
      throw new Error('Authentication required to remove memory from Supabase.')
    }
    setMemories((prev) => prev.filter((m) => m.id !== id))
  }

  const handleUpdateMemory = async (id: string, updates: Partial<MemoryItem>) => {
    const target = memories.find((m) => m.id === id)
    if (!target) return
    const updatedMemory: MemoryItem = { ...target, ...updates }
    if (isSupabaseConfigured() && currentUser?.id) {
      const res = await persistMemory(updatedMemory, currentUser.id)
      if (!res.success) {
        setMemories((prev) => prev.map((memory) => (memory.id === id ? updatedMemory : memory)))
        throw new Error(res.error || 'Failed to update memory in Supabase.')
      }
    } else if (isSupabaseConfigured() && !isGuestMode && !currentUser) {
      setMemories((prev) => prev.map((memory) => (memory.id === id ? updatedMemory : memory)))
      throw new Error('Authentication required to update memory in Supabase.')
    }
    setMemories((prev) => prev.map((memory) => (memory.id === id ? updatedMemory : memory)))
  }

  // Knowledge actions
  const handleAddKnowledge = async (draft: Omit<KnowledgeItem, 'id' | 'createdAt'>): Promise<KnowledgeItem> => {
    const now = new Date().toISOString()
    const newNote: KnowledgeItem = {
      ...draft,
      id: `note-${crypto.randomUUID()}`,
      createdAt: now,
      updatedAt: now,
    }
    if (isSupabaseConfigured() && currentUser?.id) {
      const res = await persistKnowledge(newNote, currentUser.id)
      if (!res.success) {
        throw new Error(res.error || 'Failed to persist note to Supabase.')
      }
    } else if (isSupabaseConfigured() && !isGuestMode && !currentUser) {
      throw new Error('Authentication required to persist note to Supabase.')
    }
    setKnowledge((previous) => [newNote, ...previous.filter((n) => n.id !== newNote.id)])
    return newNote
  }

  const handleUpdateKnowledge = async (id: string, updates: Partial<KnowledgeItem>) => {
    const target = knowledge.find((k) => k.id === id)
    if (!target) return
    const updatedNote: KnowledgeItem = { ...target, ...updates, updatedAt: new Date().toISOString() }
    if (isSupabaseConfigured() && currentUser?.id) {
      const res = await persistKnowledge(updatedNote, currentUser.id)
      if (!res.success) {
        throw new Error(res.error || 'Failed to update note in Supabase.')
      }
    } else if (isSupabaseConfigured() && !isGuestMode && !currentUser) {
      throw new Error('Authentication required to update note in Supabase.')
    }
    setKnowledge((previous) => previous.map((note) => (note.id === id ? updatedNote : note)))
  }

  const handleDeleteKnowledge = async (id: string) => {
    if (isSupabaseConfigured() && currentUser?.id) {
      const res = await removeKnowledge(id, currentUser.id)
      if (!res.success) {
        throw new Error(res.error || 'Failed to remove note from Supabase.')
      }
    } else if (isSupabaseConfigured() && !isGuestMode && !currentUser) {
      throw new Error('Authentication required to remove note from Supabase.')
    }
    setKnowledge((previous) => previous.filter((note) => note.id !== id))
  }

  // Workspace actions
  const handleAddWorkspace = async (draft: Pick<WorkspaceItem, 'name' | 'description' | 'kind'>): Promise<string> => {
    const workspace: WorkspaceItem = { ...draft, id: `space-${crypto.randomUUID()}`, createdAt: new Date().toISOString() }
    if (isSupabaseConfigured() && currentUser?.id) {
      const res = await persistWorkspace(workspace, currentUser.id)
      if (!res.success) {
        setWorkspaces((previous) => [workspace, ...previous.filter((w) => w.id !== workspace.id)])
        setActiveWorkspaceId(workspace.id)
        throw new Error(res.error || 'Failed to persist workspace to Supabase.')
      }
    } else if (isSupabaseConfigured() && !isGuestMode && !currentUser) {
      setWorkspaces((previous) => [workspace, ...previous.filter((w) => w.id !== workspace.id)])
      setActiveWorkspaceId(workspace.id)
      throw new Error('Authentication required to persist workspace to Supabase.')
    }
    setWorkspaces((previous) => [workspace, ...previous.filter((w) => w.id !== workspace.id)])
    setActiveWorkspaceId(workspace.id)
    return workspace.id
  }

  const handleUpdateWorkspace = async (id: string, updates: Partial<WorkspaceItem>) => {
    const target = workspaces.find((w) => w.id === id)
    if (!target) return
    const updatedWorkspace: WorkspaceItem = { ...target, ...updates }
    if (isSupabaseConfigured() && currentUser?.id) {
      const res = await persistWorkspace(updatedWorkspace, currentUser.id)
      if (!res.success) {
        setWorkspaces((previous) => previous.map((workspace) => (workspace.id === id ? updatedWorkspace : workspace)))
        throw new Error(res.error || 'Failed to update workspace in Supabase.')
      }
    } else if (isSupabaseConfigured() && !isGuestMode && !currentUser) {
      setWorkspaces((previous) => previous.map((workspace) => (workspace.id === id ? updatedWorkspace : workspace)))
      throw new Error('Authentication required to update workspace in Supabase.')
    }
    setWorkspaces((previous) => previous.map((workspace) => (workspace.id === id ? updatedWorkspace : workspace)))
  }

  const handleDeleteWorkspace = async (id: string) => {
    if (isSupabaseConfigured() && currentUser?.id) {
      const res = await removeWorkspace(id, currentUser.id)
      if (!res.success) {
        throw new Error(res.error || 'Failed to remove workspace from Supabase.')
      }
    } else if (isSupabaseConfigured() && !isGuestMode && !currentUser) {
      throw new Error('Authentication required to remove workspace from Supabase.')
    }
    const remaining = workspaces.filter((workspace) => workspace.id !== id)
    setWorkspaces(remaining)
    // Keep the user's work intact: deleting a space moves its contents back to the personal lists.
    setTasks((previous) => previous.map((item) => (item.workspaceId === id ? { ...item, workspaceId: undefined } : item)))
    setMemories((previous) => previous.map((item) => (item.workspaceId === id ? { ...item, workspaceId: undefined } : item)))
    setKnowledge((previous) => previous.map((item) => (item.workspaceId === id ? { ...item, workspaceId: undefined } : item)))
    setSessions((previous) => previous.map((item) => (item.workspaceId === id ? { ...item, workspaceId: undefined } : item)))
    if (activeWorkspaceId === id) setActiveWorkspaceId(null)
  }

  // Backup restore
  const handleRestoreBackup = (backupJson: string) => {
    const res = restoreStorageBackup(backupJson)
    if (res.success) {
      try {
        const parsed = JSON.parse(backupJson) as Record<string, unknown>
        const restoredTasks = Array.isArray(parsed.tasks) ? parsed.tasks : Array.isArray(parsed['nova:tasks:v1']) ? parsed['nova:tasks:v1'] : null
        const restoredMemories = Array.isArray(parsed.memories) ? parsed.memories : Array.isArray(parsed['nova:memories:v1']) ? parsed['nova:memories:v1'] : null
        const restoredKnowledge = Array.isArray(parsed.knowledge) ? parsed.knowledge : Array.isArray(parsed['nova:knowledge:v1']) ? parsed['nova:knowledge:v1'] : null
        const restoredWorkspaces = Array.isArray(parsed.workspaces) ? parsed.workspaces : Array.isArray(parsed['nova:workspaces:v1']) ? parsed['nova:workspaces:v1'] : null
        const restoredSessions = Array.isArray(parsed.sessions) ? parsed.sessions : Array.isArray(parsed['nova:sessions:v1']) ? parsed['nova:sessions:v1'] : null

        if (restoredTasks) setTasks(restoredTasks as TaskItem[])
        if (restoredMemories) setMemories(restoredMemories as MemoryItem[])
        if (restoredKnowledge) setKnowledge(restoredKnowledge as KnowledgeItem[])
        if (restoredWorkspaces) setWorkspaces(restoredWorkspaces as WorkspaceItem[])
        if (restoredSessions) setSessions(restoredSessions as ChatSession[])
      } catch {
        // Fallback: items already written to localStorage by restoreStorageBackup
      }
    }
    return res
  }

  // Sending a message
  const handleSendMessage = async (content: string, attachment?: AttachmentItem) => {
    if (!content.trim() && !attachment) return

    const now = new Date()
    const timeStr = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })

    const targetSessionId = (route.tab === 'chat' && route.conversationId)
      ? route.conversationId
      : currentSessionId
    const targetSession = sessions.find((s) => s.id === targetSessionId)
      ?? readStoredValue<ChatSession[]>('nova:sessions:v1', []).find((s) => s.id === targetSessionId)
    const priorMessages = targetSession ? targetSession.messages : []

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: timeStr,
      attachment,
    }

    if (attachment) {
      setAssistantActivityStatus('Reviewing your files…')
    } else {
      setAssistantActivityStatus('Analyzing your request…')
    }

    const assistantMsgId = `msg-${Date.now() + 1}`

    // 1. Detect and execute real application operations (Tasks, Knowledge, Memory, Workspaces)
    const actionResult = await executeActionIntent({
      prompt: content,
      tasks,
      memories,
      knowledge,
      workspaces,
      activeWorkspaceId,
      attachment,
      currentUser,
      onAddTask: handleAddTask,
      onUpdateTask: handleUpdateTask,
      onDeleteTask: handleDeleteTask,
      onToggleTask: handleToggleTask,
      onDeleteAllTasks: handleDeleteAllTasks,
      onAddMemory: handleAddMemory,
      onUpdateMemory: handleUpdateMemory,
      onDeleteMemory: handleDeleteMemory,
      onAddKnowledge: handleAddKnowledge,
      onUpdateKnowledge: handleUpdateKnowledge,
      onDeleteKnowledge: handleDeleteKnowledge,
      onAddWorkspace: handleAddWorkspace,
      onUpdateWorkspace: handleUpdateWorkspace,
      onDeleteWorkspace: handleDeleteWorkspace,
      onSelectWorkspace: setActiveWorkspaceId,
    })

    // If an action was handled and does not require AI model continuation
    if (actionResult.handled && !actionResult.requiresAiFollowup) {
      const updatedMessages = [
        ...priorMessages,
        userMessage,
        {
          id: assistantMsgId,
          role: 'assistant' as const,
          content: actionResult.response,
          timestamp: timeStr,
        },
      ]
      const isInitialTitle = targetSession ? targetSession.title === 'New Conversation' : true
      const snippetTitle =
        content.length > 36 ? `${content.slice(0, 36)}...` : content

      const nowIso = new Date().toISOString()
      const updatedSession: ChatSession = {
        ...(targetSession || { id: targetSessionId, title: 'New Conversation', updatedAt: nowIso, messages: [] }),
        title: isInitialTitle ? snippetTitle || 'Chat Conversation' : (targetSession?.title || 'Chat Conversation'),
        updatedAt: nowIso,
        messages: updatedMessages,
      }

      setSessions((prev) =>
        prev.map((session) => (session.id === targetSessionId ? updatedSession : session))
      )

      if (isSupabaseConfigured()) {
        persistChatSession(updatedSession).catch(() => { })
      }

      setComposerPrompt('')
      navigate(`/chat/${encodeURIComponent(targetSessionId)}`)
      setIsGenerating(false)
      setAssistantActivityStatus(null)
      return
    }

    // Cancel any ongoing generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    const prefixContent = actionResult.handled && actionResult.requiresAiFollowup
      ? `${actionResult.response}\n\n`
      : ''

    const placeholderAssistant: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: prefixContent,
      timestamp: timeStr,
    }

    const nowIso = new Date().toISOString()
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id === targetSessionId) {
          const updatedMessages = [...session.messages, userMessage, placeholderAssistant]
          const isInitialTitle = session.title === 'New Conversation'
          const snippetTitle =
            content.length > 36 ? `${content.slice(0, 36)}...` : content

          return {
            ...session,
            title: isInitialTitle ? snippetTitle || 'Chat Conversation' : session.title,
            updatedAt: nowIso,
            messages: updatedMessages,
          }
        }
        return session
      })
    )

    setComposerPrompt('')
    navigate(`/chat/${encodeURIComponent(targetSessionId)}`)
    setIsGenerating(true)

    if (attachment) {
      setTimeout(() => {
        setAssistantActivityStatus((curr) => (curr ? 'Preparing a response…' : curr))
      }, 400)
    } else {
      setAssistantActivityStatus('Preparing a response…')
    }

    // Background conversational memory retention for personal facts or preferences stated in chat
    if (!actionResult.handled) {
      const trimmedPrompt = content.trim()
      const isQuestion =
        /\?$/.test(trimmedPrompt) ||
        /^(?:what|who|where|when|why|how|can\s+you|could\s+you|is|are|do|does|did|will|would)\b/i.test(trimmedPrompt)
      const hasPersonalFact =
        /\b(?:my\s+(?:favourite|favorite|preferred|preference|name|subject|hobby|job|role|title|city|stack)\s+is|i\s+(?:prefer|like|love|dislike|live\s+in|work\s+at|work\s+as|speak|use|study))\b/i.test(
          trimmedPrompt
        )
      if (!isQuestion && hasPersonalFact) {
        retainMemory(trimmedPrompt, 'User Preference', ['nova', 'assistant', 'preferences']).catch(() => {})
        handleAddMemory('Preferences', trimmedPrompt).catch(() => {})
      }
    }

    // Build conversation context including prior messages and the new user message
    const cleanUserPrompt = actionResult.cleanPromptForAi || content
    const userMsgForAi: ChatMessage = { ...userMessage, content: cleanUserPrompt }
    const messagesForAi = [...priorMessages, userMsgForAi]
    const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)
    let systemInstruction = activeWorkspace
      ? `You are NOVA, an intelligent personal AI executive assistant. The user is currently in the "${activeWorkspace.name}" workspace.`
      : 'You are NOVA, a calm, proactive, and intelligent personal AI executive assistant.'

    if (actionResult.retrievedContext?.formattedContextPrompt) {
      systemInstruction += `\n\n${actionResult.retrievedContext.formattedContextPrompt}\n\nIMPORTANT: Use the authorized user context and recalled memories above to answer user questions about their preferences, background, and previous statements. If a requested personal detail is not present in the authorized context or memory bank, honestly explain that you do not have that on record yet rather than inventing details.`
    } else {
      systemInstruction += '\n\nIMPORTANT: If the user asks about personal preferences, memories, or profile facts that are not provided in your system instructions or conversation history, honestly state that you do not have that on record yet.'
    }

    systemInstruction += '\n\nCRITICAL SYSTEM BOUNDARY: Real application operations (creating, updating, or deleting tasks, workspaces, notes, and memories) are executed exclusively by the authoritative system action engine. You CANNOT directly execute or commit database operations. You must NEVER claim, promise, or hallucinate that you have created, scheduled, saved, or updated a task, workspace, note, or memory item unless that action was already confirmed and provided in your context. If an action could not be executed or is missing required details, state honestly what is needed.'

    let accumulatedContent = prefixContent

    streamChatMessage({
      messages: messagesForAi,
      systemInstruction,
      signal: controller.signal,
      onChunk: (chunk) => {
        accumulatedContent += chunk
        setSessions((prev) =>
          prev.map((session) => {
            if (session.id === targetSessionId) {
              const updated = session.messages.map((m) =>
                m.id === assistantMsgId ? { ...m, content: accumulatedContent } : m
              )
              return { ...session, messages: updated }
            }
            return session
          })
        )
      },
      onComplete: () => {
        setIsGenerating(false)
        setAssistantActivityStatus(null)
        abortControllerRef.current = null
        if (isSupabaseConfigured()) {
          setSessions((currentSessions) => {
            const current = currentSessions.find((s) => s.id === targetSessionId)
            if (current) {
              persistChatSession(current).catch(() => { })
            }
            return currentSessions
          })
        }
      },
      onError: (errMessage: string) => {
        setIsGenerating(false)
        setAssistantActivityStatus('Response stopped')
        abortControllerRef.current = null
        setSessions((prev) =>
          prev.map((session) => {
            if (session.id === targetSessionId) {
              const updated = session.messages.map((m) =>
                m.id === assistantMsgId
                  ? {
                    ...m,
                    content: accumulatedContent.trim()
                      ? `${accumulatedContent}\n\n*[Response stopped: ${errMessage}]*`
                      : `*Error: ${errMessage}*`,
                  }
                  : m
              )
              return { ...session, messages: updated }
            }
            return session
          })
        )
      },
    })
  }

  const handleSendMessageRef = useRef(handleSendMessage)
  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage
  })

  const handleVoiceSendTranscript = useCallback((content: string) => {
    setActiveVoiceMode(null)

    const searchParams = new URLSearchParams(route.search || window.location.search)
    const paramSessionId = searchParams.get('sessionId')
    const targetSessionId = voiceOriginRef.current.sessionId || paramSessionId || currentSessionId

    if (targetSessionId) {
      setCurrentSessionId(targetSessionId)
    }

    handleSendMessageRef.current(content)
    const destUrl = targetSessionId ? `/chat/${encodeURIComponent(targetSessionId)}` : '/chat'
    navigate(destUrl)
  }, [currentSessionId, navigate, route.search, setCurrentSessionId])

  const handleVoiceUpdateDraft = useCallback((draft: string) => {
    setActiveVoiceMode(null)
    setComposerPrompt(draft)

    const searchParams = new URLSearchParams(route.search || window.location.search)
    const paramFrom = searchParams.get('from')
    const paramSessionId = searchParams.get('sessionId')
    const originUrl = voiceOriginRef.current.url || paramFrom || '/chat'
    const originSessionId = voiceOriginRef.current.sessionId || paramSessionId || currentSessionId

    if (originSessionId) {
      setCurrentSessionId(originSessionId)
    }

    navigate(originUrl)
  }, [currentSessionId, navigate, route.search, setComposerPrompt, setCurrentSessionId])

  const handleClearLocalData = () => {
    setSessions([])
    setCurrentSessionId('')
    setTasks([])
    setMemories([])
    setKnowledge([])
    setWorkspaces([])
    setActiveWorkspaceId(null)
    setFocusTimer({ startedAt: null, startedDate: null, elapsedSeconds: 0, totalsByDate: {} })
    setPreferences({ accent: 'violet', reducedMotion: false })
    setIsSidebarCollapsed(false)
    try { localStorage.removeItem('nova-sidebar-collapsed') } catch { /* Ignore unavailable browser storage. */ }
    handleSelectTab('chat')
    setComposerPrompt('')
  }

  const handleRenameSession = useCallback((id: string, newTitle: string) => {
    const trimmed = newTitle.trim()
    if (!trimmed) return
    setSessions((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, title: trimmed, updatedAt: new Date().toISOString() } : s))
      const target = updated.find((s) => s.id === id)
      if (target) {
        persistChatSession(target).catch(() => {})
      }
      return updated
    })
  }, [setSessions])

  const handleTogglePinSession = useCallback((id: string) => {
    setSessions((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, isPinned: !s.isPinned } : s))
      const target = updated.find((s) => s.id === id)
      if (target) {
        persistChatSession(target).catch(() => {})
      }
      return updated
    })
  }, [setSessions])

  const handleToggleArchiveSession = useCallback((id: string) => {
    setSessions((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, isArchived: !s.isArchived } : s))
      const target = updated.find((s) => s.id === id)
      if (target) {
        persistChatSession(target).catch(() => {})
      }
      return updated
    })
  }, [setSessions])

  const handleDeleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const remaining = prev.filter((session) => session.id !== id)
      if (currentSessionId === id) {
        if (remaining.length > 0) {
          setCurrentSessionId(remaining[0].id)
        } else {
          const newId = `session-${crypto.randomUUID()}`
          const newSession: ChatSession = {
            id: newId,
            title: 'New Conversation',
            updatedAt: new Date().toISOString(),
            messages: [],
          }
          setCurrentSessionId(newId)
          deleteChatSession(id).catch(() => {})
          return [newSession]
        }
      }
      deleteChatSession(id).catch(() => {})
      return remaining
    })
  }, [currentSessionId, setCurrentSessionId, setSessions])

  // Comprehensive sign out handler that handles errors, updates Supabase status, and ensures unauthenticated state
  const handleSignOutApp = async () => {
    try {
      const res = await signOutUser()
      if (res && res.error) {
        console.error('Sign-out error:', res.error)
        alert(`Failed to sign out: ${res.error}`)
        return
      }
    } catch (err) {
      console.error('Sign-out exception:', err)
      alert('An unexpected error occurred while signing out.')
      return
    }
    setCurrentUser(null)
    setIsGuestMode(false)
    setActiveWorkspaceId(null)
    setTasks([])
    setMemories([])
    setKnowledge([])
    setWorkspaces([])
    setSessions([])
    const liveStatus = await checkSupabaseConnection()
    setSupabaseStatus(liveStatus)
  }

  const showLoginPage = route.tab === 'login' || (!isAuthChecking && !currentUser && !isGuestMode)

  if (showLoginPage) {
    return (
      <LoginPage
        onSuccess={(userId, email) => {
          const derivedName = email ? email.split('@')[0] : undefined
          setCurrentUser({ id: userId, email, displayName: derivedName })
          setIsGuestMode(false)
          getCurrentAuthInfo().then((info) => {
            if (info.displayName) {
              setCurrentUser((prev) => (prev ? { ...prev, displayName: info.displayName } : prev))
            }
          })
          checkSupabaseConnection().then((liveStatus) => {
            setSupabaseStatus(liveStatus)
          })
          navigate('/home')
        }}
        onContinueAsGuest={async () => {
          setIsGuestMode(true)
          if (isSupabaseConfigured()) {
            try {
              const res = await signInAnonymously()
              if (res.success && res.user) {
                const u = res.user as { id: string }
                setCurrentUser({ id: u.id, displayName: 'Guest User' })
              }
            } catch (err) {
              console.warn('[NOVA Auth] Anonymous sign-in error:', err)
            }
          }
          navigate('/home')
        }}
        initialEmail={supabaseStatus.userEmail || ''}
      />
    )
  }

  // When voice mode is active, render ONLY the full-viewport voice interface with ZERO navigation bars
  const isVoiceActive = route.tab === 'voice' || activeVoiceMode !== null

  if (isVoiceActive) {
    const effectiveMode = activeVoiceMode || route.voiceMode || 'sts'
    return (
      <div
        className="nova-voice-fullscreen-host fixed inset-0 w-full h-[100dvh] overflow-hidden bg-[#07060a] z-[100]"
        data-accent={preferences.accent}
        data-theme={preferences.theme ?? 'dark'}
      >
        <VoiceExperience
          mode={effectiveMode}
          onClose={handleCloseVoice}
          onSendTranscript={handleVoiceSendTranscript}
          onUpdateDraft={handleVoiceUpdateDraft}
          initialDraft={composerPrompt}
          memoryContext={
            memories.length > 0
              ? memories.slice(0, 6).map((m) => `• [${m.category}] ${m.content}`).join('\n')
              : undefined
          }
          onExecuteTool={async (name, args) => {
            const result = await executeToolCall(name, args, {
              prompt: '',
              tasks,
              memories,
              knowledge,
              workspaces,
              activeWorkspaceId,
              currentUser,
              onAddTask: handleAddTask,
              onUpdateTask: handleUpdateTask,
              onDeleteTask: handleDeleteTask,
              onToggleTask: handleToggleTask,
              onDeleteAllTasks: handleDeleteAllTasks,
              onAddMemory: handleAddMemory,
              onUpdateMemory: handleUpdateMemory,
              onDeleteMemory: handleDeleteMemory,
              onAddKnowledge: handleAddKnowledge,
              onUpdateKnowledge: handleUpdateKnowledge,
              onDeleteKnowledge: handleDeleteKnowledge,
              onAddWorkspace: handleAddWorkspace,
              onUpdateWorkspace: handleUpdateWorkspace,
              onDeleteWorkspace: handleDeleteWorkspace,
              onSelectWorkspace: setActiveWorkspaceId,
            })
            if (result.status === 'error') {
              throw new Error(result.error || result.response || 'Action failed')
            }
            return { output: result.response }
          }}
        />
      </div>
    )
  }

  return (
    <div className="nova-shell flex h-screen w-full overflow-hidden bg-[#08090b] text-[#dcdfe5] relative" data-accent={preferences.accent} data-motion={preferences.reducedMotion ? 'reduced' : 'full'} data-theme={preferences.theme ?? 'dark'}>
      {/* Subtle top ambient aura */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[540px] h-[260px] bg-violet-950/10 blur-[130px] pointer-events-none rounded-full"
        aria-hidden="true"
      />

      {/* Responsive Quiet Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        onClose={() => setIsSidebarOpen(false)}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onNewChat={handleNewChat}
        sessions={sessions}
        currentSessionId={activeChatId}
        onSelectSession={handleSelectSession}
        onRenameSession={handleRenameSession}
        onTogglePinSession={handleTogglePinSession}
        onToggleArchiveSession={handleToggleArchiveSession}
        onDeleteSession={handleDeleteSession}
        pendingTasksCount={tasks.filter((t) => !t.completed).length}
        memoryItemsCount={memories.length}
        activeWorkspaceName={activeWorkspaceName}
        currentUserEmail={currentUser?.email}
        displayName={currentUser?.displayName}
        onOpenLogin={() => navigate('/login')}
        userName={preferences.userName}
        isHomeLanding={isChatLanding}
      />

      {/* Main Experience Workspace */}
      <main inert={isSidebarOpen} className="flex-1 flex flex-col h-full min-w-0 bg-[#08090b] relative z-10">
        {activeVoiceMode === null && (
          <Header
            activeTab={activeTab}
            onOpenSidebar={() => setIsSidebarOpen(true)}
            sidebarOpen={isSidebarOpen}
            onToggleSidebar={toggleSidebar}
            sidebarCollapsed={isSidebarCollapsed}
            onNewChat={handleNewChat}
            storageAvailable={localSaveAvailable}
            activeWorkspaceName={activeWorkspaceName}
            isHomeLanding={isChatLanding}
          />
        )}

        {/* View Switcher */}
        <div key={activeTab} className={activeTab === 'home' ? 'chat-landing-frame flex-1 min-h-0 overflow-hidden relative' : 'flex-1 flex flex-col min-h-0 overflow-hidden relative'}>
          {route.isNotFound && (
            <NotFoundView onReturnHome={() => navigate('/home')} />
          )}

          {!route.isNotFound && activeTab === 'dashboard' && (
            <DashboardView tasks={tasks} focusTimer={focusTimer} onFocusTimerChange={setFocusTimer} onToggleTask={handleToggleTask} onOpen={handleSelectTab} storageAvailable={localSaveAvailable} workspaces={workspaces} />
          )}

          {!route.isNotFound && activeTab === 'home' && (
            <HomeView
              displayName={currentUser?.displayName || preferences.userName}
              workspaceName={workspaces.find((space) => space.id === currentSession.workspaceId)?.name}
              composerPrompt={composerPrompt}
              onComposerChange={setComposerPrompt}
              onSendMessage={(content, attachment) => {
                handleSendMessage(content, attachment)
                const targetId = activeChatId
                navigate(`/chat/${encodeURIComponent(targetId)}`)
              }}
              onSelectTool={setActiveTool}
              onSelectVoiceMode={(mode) => handleOpenVoice(mode, '/home')}
              onSelectTab={handleSelectTab}
              isGenerating={isGenerating}
              storageAvailable={localSaveAvailable}
              hasApiKey={hasApiKey}
            />
          )}

          {!route.isNotFound && activeTab === 'chat' && (
            <>
              <ChatView
                session={currentSession}
                workspaceName={workspaces.find((space) => space.id === currentSession.workspaceId)?.name}
                isGenerating={isGenerating}
                activityStatus={assistantActivityStatus}
                onStopGeneration={handleStopGeneration}
                hasApiKey={hasApiKey}
                isLoadingSession={sessionLoadingState.isLoading && sessionLoadingState.sessionId === activeChatId}
                sessionLoadError={sessionLoadingState.sessionId === activeChatId ? sessionLoadingState.error : null}
                onRetryLoadSession={handleRetryLoadSession}
                onSuggestionClick={(prompt) => {
                  setComposerPrompt(prompt)
                  setTimeout(() => {
                    document.querySelector<HTMLTextAreaElement>('.message-composer-input')?.focus()
                  }, 50)
                }}
              />
              <MessageComposer
                value={composerPrompt}
                onChange={setComposerPrompt}
                onSendMessage={handleSendMessage}
                onOpenSettings={() => handleSelectTab('settings')}
                onSelectVoiceMode={(mode) => handleOpenVoice(mode, `/chat/${encodeURIComponent(currentSession.id)}`)}
                onSelectTool={setActiveTool}
                onOpenLibrary={() => handleSelectTab('knowledge')}
                disabled={isGenerating}
                isHomeLanding={false}
              />
            </>
          )}

          {!route.isNotFound && activeTab === 'my-day' && (
            <MyDayView
              tasks={tasks}
              onAddTask={handleAddTask}
              onToggleTask={handleToggleTask}
              onOpenTasks={() => handleSelectTab('tasks')}
              storageAvailable={localSaveAvailable}
              workspaces={workspaces}
              currentWorkspaceId={activeWorkspaceId}
              onOpenChatWithPrompt={handleOpenChatWithPrompt}
              syncStatus={tasksSyncStatus}
            />
          )}

          {!route.isNotFound && activeTab === 'tasks' && (
            <TasksView
              tasks={tasks}
              onToggleTask={handleToggleTask}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              storageAvailable={localSaveAvailable}
              workspaces={workspaces}
              currentWorkspaceId={activeWorkspaceId}
              syncStatus={tasksSyncStatus}
              syncError={tasksSyncError}
              onRetrySync={handleRetryTasksSync}
            />
          )}

          {!route.isNotFound && activeTab === 'memory' && (
            <MemoryView
              memories={memories}
              onAddMemory={handleAddMemory}
              onDeleteMemory={handleDeleteMemory}
              onUpdateMemory={handleUpdateMemory}
              storageAvailable={localSaveAvailable}
              workspaces={workspaces}
              currentWorkspaceId={activeWorkspaceId}
            />
          )}

          {!route.isNotFound && activeTab === 'history' && (
            <HistoryView
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSelectSession={handleSelectSession}
              onNewChat={handleNewChat}
              onDeleteSession={handleDeleteSession}
              onToggleArchiveSession={handleToggleArchiveSession}
            />
          )}

          {!route.isNotFound && activeTab === 'settings' && (
            <SettingsView
              preferences={preferences}
              onChange={setPreferences}
              data={{ tasks, memories, knowledge, workspaces, sessions, focusTimer, preferences, activeWorkspaceId }}
              onClearData={handleClearLocalData}
              storageAvailable={localSaveAvailable}
              activeWorkspaceName={activeWorkspaceName}
              currentUserEmail={currentUser?.email}
              currentDisplayName={currentUser?.displayName}
              onResetSession={() => {
                handleNewChat(null)
              }}
              onClearChats={() => {
                setSessions([])
                setCurrentSessionId('')
              }}
              onRestoreBackup={handleRestoreBackup}
              supabaseStatus={supabaseStatus}
              onCheckSupabaseConnection={async () => {
                const liveStatus = await checkSupabaseConnection()
                setSupabaseStatus(liveStatus)
                return liveStatus
              }}
              onMigrateToSupabase={async () => {
                const res = await migrateLocalStorageToSupabase()
                const liveStatus = await checkSupabaseConnection()
                setSupabaseStatus(liveStatus)
                return res
              }}
              onSignOut={handleSignOutApp}
            />
          )}

          {!route.isNotFound && activeTab === 'knowledge' && (
            <KnowledgeView entries={knowledge} workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} onAdd={handleAddKnowledge} onUpdate={handleUpdateKnowledge} onDelete={handleDeleteKnowledge} storageAvailable={localSaveAvailable} />
          )}

          {!route.isNotFound && activeTab === 'workspaces' && (
            <WorkspacesView spaces={workspaces} activeId={activeWorkspaceId} tasks={tasks} memories={memories} knowledge={knowledge} sessions={sessions} onSelect={setActiveWorkspaceId} onAdd={handleAddWorkspace} onUpdate={handleUpdateWorkspace} onDelete={handleDeleteWorkspace} onNavigate={handleSelectTab} onOpenChat={(workspaceId) => handleNewChat(workspaceId)} onSelectChat={handleSelectSession} storageAvailable={localSaveAvailable} />
          )}
        </div>
      </main>

      {/* Standard Mobile Bottom Navigation - 100% removed during dedicated voice interaction */}
      {activeVoiceMode === null && (
        <nav className="mobile-tabbar" aria-label="Quick navigation" inert={isSidebarOpen}>
          {([['home', 'Home'], ['dashboard', 'Overview'], ['my-day', 'My Day'], ['tasks', 'Tasks'], ['settings', 'Settings']] as const).map(([tab, label]) => {
            const icons = { home: Home, dashboard: LayoutDashboard, 'my-day': Sun, chat: MessageCircle, tasks: CheckSquare, settings: Settings }
            const Icon = icons[tab]
            return <button key={tab} className={activeTab === tab ? 'current' : ''} onClick={() => handleSelectTab(tab)} aria-label={label}><Icon size={18} /><small>{label}</small></button>
          })}
        </nav>
      )}

      <ToolStudioModal capability={activeTool} onClose={() => setActiveTool(null)} />
    </div>
  )
}
