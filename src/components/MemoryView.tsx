import React, { useState, useMemo, useEffect } from 'react'
import {
  Bookmark,
  Plus,
  Search,
  X,
  Trash2,
  Edit3,
  Layers,
  ShieldCheck,
  User,
  FolderKanban,
  Clock,
  RotateCcw,
} from 'lucide-react'
import type { MemoryItem, WorkspaceItem } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import { formatRelativeTime } from '../utils/dateTime'

interface MemoryViewProps {
  memories: MemoryItem[]
  workspaces: WorkspaceItem[]
  currentWorkspaceId: string | null
  onAddMemory: (category: string, content: string, workspaceId?: string) => void
  onDeleteMemory: (id: string) => void
  onUpdateMemory: (id: string, updates: Partial<MemoryItem>) => void
  storageAvailable: boolean
}

const CATEGORIES = ['Preference', 'Work Context', 'Project', 'Communication'] as const

export const MemoryView: React.FC<MemoryViewProps> = ({
  memories,
  workspaces,
  currentWorkspaceId,
  onAddMemory,
  onDeleteMemory,
  onUpdateMemory,
  storageAvailable,
}) => {
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<string>(CATEGORIES[0])
  const [formWorkspaceId, setFormWorkspaceId] = useState<string>(currentWorkspaceId ?? '')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingMemory, setEditingMemory] = useState<MemoryItem | null>(null)
  const [deletingMemory, setDeletingMemory] = useState<MemoryItem | null>(null)
  const [formError, setFormError] = useState('')

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [selectedScope, setSelectedScope] = useState<string>('all')

  // Auto-refresh relative timestamps periodically
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(timer)
  }, [])

  // Filter memories by scope
  const scopedMemories = useMemo(() => {
    return memories.filter((memory) => {
      if (selectedScope === 'all') return true
      if (selectedScope === 'personal') return !memory.workspaceId
      return memory.workspaceId === selectedScope
    })
  }, [memories, selectedScope])

  // Filter by category and search
  const filteredMemories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return scopedMemories.filter((memory) => {
      const matchesCategory = selectedCategory === 'All' || memory.category === selectedCategory
      if (!matchesCategory) return false

      if (!query) return true
      const workspaceName = memory.workspaceId
        ? workspaces.find((w) => w.id === memory.workspaceId)?.name ?? ''
        : 'Personal'
      const searchable = `${memory.category} ${memory.content} ${workspaceName}`.toLowerCase()
      return searchable.includes(query)
    })
  }, [scopedMemories, selectedCategory, searchQuery, workspaces])

  // Category counts within current scope
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: scopedMemories.length }
    for (const cat of CATEGORIES) {
      counts[cat] = scopedMemories.filter((m) => m.category === cat).length
    }
    return counts
  }, [scopedMemories])

  const openAddForm = () => {
    setEditingMemory(null)
    setContent('')
    setCategory(CATEGORIES[0])
    setFormWorkspaceId(selectedScope === 'all' ? currentWorkspaceId ?? '' : selectedScope === 'personal' ? '' : selectedScope)
    setFormError('')
    setIsFormOpen(true)
  }

  const openEditForm = (memory: MemoryItem) => {
    setEditingMemory(memory)
    setContent(memory.content)
    setCategory(memory.category)
    setFormWorkspaceId(memory.workspaceId ?? '')
    setFormError('')
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingMemory(null)
    setContent('')
    setFormError('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) {
      setFormError('Please enter a detail before saving.')
      return
    }

    if (editingMemory) {
      onUpdateMemory(editingMemory.id, {
        category,
        content: trimmed,
        workspaceId: formWorkspaceId || undefined,
      })
    } else {
      onAddMemory(category, trimmed, formWorkspaceId || undefined)
    }

    closeForm()
  }

  return (
    <div className="page-scroll memory-page">
      <div className="page-content memory-content max-w-4xl">
        {/* Page Header */}
        <header className="memory-heading">
          <div>
            <p className="eyebrow">
              <Bookmark size={13} className="text-violet-400" />
              <span>
                {selectedScope === 'all'
                  ? 'CONTEXT & PREFERENCES'
                  : selectedScope === 'personal'
                  ? 'PERSONAL CONTEXT'
                  : `${workspaces.find((w) => w.id === selectedScope)?.name ?? 'WORKSPACE'} CONTEXT`}
              </span>
            </p>
            <h1>Memory</h1>
            <p className="intro-copy">
              Short facts, preferences, and guidelines NOVA keeps in mind across conversations.
            </p>
          </div>
          <button
            className="primary-pill"
            type="button"
            onClick={isFormOpen ? closeForm : openAddForm}
            aria-expanded={isFormOpen}
          >
            {isFormOpen ? (
              <>
                <X size={15} /> Close editor
              </>
            ) : (
              <>
                <Plus size={15} /> Add a memory
              </>
            )}
          </button>
        </header>

        {/* Inline Memory Form (Add / Edit) */}
        {isFormOpen && (
          <form
            className="memory-add-form memory-editor"
            noValidate
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeForm()
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit(e)
            }}
          >
            <div className="memory-editor-heading">
              <div>
                <p className="eyebrow">{editingMemory ? 'EDIT MEMORY' : 'NEW MEMORY'}</p>
                <strong>{editingMemory ? 'Update saved detail' : 'Add a context guideline'}</strong>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={closeForm}
                aria-label="Close memory editor"
              >
                <X size={15} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              <label className="flex flex-col gap-1.5 text-xs text-[#a7a0ac]">
                <span>Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-[#121118] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#eee7f2] focus:border-violet-500 focus:outline-none"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-xs text-[#a7a0ac]">
                <span>Scope</span>
                <select
                  value={formWorkspaceId}
                  onChange={(e) => setFormWorkspaceId(e.target.value)}
                  className="bg-[#121118] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#eee7f2] focus:border-violet-500 focus:outline-none"
                >
                  <option value="">Personal context (all chats)</option>
                  {workspaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.name} (workspace)
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="memory-input-label flex flex-col gap-1.5 w-full text-xs text-[#a7a0ac]">
              <span>What should NOVA keep in mind?</span>
              <textarea
                autoFocus
                rows={3}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value)
                  if (formError) setFormError('')
                }}
                placeholder="e.g. Always generate code snippets in TypeScript with strict typing..."
                className="bg-[#121118] border border-white/10 rounded-lg p-3 text-sm text-[#eee7f2] placeholder:text-[#6f6978] resize-none focus:border-violet-500 focus:outline-none"
                aria-invalid={Boolean(formError)}
                aria-describedby={formError ? 'memory-form-error' : undefined}
              />
            </label>

            {formError && (
              <p className="form-error text-xs text-rose-400" id="memory-form-error" role="alert">
                {formError}
              </p>
            )}

            <div className="memory-editor-actions flex items-center justify-between w-full pt-1">
              <span className="text-[11px] text-[#7d7585]">
                Press <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px]">Esc</kbd> to cancel,{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px]">⌘ Enter</kbd> to save
              </span>
              <div className="flex items-center gap-2">
                <button type="button" className="subtle-pill text-xs px-3.5 py-1.5" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="primary-pill text-xs px-4 py-1.5">
                  {editingMemory ? 'Save changes' : 'Save memory'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Category & Workspace Filter Toolbar */}
        <section className="memory-filter-toolbar my-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 rounded-xl bg-white/[0.02] border border-white/5">
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none" role="tablist" aria-label="Filter by category">
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === 'All'}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                selectedCategory === 'All'
                  ? 'bg-violet-600/30 text-violet-200 border border-violet-500/40 shadow-sm'
                  : 'text-[#9e96a7] hover:text-[#eee7f2] hover:bg-white/[0.04]'
              }`}
              onClick={() => setSelectedCategory('All')}
            >
              <span>All</span>
              <span className="text-[10px] opacity-70">({categoryCounts.All || 0})</span>
            </button>
            {CATEGORIES.map((cat) => {
              const count = categoryCounts[cat] || 0
              const isSelected = selectedCategory === cat
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-violet-600/30 text-violet-200 border border-violet-500/40 shadow-sm'
                      : 'text-[#9e96a7] hover:text-[#eee7f2] hover:bg-white/[0.04]'
                  }`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  <span>{cat}</span>
                  <span className="text-[10px] opacity-70">({count})</span>
                </button>
              )
            })}
          </div>

          {/* Right Tools: Scope Selector & Search */}
          <div className="flex items-center gap-2">
            <label className="scope-select flex items-center gap-1.5 bg-[#121118] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-[#b8b0c2]">
              <Layers size={13} className="text-violet-400" />
              <select
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value)}
                className="bg-transparent border-0 text-xs text-[#eee7f2] focus:outline-none cursor-pointer"
                aria-label="Filter memories by workspace"
              >
                <option value="all">All scopes</option>
                <option value="personal">Personal only</option>
                {workspaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="memory-search flex items-center gap-2 bg-[#121118] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-[#b8b0c2] w-48 sm:w-56">
              <Search size={13} className="text-[#888190]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search memories..."
                className="bg-transparent border-0 text-xs text-[#eee7f2] placeholder:text-[#6f6978] focus:outline-none flex-1 min-w-0"
                aria-label="Search memories"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear text-[#888190] hover:text-[#eee7f2]"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </label>
          </div>
        </section>

        {/* Memory Items List */}
        <div className="memory-list flex flex-col gap-2.5 my-4">
          {filteredMemories.map((item) => {
            const workspace = item.workspaceId
              ? workspaces.find((w) => w.id === item.workspaceId)
              : null

            return (
              <article
                key={item.id}
                className="memory-card group p-4 rounded-xl bg-[#111018] border border-white/[0.07] hover:border-violet-500/30 transition-all duration-150 flex flex-col gap-2.5"
              >
                {/* Meta header */}
                <div className="flex items-center justify-between text-xs text-[#8f8899]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-300 border border-violet-500/20 text-[11px] font-medium">
                      {item.category}
                    </span>

                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] text-[#b4adc0] text-[11px]">
                      {workspace ? (
                        <>
                          <FolderKanban size={11} className="text-violet-400" />
                          <span>{workspace.name}</span>
                        </>
                      ) : (
                        <>
                          <User size={11} className="text-[#a49db0]" />
                          <span>Personal</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-[#7a7482]">
                    <Clock size={11} />
                    <span>{formatRelativeTime(item.dateAdded)}</span>
                  </div>
                </div>

                {/* Content body */}
                <p className="text-[13.5px] leading-relaxed text-[#ded8e5] whitespace-pre-wrap">
                  {item.content}
                </p>

                {/* Actions footer */}
                <div className="flex items-center justify-between pt-1 border-t border-white/[0.04] text-xs">
                  <span className="flex items-center gap-1.5 text-[11px] text-[#736c7c]">
                    <ShieldCheck size={12} className="text-emerald-400/80" />
                    <span>{storageAvailable ? 'Saved in local & cloud context' : 'Storage unavailable'}</span>
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditForm(item)}
                      className="px-2 py-1 rounded text-xs text-[#a69fb0] hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-1"
                      aria-label={`Edit memory: ${item.content.slice(0, 30)}`}
                    >
                      <Edit3 size={12} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingMemory(item)}
                      className="px-2 py-1 rounded text-xs text-[#8e8796] hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-1"
                      aria-label={`Delete memory: ${item.content.slice(0, 30)}`}
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </article>
            )
          })}

          {/* Empty state */}
          {filteredMemories.length === 0 && (
            <div className="library-empty py-12 px-6 rounded-2xl bg-white/[0.015] border border-white/5 text-center flex flex-col items-center justify-center gap-3">
              <span className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 flex items-center justify-center">
                <Bookmark size={20} />
              </span>
              <div className="max-w-md">
                <strong className="text-sm font-semibold text-[#eee7f2] block">
                  {scopedMemories.length > 0
                    ? 'No memories match your filters'
                    : selectedScope === 'personal'
                    ? 'No personal memories saved yet'
                    : selectedScope === 'all'
                    ? 'Your memory bank is empty'
                    : 'This workspace has no saved memories yet'}
                </strong>
                <p className="text-xs text-[#8f8899] mt-1 leading-normal">
                  {scopedMemories.length > 0
                    ? 'Try clearing the search query or switching to another category.'
                    : 'Capture concise preferences, project conventions, and personal context that NOVA should always keep in mind.'}
                </p>
              </div>
              {scopedMemories.length > 0 ? (
                <button
                  type="button"
                  className="subtle-pill text-xs mt-2"
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedCategory('All')
                  }}
                >
                  <RotateCcw size={12} /> Clear filters
                </button>
              ) : (
                <button type="button" className="primary-pill text-xs mt-2" onClick={openAddForm}>
                  <Plus size={13} /> Add first memory
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Note */}
        <p className="memory-storage-note text-[11px] text-[#746e7c] text-center my-6 flex items-center justify-center gap-1.5">
          <ShieldCheck size={13} className="text-violet-400" />
          <span>
            {storageAvailable
              ? 'Memories are kept private and loaded into relevant chat sessions.'
              : 'Browser storage is currently unavailable.'}
          </span>
        </p>

        {/* Centered Confirm Deletion Dialog */}
        <ConfirmDialog
          open={Boolean(deletingMemory)}
          title="Delete this memory?"
          description={
            deletingMemory
              ? `"${deletingMemory.content.slice(0, 80)}${
                  deletingMemory.content.length > 80 ? '...' : ''
                }" will be removed from your context.`
              : ''
          }
          confirmLabel="Delete memory"
          onCancel={() => setDeletingMemory(null)}
          onConfirm={() => {
            if (deletingMemory) {
              onDeleteMemory(deletingMemory.id)
              setDeletingMemory(null)
            }
          }}
        />
      </div>
    </div>
  )
}
