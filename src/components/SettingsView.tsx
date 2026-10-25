import React, { useState, useEffect, useMemo } from 'react'
import {
  User,
  Palette,
  Cpu,
  Mic,
  MessageSquare,
  CheckSquare,
  Bell,
  Shield,
  CreditCard,
  Keyboard,
  LogOut,
  Search,
  X,
  Check,
  Moon,
  Sun,
  Monitor,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  AlertCircle,
  Sliders,
  Database,
  Brain,
} from 'lucide-react'
import {
  getHindsightMemoryStatus,
  type HindsightClientStatus,
} from '../services/hindsightClient'
import type {
  AppPreferences,
  FocusTimerState,
  KnowledgeItem,
  MemoryItem,
  TaskItem,
  WorkspaceItem,
  ChatSession,
  ThemeMode,
} from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import {
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  updateUserProfile,
  type SupabaseConfigStatus,
  type MigrationResult,
} from '../services/dataService'

export type SettingsCategory =
  | 'account'
  | 'appearance'
  | 'ai'
  | 'voice'
  | 'chat'
  | 'tasks'
  | 'notifications'
  | 'privacy'
  | 'billing'
  | 'shortcuts'
  | 'signout'

interface SettingsViewProps {
  preferences: AppPreferences
  onChange: (preferences: AppPreferences | ((current: AppPreferences) => AppPreferences)) => void
  data: {
    tasks: TaskItem[]
    memories: MemoryItem[]
    knowledge: KnowledgeItem[]
    workspaces: WorkspaceItem[]
    sessions: ChatSession[]
    focusTimer: FocusTimerState
    preferences: AppPreferences
    activeWorkspaceId: string | null
  }
  onClearData: () => void
  storageAvailable: boolean
  activeWorkspaceName?: string
  onResetSession?: () => void
  onClearChats?: () => void
  onRestoreBackup?: (backupJson: string) => {
    success: boolean
    counts: { tasks: number; memories: number; knowledge: number; workspaces: number; sessions: number }
    error?: string
  }
  supabaseStatus?: SupabaseConfigStatus
  onCheckSupabaseConnection?: () => Promise<SupabaseConfigStatus>
  onMigrateToSupabase?: () => Promise<MigrationResult>
  onSignOut?: () => void
  currentUserEmail?: string
  currentDisplayName?: string
}

interface CategoryConfig {
  id: SettingsCategory
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  description: string
  keywords: string[]
}

const CATEGORIES: CategoryConfig[] = [
  {
    id: 'account',
    label: 'Account',
    icon: User,
    description: 'Personal profile and local workspace details.',
    keywords: ['profile', 'name', 'avatar', 'user', 'workspace', 'session'],
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: Palette,
    description: 'Theme, highlight tone, and motion preferences.',
    keywords: ['theme', 'dark', 'light', 'system', 'accent', 'color', 'violet', 'indigo', 'plum', 'motion', 'reduced'],
  },
  {
    id: 'ai',
    label: 'AI & Models',
    icon: Cpu,
    description: 'Model connection status and provider configurations.',
    keywords: ['model', 'ai', 'gemini', 'openai', 'claude', 'connection', 'engine', 'provider', 'prompt'],
  },
  {
    id: 'voice',
    label: 'Voice',
    icon: Mic,
    description: 'Microphone permissions, STT/STS modes, and voice synthesis.',
    keywords: ['voice', 'speech', 'mic', 'microphone', 'audio', 'stt', 'sts', 'waveform'],
  },
  {
    id: 'chat',
    label: 'Chat & Data',
    icon: MessageSquare,
    description: 'Conversation storage, export backups, and history management.',
    keywords: ['chat', 'history', 'messages', 'export', 'backup', 'data', 'conversations'],
  },
  {
    id: 'tasks',
    label: 'Tasks & Productivity',
    icon: CheckSquare,
    description: 'Default priorities, task estimates, and schedule behavior.',
    keywords: ['tasks', 'priority', 'estimate', 'schedule', 'week', 'calendar', 'midnight'],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    description: 'Browser desktop notifications and local timer alerts.',
    keywords: ['notifications', 'alerts', 'browser', 'focus', 'timer', 'permission'],
  },
  {
    id: 'privacy',
    label: 'Privacy & Security',
    icon: Shield,
    description: 'Local storage isolation, data boundaries, and backup tools.',
    keywords: ['privacy', 'security', 'storage', 'local', 'data', 'encryption', 'backup'],
  },
  {
    id: 'billing',
    label: 'Billing & Plans',
    icon: CreditCard,
    description: 'Subscription status, planned cloud features, and local edition limits.',
    keywords: ['billing', 'plans', 'pricing', 'subscription', 'free', 'pro', 'invoices'],
  },
  {
    id: 'shortcuts',
    label: 'Keyboard Shortcuts',
    icon: Keyboard,
    description: 'Quick key combinations for navigation and composer actions.',
    keywords: ['shortcuts', 'keyboard', 'hotkeys', 'enter', 'command', 'ctrl', 'escape'],
  },
  {
    id: 'signout',
    label: 'Session & Sign Out',
    icon: LogOut,
    description: 'Reset active session or wipe stored profile data.',
    keywords: ['logout', 'signout', 'reset', 'clear', 'exit', 'session', 'account'],
  },
]

const ACCENT_TONES: { value: AppPreferences['accent']; label: string; color: string }[] = [
  { value: 'violet', label: 'Violet', color: '#b37aff' },
  { value: 'indigo', label: 'Indigo', color: '#929cff' },
  { value: 'plum', label: 'Plum', color: '#d18cff' },
]

