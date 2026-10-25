import React from 'react'
import {
  BriefcaseBusiness,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Home,
  MessageSquare,
  History,
  Sun,
  CheckSquare,
  Bookmark,
  BookOpen,
  LayoutDashboard,
  Settings as SettingsIcon,
} from 'lucide-react'
import type { NavigationTab } from '../types'

interface HeaderProps {
  activeTab: NavigationTab
  onOpenSidebar: () => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
  sidebarCollapsed: boolean
  onNewChat: () => void
  storageAvailable: boolean
  activeWorkspaceName?: string
  userEmail?: string
  displayName?: string
  onOpenSettings?: () => void
  onSignOut?: () => void
  onOpenLogin?: () => void
  isHomeLanding?: boolean
  onGlobalSearch?: (query: string) => void
}

const labels: Record<NavigationTab, string> = {
  home: 'Home',
  dashboard: 'Overview',
  chat: 'Chat',
  history: 'Chat history',
  'my-day': 'My Day',
  tasks: 'Tasks',
  memory: 'Memory',
  knowledge: 'Knowledge',
  workspaces: 'Workspaces',
  settings: 'Settings',
}

const tabIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  home: Home,
  dashboard: LayoutDashboard,
  chat: MessageSquare,
  history: History,
  'my-day': Sun,
  tasks: CheckSquare,
  memory: Bookmark,
  knowledge: BookOpen,
  workspaces: BriefcaseBusiness,
  settings: SettingsIcon,
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenSidebar,
  sidebarOpen,
  onToggleSidebar,
  sidebarCollapsed,
  onNewChat,
  storageAvailable,
  activeWorkspaceName,
  isHomeLanding = false,
}) => {
  const isHome = activeTab === 'home' || (activeTab === 'chat' && isHomeLanding)
  const currentLabel = isHome ? 'Home' : labels[activeTab] || 'Home'
  const CurrentIcon = (isHome ? tabIcons.home : tabIcons[activeTab]) || Home

  return (
    <div className="topbar-container flex flex-col w-full relative z-20">
      <header className="topbar">
        <div className="topbar-left flex items-center min-w-0 gap-2 sm:gap-3">
          <button
            className="desktop-sidebar-toggle hidden sm:grid"
            onClick={onToggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
            aria-controls="main-navigation"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button
            className="mobile-menu-button sm:hidden shrink-0"
            onClick={onOpenSidebar}
            aria-label="Open navigation"
            aria-expanded={sidebarOpen}
            aria-controls="main-navigation"
          >
            <Menu size={19} />
          </button>

          {/* Desktop Breadcrumbs: NOVA / <Icon> {currentLabel} */}
          <div className="hidden sm:flex items-center gap-2 min-w-0">
            {!isHome && (
              <>
                <span className="breadcrumb-root">NOVA</span>
                <span className="breadcrumb-sep">/</span>
              </>
            )}
            <div className="topbar-current-page flex items-center gap-2">
              <CurrentIcon size={16} className="text-violet-400 shrink-0" aria-hidden="true" />
              <h2>{currentLabel}</h2>
            </div>
          </div>

          {/* Mobile Clean Breadcrumb: NOVA / {currentLabel} */}
          <div className="flex sm:hidden items-center gap-1.5 min-w-0">
            <span className="mobile-brand font-semibold text-xs text-white/90 tracking-wider shrink-0">NOVA</span>
            {!isHome && (
              <>
                <span className="text-neutral-500 text-xs shrink-0">/</span>
                <span className="mobile-current-title truncate text-xs font-medium text-neutral-300 max-w-[140px]">
                  {currentLabel}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="topbar-actions flex items-center gap-1.5 sm:gap-2 shrink-0">
          {activeWorkspaceName && (
            <span className="topbar-workspace-context hidden sm:inline-flex" title={activeWorkspaceName}>
              <BriefcaseBusiness size={13} />
              <span>{activeWorkspaceName}</span>
            </span>
          )}

          {!isHome && (
            <div
              className={`engine-indicator hidden md:flex ${storageAvailable ? 'storage-saved' : 'storage-failed'}`}
              role="status"
            >
              <i />
              {storageAvailable ? 'Saved locally' : 'Changes not saved'}
            </div>
          )}

          {/* New chat action */}
          <button className="topbar-new-chat shrink-0" onClick={onNewChat} aria-label="New chat" title="New chat">
            <Plus size={15} />
            <span>New chat</span>
          </button>
        </div>
      </header>
    </div>
  )
}
