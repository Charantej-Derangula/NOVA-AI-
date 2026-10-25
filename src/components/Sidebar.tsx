import React, { useEffect, useRef, useState } from 'react'
import {
  Home,
  Plus,
  Sun,
  CheckSquare,
  Bookmark,
  Settings,
  X,
  LayoutDashboard,
  BookOpen,
  BriefcaseBusiness,
  MoreHorizontal,
  Pin,
  PinOff,
  Pencil,
  Archive,
  Trash2,
  Check,
} from 'lucide-react'
import { NovaLogo } from './NovaLogo'
import type { NavigationTab, ChatSession } from '../types'
import { formatRelativeTime, getSessionTimestamp } from '../utils/dateTime'

interface SidebarProps {
  isOpen: boolean
  isCollapsed: boolean
  onClose: () => void
  activeTab: NavigationTab
  onSelectTab: (tab: NavigationTab) => void
  onNewChat: () => void
  sessions: ChatSession[]
  currentSessionId: string
  onSelectSession: (sessionId: string) => void
  onRenameSession?: (id: string, newTitle: string) => void
  onTogglePinSession?: (id: string) => void
  onToggleArchiveSession?: (id: string) => void
  onDeleteSession?: (id: string) => void
  pendingTasksCount: number
  memoryItemsCount: number
  activeWorkspaceName?: string
  currentUserEmail?: string
  onOpenLogin?: () => void
  userName?: string
  displayName?: string
  isHomeLanding?: boolean
}

type NavEntry = {
  id: NavigationTab
  label: string
  icon: React.ComponentType<{ size?: number }>
}

const mainNavItems: NavEntry[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'my-day', label: 'My Day', icon: Sun },
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
]

