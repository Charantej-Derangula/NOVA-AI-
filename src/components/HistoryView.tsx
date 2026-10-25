import React, { useState, useEffect } from 'react'
import {
  History,
  Search,
  MessageSquare,
  ArrowRight,
  Plus,
  Trash2,
  Archive,
  RotateCcw,
} from 'lucide-react'
import type { ChatSession } from '../types'
import { formatRelativeTime, getSessionTimestamp } from '../utils/dateTime'

interface HistoryViewProps {
  sessions: ChatSession[]
  currentSessionId: string
  onSelectSession: (id: string) => void
  onNewChat: () => void
  onDeleteSession: (id: string) => void
  onToggleArchiveSession?: (id: string) => void
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onToggleArchiveSession,
}) => {
  const [search, setSearch] = useState('')
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'archived'>('all')
  const [, setTick] = useState(0)

  // Periodically refresh relative timestamps without page reload
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => prev + 1)
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  const archivedCount = sessions.filter((s) => s.isArchived).length
  const activeCount = sessions.filter((s) => !s.isArchived).length

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch = s.title.toLowerCase().includes(search.toLowerCase())
    if (activeTabFilter === 'archived') {
      return matchesSearch && s.isArchived
    }
    return matchesSearch
  })

  return (
    <div className="history-page flex-1 overflow-y-auto px-4 sm:px-8 py-8 select-text">
      <div className="history-content max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-white/[0.04]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] font-sans font-medium tracking-[0.08em] text-neutral-400 uppercase">
              <History size={12} className="text-violet-400" />
              <span>Archive</span>
            </div>
            <h1 className="text-2xl sm:text-[26px] font-semibold text-neutral-100 tracking-tight leading-tight">
              Conversation Chronicle
            </h1>
          </div>

          <button
            type="button"
            onClick={onNewChat}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] hover:border-violet-500/30 text-xs font-medium text-neutral-200 transition-all cursor-pointer"
          >
            <Plus size={13} className="text-violet-400" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search through past conversations..."
              className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-xs sm:text-sm text-neutral-200 placeholder-neutral-400 focus:outline-none focus:border-violet-500/40 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] shrink-0">
            <button
              type="button"
              onClick={() => setActiveTabFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTabFilter === 'all'
                  ? 'bg-violet-600/30 text-violet-200 border border-violet-500/30'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              All ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTabFilter('archived')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTabFilter === 'archived'
                  ? 'bg-violet-600/30 text-violet-200 border border-violet-500/30'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Archive size={12} />
              <span>Archived ({archivedCount})</span>
            </button>
          </div>
        </div>

        {/* List of Sessions */}
        <div className="divide-y divide-white/[0.04] rounded-2xl bg-white/[0.015] border border-white/[0.05] overflow-hidden">
          {filteredSessions.length === 0 ? (
            <div className="p-12 text-center text-xs font-mono text-neutral-400">
              {activeTabFilter === 'archived' ? 'No archived conversations found.' : 'No conversations found.'}
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isCurrent = session.id === currentSessionId

              return (
                <div
                  key={session.id}
                  className={`group p-4 flex items-center justify-between gap-4 transition-colors ${
                    isCurrent ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectSession(session.id)}
                    className="flex-1 text-left flex items-start gap-3.5 min-w-0 cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-white/[0.03] text-neutral-400 mt-0.5 shrink-0">
                      <MessageSquare size={15} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xs sm:text-sm font-medium text-neutral-100 truncate">
                          {session.title}
                        </h2>
                        {session.isPinned && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            Pinned
                          </span>
                        )}
                        {session.isArchived && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-500/10 text-neutral-300 border border-neutral-500/20">
                            Archived
                          </span>
                        )}
                        {isCurrent && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-neutral-400 mt-0.5 flex items-center gap-2">
                        <span>{formatRelativeTime(getSessionTimestamp(session))}</span>
                        <span>•</span>
                        <span>{session.messages.length} messages</span>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Restore / Archive toggle */}
                    {session.isArchived ? (
                      <button
                        type="button"
                        onClick={() => onToggleArchiveSession?.(session.id)}
                        className="p-1.5 text-neutral-400 hover:text-emerald-400 rounded cursor-pointer"
                        title="Restore conversation to recent chats"
                      >
                        <RotateCcw size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onToggleArchiveSession?.(session.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-neutral-400 hover:text-violet-300 rounded cursor-pointer transition-opacity"
                        title="Archive conversation"
                      >
                        <Archive size={14} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onSelectSession(session.id)}
                      className="p-1.5 text-neutral-400 hover:text-white rounded cursor-pointer"
                      title="Open conversation"
                    >
                      <ArrowRight size={14} />
                    </button>

                    {sessions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteSession(session.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-neutral-400 hover:text-rose-400 rounded transition-opacity cursor-pointer"
                        title="Delete conversation"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