export const SettingsView: React.FC<SettingsViewProps> = ({
  preferences,
  onChange,
  data,
  onClearData,
  storageAvailable,
  activeWorkspaceName,
  onResetSession,
  onClearChats,
  onRestoreBackup,
  supabaseStatus,
  onCheckSupabaseConnection,
  onMigrateToSupabase,
  onSignOut,
  currentUserEmail,
  currentDisplayName,
}) => {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('account')
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const [confirmClearChats, setConfirmClearChats] = useState(false)
  const [confirmResetSession, setConfirmResetSession] = useState(false)
  const [restoreNotification, setRestoreNotification] = useState<string | null>(null)
  const [isMigrating, setIsMigrating] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [testFeedback, setTestFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null)
  const [migrationFeedback, setMigrationFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Supabase Auth session state
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authFeedback, setAuthFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [hindsightStatus, setHindsightStatus] = useState<HindsightClientStatus | null>(null)

  useEffect(() => {
    if (activeCategory === 'ai' || activeCategory === 'privacy') {
      getHindsightMemoryStatus().then(setHindsightStatus).catch(() => {})
    }
  }, [activeCategory])

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authEmail.trim() || !authPassword) {
      setAuthFeedback({ type: 'error', message: 'Please enter both email and password.' })
      return
    }
    setIsAuthenticating(true)
    setAuthFeedback(null)
    try {
      if (authMode === 'signin') {
        const res = await signInWithEmail(authEmail, authPassword)
        if (res.success) {
          setAuthFeedback({ type: 'success', message: '✓ Signed in successfully.' })
          setAuthPassword('')
          if (onCheckSupabaseConnection) await onCheckSupabaseConnection()
        } else {
          setAuthFeedback({ type: 'error', message: `Sign in failed: ${res.error || 'Check credentials'}` })
        }
      } else {
        const res = await signUpWithEmail(authEmail, authPassword)
        if (res.success) {
          if (res.confirmationRequired) {
            setAuthFeedback({ type: 'success', message: '✓ Account created! Check your email to confirm your registration.' })
          } else {
            setAuthFeedback({ type: 'success', message: '✓ Account created and signed in!' })
            if (onCheckSupabaseConnection) await onCheckSupabaseConnection()
          }
          setAuthPassword('')
        } else {
          setAuthFeedback({ type: 'error', message: `Sign up failed: ${res.error || 'Failed to create account'}` })
        }
      }
    } catch (err) {
      setAuthFeedback({ type: 'error', message: err instanceof Error ? err.message : String(err) })
    } finally {
      setIsAuthenticating(false)
    }
  }

  const handleSignOut = async () => {
    setIsAuthenticating(true)
    setAuthFeedback(null)
    try {
      const res = await signOutUser()
      if (res.success) {
        setAuthFeedback({ type: 'success', message: '✓ Signed out from Supabase.' })
        if (onCheckSupabaseConnection) await onCheckSupabaseConnection()
        if (onSignOut) onSignOut()
      } else {
        setAuthFeedback({ type: 'error', message: res.error || 'Sign out failed.' })
      }
    } finally {
      setIsAuthenticating(false)
    }
  }

  // Profile name editing
  const resolvedProfileName = preferences.userName ?? currentDisplayName ?? (currentUserEmail ? currentUserEmail.split('@')[0] : '')
  const [prevResolvedName, setPrevResolvedName] = useState(resolvedProfileName)
  const [userNameInput, setUserNameInput] = useState(resolvedProfileName)
  const [isSavedName, setIsSavedName] = useState(false)

  if (resolvedProfileName !== prevResolvedName) {
    setPrevResolvedName(resolvedProfileName)
    setUserNameInput(resolvedProfileName)
  }

  // Real browser capability checks
  const [micStatus, setMicStatus] = useState<'granted' | 'prompt' | 'denied' | 'checking'>('checking')
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission
    }
    return 'unsupported'
  })
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content && onRestoreBackup) {
        const res = onRestoreBackup(content)
        if (res.success) {
          setRestoreNotification(
            `✓ Restored: ${res.counts.tasks} tasks, ${res.counts.memories} memories, ${res.counts.knowledge} notes, ${res.counts.workspaces} workspaces.`
          )
        } else {
          setRestoreNotification(`⚠️ Restore failed: ${res.error || 'Invalid backup structure'}`)
        }
        setTimeout(() => setRestoreNotification(null), 6000)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Check microphone permissions
  useEffect(() => {
    let isMounted = true
    const checkMic = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
          if (isMounted) setMicStatus(result.state)
          result.onchange = () => {
            if (isMounted) setMicStatus(result.state)
          }
        } else {
          if (isMounted) setMicStatus('prompt')
        }
      } catch {
        if (isMounted) setMicStatus('prompt')
      }
    }
    checkMic()
    return () => {
      isMounted = false
    }
  }, [])



  // Load available speech synthesis voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        const available = window.speechSynthesis.getVoices()
        if (available.length > 0) {
          setSpeechVoices(available)
        }
      }
      updateVoices()
      window.speechSynthesis.onvoiceschanged = updateVoices
    }
  }, [])

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return CATEGORIES
    return CATEGORIES.filter(
      (cat) =>
        cat.label.toLowerCase().includes(q) ||
        cat.description.toLowerCase().includes(q) ||
        cat.keywords.some((k) => k.includes(q))
    )
  }, [searchQuery])

  // Select category
  const handleSelectCategory = (id: SettingsCategory) => {
    setActiveCategory(id)
  }

  // Profile save
  const handleSaveProfileName = async () => {
    const trimmed = userNameInput.trim()
    onChange((curr) => ({ ...curr, userName: trimmed || undefined }))
    if (trimmed) {
      await updateUserProfile({ fullName: trimmed }).catch(() => null)
      if (onCheckSupabaseConnection) await onCheckSupabaseConnection().catch(() => null)
    }
    setIsSavedName(true)
    setTimeout(() => setIsSavedName(false), 2000)
  }

  // Request browser notifications
  const handleRequestNotifications = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const result = await Notification.requestPermission()
        setNotificationStatus(result)
      } catch {
        // Ignored if user dismisses
      }
    }
  }

  // Request mic access
  const handleRequestMicAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setMicStatus('granted')
      stream.getTracks().forEach((track) => track.stop())
    } catch {
      setMicStatus('denied')
    }
  }

  // Export full backup
  const handleExportBackup = () => {
    const payload = {
      product: 'NOVA',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      ...data,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `nova-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Test live Supabase connection
  const handleTestConnection = async () => {
    if (!onCheckSupabaseConnection) return
    setIsTestingConnection(true)
    setTestFeedback(null)
    try {
      const res = await onCheckSupabaseConnection()
      if (res.connectionState === 'connected') {
        if (res.authStatus === 'anonymous_disabled') {
          setTestFeedback({
            type: 'warning',
            message: `✓ Tables verified at ${res.url}. However, Anonymous sign-ins are disabled in your Supabase project. Enable them under Authentication -> Providers -> Anonymous, or sign in below with email.`,
          })
        } else {
          setTestFeedback({
            type: 'success',
            message: `✓ Connection verified: Reached Supabase at ${res.url}. RLS is active and all database tables are accessible.`,
          })
        }
      } else if (res.connectionState === 'tables_missing') {
        const missingList = (res.missingTables || []).join(', ')
        setTestFeedback({
          type: 'warning',
          message: `⚠️ Tables missing (${missingList}): Connected to Supabase project, but database tables are missing. Run supabase/migrations/20261024000000_nova_schema.sql in your Supabase SQL Editor.`,
        })
      } else if (res.connectionState === 'auth_error') {
        setTestFeedback({
          type: 'error',
          message: '⚠️ Authentication failed: Supabase rejected the API key (401 Unauthorized). Verify VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY in .env.',
        })
      } else if (res.connectionState === 'unreachable') {
        setTestFeedback({
          type: 'error',
          message: `⚠️ Project unreachable: ${res.statusMessage || res.error || 'Network error'}`,
        })
      } else {
        setTestFeedback({
          type: 'error',
          message: `⚠️ Unconfigured: ${res.statusMessage || res.error || 'Check environment variables'}`,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setTestFeedback({
        type: 'error',
        message: `⚠️ Connection test error: ${msg}`,
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  // Run idempotent Supabase cloud migration
  const handleRunMigration = async () => {
    if (!onMigrateToSupabase) return
    setIsMigrating(true)
    setMigrationFeedback(null)
    try {
      const res = await onMigrateToSupabase()
      if (res.success && res.verified) {
        setMigrationFeedback({
          type: 'success',
          message: `✓ Migration Verified: ${res.verifiedCounts.tasks} tasks, ${res.verifiedCounts.memories} memories, ${res.verifiedCounts.knowledge} notes, ${res.verifiedCounts.workspaces} workspaces, ${res.verifiedCounts.sessions} chat sessions safely upserted and verified in Supabase PostgreSQL. Local data has been retained.`,
        })
      } else {
        setMigrationFeedback({
          type: 'error',
          message: `⚠️ Migration incomplete: ${res.error || 'Verification query failed to match counts.'}`,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMigrationFeedback({
        type: 'error',
        message: `⚠️ Migration Failed: ${msg}`,
      })
    } finally {
      setIsMigrating(false)
    }
  }

  // Total messages count across all sessions
  const totalMessagesCount = useMemo(() => {
    return data.sessions.reduce((acc, sess) => acc + sess.messages.length, 0)
  }, [data.sessions])

  // Active / completed tasks count
  const activeTasksCount = useMemo(() => data.tasks.filter((t) => !t.completed).length, [data.tasks])
  const completedTasksCount = useMemo(() => data.tasks.filter((t) => t.completed).length, [data.tasks])

  const activeCatInfo = CATEGORIES.find((c) => c.id === activeCategory) ?? CATEGORIES[0]

  return (
    <div className="settings-page flex-1 overflow-y-auto select-text">
      <div className="settings-layout">
        {/* Left Category Navigation Column */}
        <aside className="settings-sidebar" aria-label="Settings categories">
          <div className="settings-search-wrap">
            <Search size={15} className="settings-search-icon" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search settings..."
              className="settings-search-input"
              aria-label="Filter settings"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="settings-search-clear"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <nav className="settings-category-list" role="tablist" aria-orientation="vertical">
            {filteredCategories.length === 0 ? (
              <div className="settings-empty-filter">No settings found</div>
            ) : (
              filteredCategories.map((cat) => {
                const Icon = cat.icon
                const isActive = activeCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    id={`tab-${cat.id}`}
                    aria-selected={isActive}
                    aria-controls={`panel-${cat.id}`}
                    className={`settings-cat-btn ${isActive ? 'active' : ''} ${cat.id === 'signout' ? 'signout-item' : ''}`}
                    onClick={() => handleSelectCategory(cat.id)}
                  >
                    <Icon size={16} aria-hidden="true" />
                    <span>{cat.label}</span>
                  </button>
                )
              })
            )}
          </nav>
        </aside>

        {/* Right Main Content Panel */}
        <main
          className="settings-main-panel"
          id={`panel-${activeCategory}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeCategory}`}
        >
          {/* Header */}
          <div className="settings-panel-header">
            <span className="eyebrow">SETTINGS & PREFERENCES</span>
            <h1>{activeCatInfo.label}</h1>
            <p className="intro-copy">{activeCatInfo.description}</p>
          </div>

          {/* Category A: Account */}
          {activeCategory === 'account' && (
            <div className="settings-panel-sections">
              <section className="settings-section">
                <div className="settings-section-title">
                  <User size={16} />
                  <h2>Personal Profile</h2>
                </div>
                <div className="settings-control-row">
                  <div className="profile-edit-avatar-group">
                    <div className="settings-profile-avatar" aria-hidden="true">
                      {(userNameInput.trim() || preferences.userName || currentDisplayName || (currentUserEmail ? currentUserEmail.charAt(0) : 'U')).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <strong>Display Name</strong>
                      <p>How NOVA addresses you across conversations and tasks.</p>
                    </div>
                  </div>
                  <div className="profile-edit-input-group">
                    <input
                      type="text"
                      value={userNameInput}
                      onChange={(e) => setUserNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveProfileName()
                      }}
                      className="settings-text-input"
                      aria-label="Profile name"
                      maxLength={32}
                    />
                    <button
                      type="button"
                      onClick={handleSaveProfileName}
                      className="subtle-pill save-btn"
                    >
                      {isSavedName ? <Check size={14} className="text-emerald-400" /> : 'Save'}
                    </button>
                  </div>
                </div>

                <div className="settings-status-row">
                  <div>
                    <strong>Active Workspace</strong>
                    <p>Currently active project or personal scope.</p>
                  </div>
                  <span className="settings-badge-pill">
                    {activeWorkspaceName ?? 'Personal workspace'}
                  </span>
                </div>

                <div className="settings-status-row">
                  <div>
                    <strong>Account Identity & Storage Model</strong>
                    <p>
                      NOVA runs as a local-first application. No external accounts or passwords are
                      required; your profile and configurations are stored in your current browser session.
                    </p>
                  </div>
                  <span className="settings-badge-pill">Local Profile</span>
                </div>
              </section>
            </div>
          )}

          {/* Category B: Appearance & Personalisation */}
          {activeCategory === 'appearance' && (
            <div className="settings-panel-sections">
              <section className="settings-section">
                <div className="settings-section-title">
                  <Palette size={16} />
                  <h2>Theme & Colors</h2>
                </div>

                {/* Theme Mode: Dark, Light, System */}
                <div className="settings-control-row">
                  <div>
                    <strong>Theme</strong>
                    <p>Choose between dark, light, or system-matched appearance.</p>
                  </div>
                  <div className="theme-toggle-group" role="group" aria-label="Theme mode">
                    {[
                      { id: 'dark', label: 'Dark', icon: Moon },
                      { id: 'light', label: 'Light', icon: Sun },
                      { id: 'system', label: 'System', icon: Monitor },
                    ].map((mode) => {
                      const Icon = mode.icon
                      const isSelected = (preferences.theme ?? 'dark') === mode.id
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          className={`theme-option-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => onChange((curr) => ({ ...curr, theme: mode.id as ThemeMode }))}
                          aria-pressed={isSelected}
                        >
                          <Icon size={14} aria-hidden="true" />
                          <span>{mode.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Accent Tone: Violet, Indigo, Plum */}
                <div className="settings-control-row">
                  <div>
                    <strong>Accent Highlight</strong>
                    <p>Select the luminous brand color used across borders, controls, and active items.</p>
                  </div>
                  <div className="accent-options" role="group" aria-label="Accent tone">
                    {ACCENT_TONES.map((tone) => (
                      <button
                        key={tone.value}
                        type="button"
                        className={`accent-option ${preferences.accent === tone.value ? 'selected' : ''}`}
                        onClick={() => onChange((curr) => ({ ...curr, accent: tone.value }))}
                        aria-pressed={preferences.accent === tone.value}
                      >
                        <span style={{ backgroundColor: tone.color }} aria-hidden="true">
                          {preferences.accent === tone.value && <Check size={12} />}
                        </span>
                        {tone.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reduce Motion */}
                <div className="settings-control-row">
                  <div className="settings-control-label">
                    <Sliders size={16} />
                    <div>
                      <strong>Reduce Motion</strong>
                      <p>
                        Disables the composer border light traveling animation and limits smooth transitions.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`settings-switch ${preferences.reducedMotion ? 'enabled' : ''}`}
                    role="switch"
                    aria-checked={preferences.reducedMotion}
                    aria-label="Reduce motion"
                    onClick={() => onChange((curr) => ({ ...curr, reducedMotion: !curr.reducedMotion }))}
                  >
                    <span />
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* Category C: AI & Models */}
          {activeCategory === 'ai' && (
            <div className="settings-panel-sections">
              <section className="settings-section">
                <div className="settings-section-title">
                  <Cpu size={16} />
                  <h2>Engine & Model State</h2>
                </div>

                <div className="settings-status-row">
                  <div>
                    <strong>Active Connection</strong>
                    <p>
                      NOVA is operating in offline local mode. No external AI model API is connected in
                      this deployment, so chat messages are stored locally without dispatching queries.
                    </p>
                  </div>
                  <span className="connection-state is-disconnected">
                    <i /> Not connected
                  </span>
                </div>

                {/* Model Providers Table */}
                <div className="settings-card-subgroup">
                  <h3 className="settings-subgroup-title">Supported Providers (Pending Integration)</h3>
                  <div className="settings-table-list">
                    <div className="settings-table-row">
                      <div className="settings-table-info">
                        <strong>Google Gemini</strong>
                        <small>Gemini 2.5 Flash / Gemini 1.5 Pro</small>
                      </div>
                      <span className="settings-pill-unconfigured">Unconfigured</span>
                    </div>
                    <div className="settings-table-row">
                      <div className="settings-table-info">
                        <strong>Anthropic Claude</strong>
                        <small>Claude 3.7 Sonnet / Haiku</small>
                      </div>
                      <span className="settings-pill-unconfigured">Unconfigured</span>
                    </div>
                    <div className="settings-table-row">
                      <div className="settings-table-info">
                        <strong>OpenAI</strong>
                        <small>GPT-4o / GPT-4o mini</small>
                      </div>
                      <span className="settings-pill-unconfigured">Unconfigured</span>
                    </div>
                    <div className="settings-table-row">
                      <div className="settings-table-info">
                        <strong>Ollama Local</strong>
                        <small>Local LLM HTTP endpoint (http://localhost:11434)</small>
                      </div>
                      <span className="settings-pill-unconfigured">Unconfigured</span>
                    </div>
                  </div>
                </div>

                {/* Response Preference */}
                <div className="settings-control-row">
                  <div>
                    <strong>Response Style Preference</strong>
                    <p>Controls formatting and verbosity when connected to a generative model.</p>
                  </div>
                  <div className="theme-toggle-group" role="group" aria-label="Response style">
                    {[
                      { id: 'concise', label: 'Concise' },
                      { id: 'detailed', label: 'Detailed' },
                    ].map((style) => {
                      const isSelected = (preferences.responseStyle ?? 'concise') === style.id
                      return (
                        <button
                          key={style.id}
                          type="button"
                          className={`theme-option-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() =>
                            onChange((curr) => ({
                              ...curr,
                              responseStyle: style.id as 'concise' | 'detailed',
                            }))
                          }
                          aria-pressed={isSelected}
                        >
                          <span>{style.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Hindsight Cloud Long-Term Conversational Memory Layer */}
                <div className="settings-card-subgroup">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="settings-subgroup-title flex items-center gap-2">
                      <Brain size={15} /> Hindsight Cloud Memory Layer
                    </h3>
                    <span
                      className={`connection-state ${
                        hindsightStatus?.isConfigured ? 'is-connected' : 'is-disconnected'
                      }`}
                    >
                      <i />
                      {hindsightStatus?.isConfigured ? 'Active & Isolated' : 'Local Fallback'}
                    </span>
                  </div>
                  <div className="settings-table-list">
                    <div className="settings-table-row">
                      <div className="settings-table-info">
                        <strong>Retain Activity (Rolling Hour)</strong>
                        <small>Selective long-term factual memories retained</small>
                      </div>
                      <strong>{hindsightStatus?.retainCalls ?? 0} / 60 calls</strong>
                    </div>
                    <div className="settings-table-row">
                      <div className="settings-table-info">
                        <strong>Recall Activity (Rolling Hour)</strong>
                        <small>Semantic context lookups without LLM overhead</small>
                      </div>
                      <strong>{hindsightStatus?.recallCalls ?? 0} / 150 calls</strong>
                    </div>
                    <div className="settings-table-row">
                      <div className="settings-table-info">
                        <strong>Reflect Synthesis (Rolling Hour)</strong>
                        <small>Gated strictly to explicit synthesis queries</small>
                      </div>
                      <strong>{hindsightStatus?.reflectCalls ?? 0} / 20 calls</strong>
                    </div>
                    <div className="settings-table-row">
                      <div className="settings-table-info">
                        <strong>Balance & Quota Safeguard</strong>
                        <small>Automatic top-ups disabled to protect credit balance</small>
                      </div>
                      <span className="text-emerald-400 font-mono text-xs">Protected</span>
                    </div>
                  </div>
                </div>

                <div className="settings-note-box">
                  <AlertCircle size={15} />
                  <span>
                    API secrets must never be exposed or hardcoded in frontend browser builds. When
                    configuring external providers, ensure keys are managed securely via a proxy backend.
                  </span>
                </div>
              </section>
            </div>
          )}

          {/* Category D: Voice */}
          {activeCategory === 'voice' && (
            <div className="settings-panel-sections">
              <section className="settings-section">
                <div className="settings-section-title">
                  <Mic size={16} />
                  <h2>Voice Modes & Devices</h2>
                </div>

                {/* Microphone Permission Status */}
                <div className="settings-status-row">
                  <div>
                    <strong>Microphone Device Permission</strong>
                    <p>Required for Speech to Text and real-time Speech to Speech conversation.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`connection-state ${micStatus === 'granted' ? 'is-connected' : 'is-disconnected'}`}>
                      <i /> {micStatus === 'granted' ? 'Access granted' : micStatus === 'denied' ? 'Access denied' : 'Prompt on use'}
                    </span>
                    {micStatus !== 'granted' && (
                      <button
                        type="button"
                        onClick={handleRequestMicAccess}
                        className="subtle-pill text-xs"
                      >
                        Grant permission
                      </button>
                    )}
                  </div>
                </div>

                {/* Default Voice Mode */}
                <div className="settings-control-row">
                  <div>
                    <strong>Default Voice Interaction Mode</strong>
                    <p>Choose which experience opens when tapping the microphone button.</p>
                  </div>
                  <div className="theme-toggle-group" role="group" aria-label="Default voice mode">
                    {[
                      { id: 'stt', label: 'Speech to Text' },
                      { id: 'sts', label: 'Speech to Speech' },
                    ].map((mode) => {
                      const isSelected = (preferences.defaultVoiceMode ?? 'stt') === mode.id
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          className={`theme-option-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() =>
                            onChange((curr) => ({
                              ...curr,
                              defaultVoiceMode: mode.id as 'stt' | 'sts',
                            }))
                          }
                          aria-pressed={isSelected}
                        >
                          <span>{mode.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Voice Mode Descriptions */}
                <div className="settings-card-subgroup">
                  <h3 className="settings-subgroup-title">Supported Voice Modes</h3>
                  <div className="settings-table-list">
                    <div className="settings-table-row">
                      <div className="settings-table-info">
                        <strong>Speech to Text (STT)</strong>
                        <small>Transcribes spoken words into editable text in the chat composer with review options before sending.</small>
                      </div>
                      <span className="settings-badge-pill">Composer</span>
                    </div>
                    <div className="settings-table-row">
                      <div className="settings-table-info">
                        <strong>Speech to Speech (STS)</strong>
                        <small>Full interactive voice interface featuring the dark concentric orb, audio-reactive waveforms, and spoken synthesis.</small>
                      </div>
                      <span className="settings-badge-pill">Orb Experience</span>
                    </div>
                  </div>
                </div>

                {/* Speech Synthesis Voice Selection */}
                {speechVoices.length > 0 && (
                  <div className="settings-control-row">
                    <div>
                      <strong>Synthesizer Voice</strong>
                      <p>Select the preferred speech synthesis voice for spoken responses in STS mode.</p>
                    </div>
                    <div className="settings-select-wrapper">
                      <select
                        value={preferences.preferredVoice ?? ''}
                        onChange={(e) =>
                          onChange((curr) => ({ ...curr, preferredVoice: e.target.value || undefined }))
                        }
                        className="settings-select"
                        aria-label="Synthesizer voice"
                      >
                        <option value="">Default system voice</option>
                        {speechVoices.map((v) => (
                          <option key={v.name} value={v.name}>
                            {v.name} ({v.lang})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Category E: Chat & Data */}
          {activeCategory === 'chat' && (
            <div className="settings-panel-sections">
              <section className="settings-section">
                <div className="settings-section-title">
                  <MessageSquare size={16} />
                  <h2>Conversation History & Storage</h2>
                </div>

                <div className="settings-status-row">
                  <div>
                    <strong>Total Conversations</strong>
                    <p>All chats saved in your local browser profile.</p>
                  </div>
                  <span className="settings-badge-pill">{data.sessions.length} chats</span>
                </div>

                <div className="settings-status-row">
                  <div>
                    <strong>Total Messages</strong>
                    <p>Combined message count across all conversations.</p>
                  </div>
                  <span className="settings-badge-pill">{totalMessagesCount} messages</span>
                </div>

                <div className="settings-status-row">
                  <div>
                    <strong>Data Storage & Network Policy</strong>
                    <p>
                      Messages and attachments are saved directly to this browser profile’s localStorage.
                      No conversation content is uploaded to remote servers or third-party analytical trackers.
                    </p>
                  </div>
                  <span className="settings-badge-pill">Browser Only</span>
                </div>

                <div className="settings-data-actions">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <button type="button" className="subtle-pill" onClick={handleExportBackup}>
                    <Download size={14} /> Export backup (.json)
                  </button>
                  <button type="button" className="subtle-pill" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={14} /> Restore backup (.json)
                  </button>
                  {onClearChats && data.sessions.length > 0 && (
                    <button
                      type="button"
                      className="settings-clear-button"
                      onClick={() => setConfirmClearChats(true)}
                    >
                      <Trash2 size={14} /> Clear all conversations
                    </button>
                  )}
                </div>
                {restoreNotification && (
                  <div className="mt-3 p-3 rounded-xl bg-violet-950/40 border border-violet-800/40 text-xs text-violet-200">
                    {restoreNotification}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Category F: Tasks & Productivity */}
          {activeCategory === 'tasks' && (
            <div className="settings-panel-sections">
              <section className="settings-section">
                <div className="settings-section-title">
                  <CheckSquare size={16} />
                  <h2>Task Configuration & Scheduling</h2>
                </div>

                {/* Default Priority */}
                <div className="settings-control-row">
                  <div>
                    <strong>Default Task Priority</strong>
                    <p>Initial priority level preselected when creating a new task.</p>
                  </div>
                  <div className="theme-toggle-group" role="group" aria-label="Default priority">
                    {(['low', 'medium', 'high'] as const).map((p) => {
                      const isSelected = (preferences.defaultTaskPriority ?? 'medium') === p
                      return (
                        <button
                          key={p}
                          type="button"
                          className={`theme-option-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => onChange((curr) => ({ ...curr, defaultTaskPriority: p }))}
                          aria-pressed={isSelected}
                        >
                          <span className="capitalize">{p}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Start of Week */}
                <div className="settings-control-row">
                  <div>
                    <strong>Start of Week</strong>
                    <p>Calendar day used for weekly task planning and overview headers.</p>
                  </div>
                  <div className="theme-toggle-group" role="group" aria-label="Start of week">
                    {(['monday', 'sunday'] as const).map((day) => {
                      const isSelected = (preferences.startOfWeek ?? 'monday') === day
                      return (
                        <button
                          key={day}
                          type="button"
                          className={`theme-option-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => onChange((curr) => ({ ...curr, startOfWeek: day }))}
                          aria-pressed={isSelected}
                        >
                          <span className="capitalize">{day}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Midnight Rollover Explanation */}
                <div className="settings-status-row">
                  <div>
                    <strong>Dynamic Midnight Rollover</strong>
                    <p>
                      Date grouping and scheduled calculations automatically advance at 00:00 local time
                      without needing a page refresh. Date-only deadlines anchor to your local calendar date.
                    </p>
                  </div>
                  <span className="settings-badge-pill">Local Time Synced</span>
                </div>

                <div className="settings-status-row">
                  <div>
                    <strong>Current Task Metrics</strong>
                    <p>Overview of active and completed items.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="settings-badge-pill">{activeTasksCount} active</span>
                    <span className="settings-badge-pill">{completedTasksCount} done</span>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Category G: Notifications */}
          {activeCategory === 'notifications' && (
            <div className="settings-panel-sections">
              <section className="settings-section">
                <div className="settings-section-title">
                  <Bell size={16} />
                  <h2>Notification Channels</h2>
                </div>

                <div className="settings-status-row">
                  <div>
                    <strong>Browser Desktop Alerts</strong>
                    <p>Allows system notification popups when focus timers or task reminders trigger.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`connection-state ${
                        notificationStatus === 'granted'
                          ? 'is-connected'
                          : notificationStatus === 'denied'
                          ? 'is-disconnected'
                          : 'is-offline'
                      }`}
                    >
                      <i />
                      {notificationStatus === 'granted'
                        ? 'Granted'
                        : notificationStatus === 'denied'
                        ? 'Blocked'
                        : notificationStatus === 'unsupported'
                        ? 'Unsupported'
                        : 'Not requested'}
                    </span>
                    {notificationStatus === 'default' && (
                      <button
                        type="button"
                        onClick={handleRequestNotifications}
                        className="subtle-pill text-xs"
                      >
                        Enable notifications
                      </button>
                    )}
                  </div>
                </div>

                <div className="settings-note-box">
                  <AlertCircle size={15} />
                  <span>
                    NOVA runs locally in your browser and does not maintain a background push notification
                    server. Scheduled reminders trigger while this tab or browser window is open.
                  </span>
                </div>
              </section>
            </div>
          )}

          {/* Category H: Privacy & Security */}
          {activeCategory === 'privacy' && (
            <div className="settings-panel-sections">
              <section className="settings-section">
                <div className="settings-section-title">
                  <Shield size={16} />
                  <h2>Local Storage & Privacy</h2>
                </div>

                <div className="privacy-copy">
                  <p>
                    Tasks, conversations, memories, knowledge documents, workspaces, and focus session records
                    {storageAvailable
                      ? ' are stored in this browser’s localStorage so they remain saved across reloads.'
                      : ' are currently held in temporary memory because browser storage is disabled.'}{' '}
                    All records are kept unencrypted in this browser profile and are not transmitted to any AI
                    service or external cloud database.
                  </p>
                  <p>
                    Anyone with access to this browser profile can inspect stored data. Export a backup before
                    clearing local data if you wish to retain your records.
                  </p>
                </div>

                <div className="settings-card-subgroup">
                  <h3 className="settings-subgroup-title">Local Storage Inventory</h3>
                  <div className="settings-table-list">
                    <div className="settings-table-row">
                      <span>Tasks & Schedules</span>
                      <strong>{data.tasks.length} items</strong>
                    </div>
                    <div className="settings-table-row">
                      <span>Memory Items</span>
                      <strong>{data.memories.length} items</strong>
                    </div>
                    <div className="settings-table-row">
                      <span>Knowledge Notes</span>
                      <strong>{data.knowledge.length} documents</strong>
                    </div>
                    <div className="settings-table-row">
                      <span>Workspaces</span>
                      <strong>{data.workspaces.length} workspaces</strong>
                    </div>
                    <div className="settings-table-row">
                      <span>Chat Sessions</span>
                      <strong>{data.sessions.length} sessions</strong>
                    </div>
                  </div>
                </div>

                {/* Supabase Cloud Persistence & Migration */}
                <div className="settings-card-subgroup">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="settings-subgroup-title flex items-center gap-2">
                      <Database size={15} /> Supabase PostgreSQL Persistence
                    </h3>
                    {supabaseStatus?.connectionState === 'connected' ? (
                      supabaseStatus?.authStatus === 'anonymous_disabled' ? (
                        <span className="connection-state is-warning">
                          <i /> Tables Verified (Enable Anonymous Auth)
                        </span>
                      ) : (
                        <span className="connection-state is-connected">
                          <i /> Connected & RLS Active
                        </span>
                      )
                    ) : supabaseStatus?.connectionState === 'tables_missing' ? (
                      <span className="connection-state is-warning">
                        <i /> Tables Missing (Run Migration)
                      </span>
                    ) : supabaseStatus?.connectionState === 'auth_error' ? (
                      <span className="connection-state is-disconnected">
                        <i /> Auth Failed (401)
                      </span>
                    ) : supabaseStatus?.connectionState === 'unreachable' ? (
                      <span className="connection-state is-disconnected">
                        <i /> Project Unreachable
                      </span>
                    ) : supabaseStatus?.connectionState === 'connecting' ? (
                      <span className="connection-state is-offline">
                        <i /> Testing Connection...
                      </span>
                    ) : (
                      <span className="connection-state is-offline">
                        <i /> Local Storage (Unconfigured)
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-neutral-400 mb-3 leading-relaxed">
                    {supabaseStatus?.statusMessage || (
                      supabaseStatus?.configured
                        ? `Connected to Supabase PostgreSQL at ${supabaseStatus.url}. All creates, updates, and deletes persist with Row Level Security (RLS).`
                        : 'Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) in your local .env to enable PostgreSQL persistence with user isolation and RLS.'
                    )}
                  </p>

                  {/* Schema Missing Guidance Banner */}
                  {supabaseStatus?.connectionState === 'tables_missing' && (
                    <div className="mb-3 p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-200">
                      <div className="font-semibold mb-1 flex items-center gap-1.5">
                        <AlertCircle size={14} /> Database Tables Missing
                      </div>
                      <p className="leading-relaxed text-amber-300/90 mb-2">
                        To enable cloud storage, execute the idempotent PostgreSQL schema in your Supabase project.
                      </p>
                      <div className="bg-neutral-950/80 px-2.5 py-1.5 rounded font-mono text-[11px] text-neutral-300 border border-amber-900/40 select-all">
                        supabase/migrations/20261024000000_nova_schema.sql
                      </div>
                    </div>
                  )}

                  {/* Supabase User Identity & Session Manager */}
                  {supabaseStatus?.configured && (
                    <div className="mb-3 p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 text-xs">
                      {supabaseStatus.userId ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-neutral-400">Active User Session: </span>
                            <strong className="text-neutral-200">
                              {supabaseStatus.userEmail || (supabaseStatus.authStatus === 'anonymous' ? 'Anonymous Session' : 'Authenticated User')}
                            </strong>
                            <span className="text-neutral-500 font-mono ml-1.5 text-[10px]">
                              ({supabaseStatus.userId.slice(0, 8)}...)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleSignOut}
                            disabled={isAuthenticating}
                            className="subtle-pill text-neutral-400 hover:text-rose-300"
                            title="Sign out active session"
                          >
                            <LogOut size={12} /> Sign out
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-1.5 font-medium text-amber-300 mb-1.5">
                            <AlertCircle size={14} />
                            {supabaseStatus.authStatus === 'anonymous_disabled'
                              ? 'Supabase Anonymous Sign-ins Disabled'
                              : 'Authentication Required'}
                          </div>
                          <p className="text-neutral-400 mb-2.5 leading-relaxed">
                            {supabaseStatus.authStatus === 'anonymous_disabled'
                              ? 'Your Supabase project has anonymous sign-ins disabled by default. Enable it in your Supabase Dashboard (Authentication → Providers → Anonymous) or sign in with an email account below:'
                              : 'Sign in with your email account or enable anonymous sign-in to persist records under your own isolated user ID:'}
                          </p>
                          <form onSubmit={handleAuthSubmit} className="space-y-2">
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="email"
                                value={authEmail}
                                onChange={(e) => setAuthEmail(e.target.value)}
                                placeholder="name@example.com"
                                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-violet-500"
                                required
                              />
                              <input
                                type="password"
                                value={authPassword}
                                onChange={(e) => setAuthPassword(e.target.value)}
                                placeholder="Password"
                                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-violet-500"
                                required
                              />
                            </div>
                            <div className="flex items-center justify-between pt-0.5">
                              <button
                                type="button"
                                onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                                className="text-xs text-violet-400 hover:text-violet-300 underline underline-offset-2"
                              >
                                {authMode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
                              </button>
                              <button
                                type="submit"
                                disabled={isAuthenticating}
                                className="subtle-pill text-xs"
                              >
                                {isAuthenticating
                                  ? 'Authenticating...'
                                  : authMode === 'signin'
                                    ? 'Sign in with Email'
                                    : 'Create Account'}
                              </button>
                            </div>
                          </form>
                          {authFeedback && (
                            <div
                              className={`mt-2 p-2 rounded-lg text-xs ${
                                authFeedback.type === 'success'
                                  ? 'bg-emerald-950/50 text-emerald-200'
                                  : 'bg-rose-950/50 text-rose-200'
                              }`}
                            >
                              {authFeedback.message}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="settings-data-actions">
                    <button
                      type="button"
                      className="subtle-pill"
                      disabled={isTestingConnection}
                      onClick={handleTestConnection}
                      title="Test live connection to your Supabase project"
                    >
                      <RefreshCw size={14} className={isTestingConnection ? 'animate-spin' : ''} />
                      {isTestingConnection ? 'Testing Connection...' : 'Test Connection'}
                    </button>
                    <button
                      type="button"
                      className="subtle-pill"
                      disabled={
                        isMigrating ||
                        !supabaseStatus?.configured ||
                        supabaseStatus?.connectionState === 'tables_missing' ||
                        supabaseStatus?.connectionState === 'auth_error' ||
                        supabaseStatus?.connectionState === 'unreachable' ||
                        supabaseStatus?.authStatus === 'anonymous_disabled'
                      }
                      onClick={handleRunMigration}
                      title={
                        !supabaseStatus?.configured
                          ? 'Configure Supabase environment variables first'
                          : supabaseStatus?.connectionState === 'tables_missing'
                            ? 'Run SQL migration in Supabase SQL editor first'
                            : supabaseStatus?.authStatus === 'anonymous_disabled'
                              ? 'Enable Anonymous Sign-ins in Supabase or sign in with email first'
                              : 'Run safe idempotent migration'
                      }
                    >
                      <RefreshCw size={14} className={isMigrating ? 'animate-spin' : ''} />
                      {isMigrating ? 'Migrating data...' : 'Migrate Local Storage to Supabase'}
                    </button>
                  </div>

                  {testFeedback && (
                    <div
                      className={`mt-3 p-3 rounded-xl text-xs border ${
                        testFeedback.type === 'success'
                          ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-200'
                          : testFeedback.type === 'warning'
                            ? 'bg-amber-950/40 border-amber-800/40 text-amber-200'
                            : 'bg-rose-950/40 border-rose-800/40 text-rose-200'
                      }`}
                    >
                      {testFeedback.message}
                    </div>
                  )}

                  {migrationFeedback && (
                    <div
                      className={`mt-3 p-3 rounded-xl text-xs border ${
                        migrationFeedback.type === 'success'
                          ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-200'
                          : 'bg-rose-950/40 border-rose-800/40 text-rose-200'
                      }`}
                    >
                      {migrationFeedback.message}
                    </div>
                  )}
                </div>

                <div className="settings-data-actions">
                  <button type="button" className="subtle-pill" onClick={handleExportBackup}>
                    <Download size={14} /> Export backup (.json)
                  </button>
                  <button type="button" className="subtle-pill" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={14} /> Restore backup (.json)
                  </button>
                  <button
                    type="button"
                    className="settings-clear-button"
                    onClick={() => setConfirmClearAll(true)}
                  >
                    <Trash2 size={14} /> Clear all local data
                  </button>
                </div>
                {restoreNotification && (
                  <div className="mt-3 p-3 rounded-xl bg-violet-950/40 border border-violet-800/40 text-xs text-violet-200">
                    {restoreNotification}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Category I: Billing & Plans */}
          {activeCategory === 'billing' && (
            <div className="settings-panel-sections">
              <section className="settings-section">
                <div className="settings-section-title">
                  <CreditCard size={16} />
                  <h2>Billing & Subscriptions</h2>
                </div>

                <div className="settings-status-row">
                  <div>
                    <strong>Current Tier</strong>
                    <p>Self-contained local edition running on your device.</p>
                  </div>
                  <span className="settings-badge-pill is-primary">Local Free Edition</span>
                </div>

                <div className="settings-status-row">
                  <div>
                    <strong>Local Usage Limits</strong>
                    <p>Stored locally within your device browser quota. Unlimited tasks, notes, and local chats.</p>
                  </div>
                  <span className="settings-badge-pill">Unlimited Local Storage</span>
                </div>

                {/* Honest Unconfigured State */}
                <div className="settings-empty-state-box">
                  <div className="empty-state-icon">
                    <CreditCard size={24} />
                  </div>
                  <h3>Billing is not configured yet</h3>
                  <p>
                    NOVA is currently running as a local client-side application. No payment provider,
                    subscription billing gateway, or invoicing service is attached to this environment.
                  </p>
                  <div className="planned-features-list">
                    <strong>Planned for future Cloud tiers:</strong>
                    <ul>
                      <li>Encrypted cross-device cloud sync</li>
                      <li>Collaborative multi-user workspaces</li>
                      <li>Hosted AI model inference endpoints</li>
                    </ul>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Category J: Keyboard Shortcuts */}
          {activeCategory === 'shortcuts' && (
            <div className="settings-panel-sections">
              <section className="settings-section">
                <div className="settings-section-title">
                  <Keyboard size={16} />
                  <h2>Keyboard Reference</h2>
                </div>
                <div className="shortcut-list">
                  <div>
                    <span>Send message in chat composer</span>
                    <kbd>Enter</kbd>
                  </div>
                  <div>
                    <span>Add a new line in chat composer</span>
                    <kbd>Shift + Enter</kbd>
                  </div>
                  <div>
                    <span>Start a new conversation</span>
                    <kbd>⌘K / Ctrl+K</kbd>
                  </div>
                  <div>
                    <span>Dismiss voice overlay or close drawer</span>
                    <kbd>Esc</kbd>
                  </div>
                  <div>
                    <span>Navigate interactive controls and buttons</span>
                    <kbd>Tab / Shift+Tab</kbd>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Category K: Log Out / Sign Out */}
          {activeCategory === 'signout' && (
            <div className="settings-panel-sections">
              <section className="settings-section is-danger-section">
                <div className="settings-section-title text-rose-300">
                  <LogOut size={16} />
                  <h2>Session Management & Reset</h2>
                </div>

                <div className="privacy-copy">
                  <p>
                    NOVA does not require a remote account and operates locally in this browser profile.
                    To exit or hand off this device cleanly, choose between resetting your active session or
                    erasing all saved personal data.
                  </p>
                </div>

                <div className="settings-status-row">
                  <div>
                    <strong>Sign Out to Login Screen</strong>
                    <p>Sign out of your active account and return to the NOVA login and authentication screen.</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleSignOut()
                    }}
                    className="subtle-pill text-neutral-300 hover:text-white"
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>

                <div className="settings-status-row">
                  <div>
                    <strong>Reset Active Session</strong>
                    <p>Clears the current conversation draft, closes active voice sessions, and starts a fresh chat.</p>
                  </div>
                  {onResetSession && (
                    <button
                      type="button"
                      onClick={() => setConfirmResetSession(true)}
                      className="subtle-pill"
                    >
                      <RefreshCw size={14} /> Reset session
                    </button>
                  )}
                </div>

                <div className="settings-status-row">
                  <div>
                    <strong>Clear All Browser Data</strong>
                    <p>Permanently deletes all tasks, chats, memories, knowledge documents, and workspaces.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="settings-clear-button"
                  >
                    <Trash2 size={14} /> Clear all local data
                  </button>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* Confirmation Modals */}
      <ConfirmDialog
        open={confirmClearAll}
        title="Clear all NOVA data in this browser?"
        description="This will permanently delete saved chats, tasks, memories, knowledge notes, workspaces, and focus session records from this browser profile. This action cannot be undone."
        confirmLabel="Clear all data"
        onCancel={() => setConfirmClearAll(false)}
        onConfirm={() => {
          onClearData()
          setConfirmClearAll(false)
        }}
      />

      <ConfirmDialog
        open={confirmClearChats}
        title="Clear conversation history?"
        description="This will delete all saved chat sessions and messages. Your tasks, notes, workspaces, and preferences will be preserved."
        confirmLabel="Clear conversations"
        onCancel={() => setConfirmClearChats(false)}
        onConfirm={() => {
          if (onClearChats) onClearChats()
          setConfirmClearChats(false)
        }}
      />

      <ConfirmDialog
        open={confirmResetSession}
        title="Reset current session?"
        description="This will reset your current conversation draft and start a fresh chat session."
        confirmLabel="Reset session"
        onCancel={() => setConfirmResetSession(false)}
        onConfirm={() => {
          if (onResetSession) onResetSession()
          setConfirmResetSession(false)
        }}
      />
    </div>
  )
}