const libraryNavItems: NavEntry[] = [
  { id: 'memory', label: 'Memory', icon: Bookmark },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
  { id: 'workspaces', label: 'Workspaces', icon: BriefcaseBusiness },
]

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  isCollapsed,
  onClose,
  activeTab,
  onSelectTab,
  onNewChat,
  sessions,
  currentSessionId,
  onSelectSession,
  onRenameSession,
  onTogglePinSession,
  onToggleArchiveSession,
  onDeleteSession,
  pendingTasksCount,
  memoryItemsCount,
  activeWorkspaceName,
  currentUserEmail,
  onOpenLogin,
  userName,
  displayName,
}) => {
  const asideRef = useRef<HTMLElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Context menu state
  const [activeMenuSessionId, setActiveMenuSessionId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)

  // Inline rename state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  // Delete confirmation modal state
  const [deleteSessionTarget, setDeleteSessionTarget] = useState<ChatSession | null>(null)

  const badge = (id: NavigationTab) => (id === 'tasks' ? pendingTasksCount : id === 'memory' ? memoryItemsCount : 0)

  // Filter and organize sessions
  const activeSessions = sessions.filter((s) => !s.isArchived)
  const archivedSessions = sessions.filter((s) => s.isArchived)
  const pinnedSessions = activeSessions.filter((s) => s.isPinned)
  const unpinnedSessions = activeSessions.filter((s) => !s.isPinned)

  // Close context menu on outside click or Esc
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.recent-chat-context-menu')) return
      setActiveMenuSessionId(null)
      setMenuPosition(null)
    }

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenuSessionId(null)
        setMenuPosition(null)
        setEditingSessionId(null)
        setDeleteSessionTarget(null)
      }
    }

    if (activeMenuSessionId || editingSessionId || deleteSessionTarget) {
      document.addEventListener('click', handleGlobalClick)
      document.addEventListener('keydown', handleGlobalKeyDown)
      return () => {
        document.removeEventListener('click', handleGlobalClick)
        document.removeEventListener('keydown', handleGlobalKeyDown)
      }
    }
  }, [activeMenuSessionId, editingSessionId, deleteSessionTarget])

  // Focus rename input on editing start
  useEffect(() => {
    if (editingSessionId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [editingSessionId])

  const handleOpenMenu = (e: React.MouseEvent<HTMLButtonElement>, sessionId: string) => {
    e.stopPropagation()
    e.preventDefault()

    if (activeMenuSessionId === sessionId) {
      setActiveMenuSessionId(null)
      setMenuPosition(null)
      return
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const menuWidth = 175
    let left = rect.right + 6
    // If overflowing right viewport, position inward
    if (left + menuWidth > window.innerWidth) {
      left = Math.max(12, rect.right - menuWidth)
    }

    const menuHeight = 165
    let top = rect.top - 4
    if (top + menuHeight > window.innerHeight) {
      top = Math.max(10, window.innerHeight - menuHeight - 12)
    }

    setMenuPosition({ top, left })
    setActiveMenuSessionId(sessionId)
  }

  const handleStartRename = (session: ChatSession) => {
    setActiveMenuSessionId(null)
    setMenuPosition(null)
    setEditingSessionId(session.id)
    setEditTitle(session.title)
  }

  const handleSaveRename = (sessionId: string) => {
    const trimmed = editTitle.trim()
    if (trimmed) {
      onRenameSession?.(sessionId, trimmed)
    }
    setEditingSessionId(null)
    setEditTitle('')
  }

  const handleItemClick = (id: NavigationTab) => {
    onSelectTab(id)
    onClose()
  }

  const isItemActive = (id: NavigationTab) => {
    return activeTab === id
  }

  const profileDisplayName =
    displayName ||
    userName ||
    (currentUserEmail ? currentUserEmail.split('@')[0] : 'User')
  const profileInitial = profileDisplayName.charAt(0).toUpperCase() || 'U'
  const profileWorkspace = activeWorkspaceName ?? 'Personal Workspace'

  const activeMenuSession = sessions.find((s) => s.id === activeMenuSessionId)

  useEffect(() => {
    if (!isOpen) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButtonRef.current?.focus()
    const keepFocusInDrawer = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const focusable = asideRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', keepFocusInDrawer)
    return () => {
      window.removeEventListener('keydown', keepFocusInDrawer)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (navRef.current) navRef.current.scrollTop = 0
  }, [activeTab])

  const renderSessionItem = (session: ChatSession) => {
    const isSelected = activeTab === 'chat' && currentSessionId === session.id
    const isMenuOpen = activeMenuSessionId === session.id
    const isEditing = editingSessionId === session.id

    return (
      <div
        key={session.id}
        className={`recent-chat-row ${isSelected ? 'selected' : ''} ${isMenuOpen ? 'menu-active' : ''}`}
      >
        {isEditing ? (
          <form
            className="recent-chat-rename-form"
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleSaveRename(session.id)
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={renameInputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="recent-chat-rename-input"
              aria-label="Rename conversation"
            />
            <button
              type="submit"
              className="recent-chat-rename-btn text-emerald-400"
              title="Save title"
              aria-label="Save title"
            >
              <Check size={13} />
            </button>
            <button
              type="button"
              className="recent-chat-rename-btn text-neutral-400"
              onClick={(e) => {
                e.stopPropagation()
                setEditingSessionId(null)
              }}
              title="Cancel"
              aria-label="Cancel"
            >
              <X size={13} />
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              title={isCollapsed ? session.title : undefined}
              className="recent-chat-select-btn"
              onClick={() => {
                onSelectSession(session.id)
                onClose()
              }}
            >
              <span className="recent-chat-text">{session.title}</span>
              <small>{formatRelativeTime(getSessionTimestamp(session))}</small>
            </button>

            {/* Pinned Indicator Icon */}
            {session.isPinned && (
              <span className="recent-chat-pin-badge" title="Pinned conversation" aria-label="Pinned">
                <Pin size={12} className="text-violet-400" />
              </span>
            )}

            {/* Three-dot context menu trigger */}
            {!isCollapsed && (
              <button
                type="button"
                className={`recent-chat-menu-trigger ${isMenuOpen ? 'open' : ''}`}
                onClick={(e) => handleOpenMenu(e, session.id)}
                aria-label={`Options for ${session.title}`}
                title="Conversation options"
              >
                <MoreHorizontal size={14} />
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <button
        className={`nav-backdrop ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
        tabIndex={-1}
      />
      <aside
        ref={asideRef}
        id="main-navigation"
        className={`nova-sidebar ${isOpen ? 'sidebar-open' : ''} ${isCollapsed ? 'sidebar-collapsed' : ''}`}
        aria-label="Main navigation"
      >
        <div
          className="brand-lockup"
          data-tooltip="NOVA · Personal AI"
          tabIndex={isCollapsed ? 0 : undefined}
          role={isCollapsed ? 'img' : undefined}
          aria-label={isCollapsed ? 'NOVA · Personal AI' : undefined}
        >
          <div className="brand-logo-container">
            <NovaLogo
              size={isCollapsed ? 38 : 28}
              className="brand-logo"
              markClassName="brand-logo-mark"
            />
          </div>
          <div className="brand-text">
            <strong>NOVA</strong>
            <span>Personal AI</span>
          </div>
          <button ref={closeButtonRef} className="sidebar-close" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <button
          className="new-chat-button"
          onClick={() => {
            onNewChat()
            onSelectTab('chat')
            onClose()
          }}
          title={isCollapsed ? 'New conversation' : undefined}
          aria-label="New conversation"
        >
          <Plus size={16} />
          <span>New conversation</span>
          <kbd>⌘K</kbd>
        </button>

        <nav ref={navRef} className="sidebar-nav">
          <div className="nav-section">
            <span className="nav-label">MAIN</span>
            {mainNavItems.map((item) => {
              const Icon = item.icon
              const active = isItemActive(item.id)
              return (
                <button
                  key={item.id}
                  title={isCollapsed ? item.label : undefined}
                  className={`nav-item ${active ? 'active' : ''}`}
                  onClick={() => handleItemClick(item.id)}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                  {badge(item.id) > 0 && (
                    <b className="nav-badge" aria-label={`${badge(item.id)} ${item.label.toLowerCase()}`}>
                      {badge(item.id)}
                    </b>
                  )}
                </button>
              )
            })}
          </div>

          <div className="nav-section">
            <span className="nav-label">LIBRARY</span>
            {libraryNavItems.map((item) => {
              const Icon = item.icon
              const active = isItemActive(item.id)
              return (
                <button
                  key={item.id}
                  title={isCollapsed ? item.label : undefined}
                  className={`nav-item ${active ? 'active' : ''}`}
                  onClick={() => handleItemClick(item.id)}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                  {badge(item.id) > 0 && (
                    <b className="nav-badge" aria-label={`${badge(item.id)} ${item.label.toLowerCase()}`}>
                      {badge(item.id)}
                    </b>
                  )}
                </button>
              )
            })}
          </div>

          {/* Recent Chats Section with Pinned & Three-Dot Context Menu */}
          <div className="nav-section recent-section">
            <div className="recent-title">
              <span className="nav-label">RECENT CHATS</span>
            </div>

            {/* Pinned Conversations */}
            {pinnedSessions.map((session) => renderSessionItem(session))}

            {/* Unpinned Recent Conversations */}
            {unpinnedSessions.slice(0, 15).map((session) => renderSessionItem(session))}

            {/* Archived Chats Access Link */}
            {archivedSessions.length > 0 && (
              <button
                type="button"
                className="archived-chats-nav-btn"
                onClick={() => {
                  onSelectTab('history')
                  onClose()
                }}
                title="View archived conversations"
              >
                <Archive size={13} className="text-neutral-400" />
                <span>Archived ({archivedSessions.length})</span>
              </button>
            )}
          </div>
        </nav>

        {/* Repositioned Settings link without any Upgrade promotion card */}
        <button
          className={`nav-item settings-link ${activeTab === 'settings' ? 'active' : ''}`}
          title={isCollapsed ? 'Settings' : undefined}
          aria-label="Settings"
          aria-current={activeTab === 'settings' ? 'page' : undefined}
          onClick={() => {
            onSelectTab('settings')
            onClose()
          }}
        >
          <Settings size={17} />
          <span>Settings</span>
        </button>

        <div
          className="profile-card"
          onClick={(e) => {
            e.stopPropagation()
            if (onOpenLogin) {
              onOpenLogin()
            } else {
              onSelectTab('settings')
            }
            onClose()
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              if (onOpenLogin) {
                onOpenLogin()
              } else {
                onSelectTab('settings')
              }
              onClose()
            }
          }}
          style={{ cursor: 'pointer' }}
          title={currentUserEmail ? `Signed in as ${currentUserEmail} · Open settings` : 'Open settings'}
        >
          <span className="profile-avatar">{profileInitial}</span>
          <div>
            <strong>{profileDisplayName}</strong>
            <small title={profileWorkspace}>{profileWorkspace}</small>
          </div>
          <span className="profile-status" />
        </div>
      </aside>

      {/* Floating Context Menu anchored to the three-dot button */}
      {activeMenuSessionId && menuPosition && activeMenuSession && (
        <div
          className="recent-chat-context-menu"
          style={{
            position: 'fixed',
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            zIndex: 9999,
          }}
          role="menu"
          aria-label="Conversation actions"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Rename */}
          <button
            type="button"
            role="menuitem"
            className="recent-menu-item"
            onClick={() => handleStartRename(activeMenuSession)}
          >
            <Pencil size={14} className="recent-menu-icon" />
            <span>Rename</span>
          </button>

          {/* Pin / Unpin */}
          <button
            type="button"
            role="menuitem"
            className="recent-menu-item"
            onClick={() => {
              onTogglePinSession?.(activeMenuSession.id)
              setActiveMenuSessionId(null)
              setMenuPosition(null)
            }}
          >
            {activeMenuSession.isPinned ? (
              <>
                <PinOff size={14} className="recent-menu-icon" />
                <span>Unpin</span>
              </>
            ) : (
              <>
                <Pin size={14} className="recent-menu-icon" />
                <span>Pin</span>
              </>
            )}
          </button>

          {/* Archive */}
          <button
            type="button"
            role="menuitem"
            className="recent-menu-item"
            onClick={() => {
              onToggleArchiveSession?.(activeMenuSession.id)
              setActiveMenuSessionId(null)
              setMenuPosition(null)
            }}
          >
            <Archive size={14} className="recent-menu-icon" />
            <span>Archive</span>
          </button>

          <div className="recent-menu-divider" />

          {/* Delete */}
          <button
            type="button"
            role="menuitem"
            className="recent-menu-item recent-menu-item--delete"
            onClick={() => {
              setActiveMenuSessionId(null)
              setMenuPosition(null)
              setDeleteSessionTarget(activeMenuSession)
            }}
          >
            <Trash2 size={14} className="recent-menu-icon" />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal Dialog */}
      {deleteSessionTarget && (
        <div
          className="modal-backdrop-nova"
          onClick={() => setDeleteSessionTarget(null)}
          role="presentation"
        >
          <div
            className="delete-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="delete-dialog-header">
              <h3 id="delete-dialog-title">Delete conversation?</h3>
              <button
                type="button"
                className="delete-dialog-close"
                onClick={() => setDeleteSessionTarget(null)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <p className="delete-dialog-desc">
              This will delete <strong>{deleteSessionTarget.title}</strong> and all of its messages. This action cannot be undone.
            </p>
            <div className="delete-dialog-actions">
              <button
                type="button"
                className="delete-dialog-btn delete-dialog-btn--cancel"
                onClick={() => setDeleteSessionTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="delete-dialog-btn delete-dialog-btn--confirm"
                onClick={() => {
                  onDeleteSession?.(deleteSessionTarget.id)
                  setDeleteSessionTarget(null)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
