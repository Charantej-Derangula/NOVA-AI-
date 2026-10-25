import React, { useState, useMemo, useEffect } from 'react'
import {
  BookOpen,
  FileText,
  Plus,
  Search,
  X,
  Trash2,
  Edit3,
  Layers,
  FolderKanban,
  User,
  Clock,
  ArrowUpRight,
  RotateCcw,
  Tag,
  ShieldCheck,
} from 'lucide-react'
import type { KnowledgeItem, WorkspaceItem } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import { formatRelativeTime } from '../utils/dateTime'

interface KnowledgeViewProps {
  entries: KnowledgeItem[]
  workspaces: WorkspaceItem[]
  activeWorkspaceId: string | null
  onAdd: (entry: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>) => void
  onUpdate: (id: string, updates: Partial<KnowledgeItem>) => void
  onDelete: (id: string) => void
  storageAvailable: boolean
}

type NoteKind = KnowledgeItem['kind']
const NOTE_KINDS: NoteKind[] = ['Project notes', 'Reference', 'Personal note']

export const KnowledgeView: React.FC<KnowledgeViewProps> = ({
  entries,
  workspaces,
  activeWorkspaceId,
  onAdd,
  onUpdate,
  onDelete,
  storageAvailable,
}) => {
  const [query, setQuery] = useState('')
  const [filterKind, setFilterKind] = useState<'All' | NoteKind>('All')
  const [scope, setScope] = useState<string>('all')

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<KnowledgeItem | null>(null)
  const [previewItem, setPreviewItem] = useState<KnowledgeItem | null>(null)

  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<NoteKind>('Personal note')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [formWorkspaceId, setFormWorkspaceId] = useState(activeWorkspaceId ?? '')
  const [formError, setFormError] = useState('')

  // Periodic timer for relative timestamps
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(timer)
  }, [])

  // Filter entries by scope
  const scopedEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (scope === 'all') return true
      if (scope === 'personal') return !entry.workspaceId
      return entry.workspaceId === scope
    })
  }, [entries, scope])

  // Filter entries by kind and search
  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase()
    return scopedEntries
      .filter((entry) => {
        const matchesKind = filterKind === 'All' || entry.kind === filterKind
        if (!matchesKind) return false

        if (!q) return true
        const tagString = entry.tags.join(' ').toLowerCase()
        const workspaceName = entry.workspaceId
          ? workspaces.find((w) => w.id === entry.workspaceId)?.name.toLowerCase() ?? ''
          : 'personal'
        const searchable = `${entry.title} ${entry.content} ${tagString} ${workspaceName}`.toLowerCase()
        return searchable.includes(q)
      })
      .sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt).getTime()
        const timeB = new Date(b.updatedAt || b.createdAt).getTime()
        return timeB - timeA
      })
  }, [scopedEntries, filterKind, query, workspaces])

  // Kind counts within scope
  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = { All: scopedEntries.length }
    for (const k of NOTE_KINDS) {
      counts[k] = scopedEntries.filter((e) => e.kind === k).length
    }
    return counts
  }, [scopedEntries])

  const resetForm = () => {
    setIsFormOpen(false)
    setEditingItem(null)
    setTitle('')
    setContent('')
    setTags('')
    setKind('Personal note')
    setFormWorkspaceId(scope === 'all' ? activeWorkspaceId ?? '' : scope === 'personal' ? '' : scope)
    setFormError('')
  }

  const openAddForm = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const openEditForm = (item: KnowledgeItem) => {
    setEditingItem(item)
    setTitle(item.title)
    setKind(item.kind)
    setContent(item.content)
    setTags(item.tags.join(', '))
    setFormWorkspaceId(item.workspaceId ?? '')
    setFormError('')
    setIsFormOpen(true)
    setPreviewItem(null)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanTitle = title.trim()
    const cleanContent = content.trim()

    if (!cleanTitle || !cleanContent) {
      setFormError(
        !cleanTitle && !cleanContent
          ? 'Please enter both a title and note content.'
          : !cleanTitle
          ? 'Please enter a title for this note.'
          : 'Please enter note content before saving.'
      )
      return
    }

    const cleanTags = [...new Set(tags.split(',').map((t) => t.trim()).filter(Boolean))]
    const updates = {
      title: cleanTitle,
      kind,
      content: cleanContent,
      tags: cleanTags,
      workspaceId: formWorkspaceId || undefined,
      updatedAt: new Date().toISOString(),
    }

    if (editingItem) {
      onUpdate(editingItem.id, updates)
    } else {
      onAdd(updates)
    }

    resetForm()
  }

  return (
    <div className="page-scroll library-page">
      <div className="page-content library-content max-w-5xl">
        {/* Header */}
        <header className="library-heading">
          <div>
            <p className="eyebrow">
              <BookOpen size={13} className="text-violet-400" />
              <span>
                {scope === 'all'
                  ? 'REFERENCE & KNOWLEDGE BASE'
                  : scope === 'personal'
                  ? 'PERSONAL LIBRARY'
                  : `${workspaces.find((w) => w.id === scope)?.name ?? 'WORKSPACE'} LIBRARY`}
              </span>
            </p>
            <h1>Knowledge</h1>
            <p className="intro-copy">
              Long-form notes, research, architectural decisions, and references you want to keep.
            </p>
          </div>
          <button
            className="primary-pill"
            type="button"
            onClick={isFormOpen ? resetForm : openAddForm}
            aria-expanded={isFormOpen}
          >
            {isFormOpen ? (
              <>
                <X size={15} /> Close editor
              </>
            ) : (
              <>
                <Plus size={15} /> Add a note
              </>
            )}
          </button>
        </header>

        {/* Note Editor Form */}
        {isFormOpen && (
          <form
            className="knowledge-add-form knowledge-editor my-4 p-4 rounded-xl bg-[#111018] border border-violet-500/30 flex flex-col gap-3"
            noValidate
            onSubmit={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Escape') resetForm()
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave(e)
            }}
          >
            <div className="knowledge-editor-heading flex items-center justify-between pb-2 border-b border-white/5">
              <div>
                <p className="eyebrow">{editingItem ? 'EDIT NOTE' : 'NEW NOTE'}</p>
                <strong className="text-sm font-semibold text-[#eee7f2]">
                  {editingItem ? 'Update reference note' : 'Capture reference material'}
                </strong>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={resetForm}
                aria-label="Close note editor"
              >
                <X size={15} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 text-xs text-[#a7a0ac] sm:col-span-2">
                <span>Title</span>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    if (formError) setFormError('')
                  }}
                  placeholder="e.g. Authentication Flow & Token Lifecycle"
                  className="bg-[#14121b] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#eee7f2] focus:border-violet-500 focus:outline-none"
                  aria-invalid={Boolean(formError) && !title.trim()}
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-[#a7a0ac]">
                <span>Type</span>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as NoteKind)}
                  className="bg-[#14121b] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#eee7f2] focus:border-violet-500 focus:outline-none"
                >
                  {NOTE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-[#a7a0ac]">
                <span>Save to workspace</span>
                <select
                  value={formWorkspaceId}
                  onChange={(e) => setFormWorkspaceId(e.target.value)}
                  className="bg-[#14121b] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#eee7f2] focus:border-violet-500 focus:outline-none"
                >
                  <option value="">Personal library (unscoped)</option>
                  {workspaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.name} (workspace)
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs text-[#a7a0ac]">
                <span>Tags <small className="text-[#7d7585]">(comma-separated)</small></span>
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Design, API, Supabase..."
                  className="bg-[#14121b] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#eee7f2] focus:border-violet-500 focus:outline-none"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-xs text-[#a7a0ac]">
              <span>Note Content</span>
              <textarea
                rows={6}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value)
                  if (formError) setFormError('')
                }}
                placeholder="Write your reference, documentation, key takeaways, or architectural decisions..."
                className="bg-[#14121b] border border-white/10 rounded-lg p-3 text-sm text-[#eee7f2] placeholder:text-[#6f6978] resize-y font-mono leading-relaxed focus:border-violet-500 focus:outline-none"
                aria-invalid={Boolean(formError) && !content.trim()}
              />
            </label>

            {formError && (
              <p className="form-error text-xs text-rose-400" id="knowledge-form-error" role="alert">
                {formError}
              </p>
            )}

            <div className="knowledge-editor-actions flex items-center justify-between pt-1">
              <span className="text-[11px] text-[#7d7585]">
                Press <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px]">Esc</kbd> to cancel,{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px]">⌘ Enter</kbd> to save
              </span>
              <div className="flex items-center gap-2">
                <button type="button" className="subtle-pill text-xs px-3.5 py-1.5" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="primary-pill text-xs px-4 py-1.5">
                  {editingItem ? 'Save changes' : 'Save note'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Filter and Search Toolbar */}
        <section className="library-tools my-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 rounded-xl bg-white/[0.02] border border-white/5">
          {/* Note Type Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none" role="tablist" aria-label="Filter notes by type">
            <button
              type="button"
              role="tab"
              aria-selected={filterKind === 'All'}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                filterKind === 'All'
                  ? 'bg-violet-600/30 text-violet-200 border border-violet-500/40 shadow-sm'
                  : 'text-[#9e96a7] hover:text-[#eee7f2] hover:bg-white/[0.04]'
              }`}
              onClick={() => setFilterKind('All')}
            >
              <span>All notes</span>
              <span className="text-[10px] opacity-70">({kindCounts.All || 0})</span>
            </button>
            {NOTE_KINDS.map((k) => {
              const count = kindCounts[k] || 0
              const isSelected = filterKind === k
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-violet-600/30 text-violet-200 border border-violet-500/40 shadow-sm'
                      : 'text-[#9e96a7] hover:text-[#eee7f2] hover:bg-white/[0.04]'
                  }`}
                  onClick={() => setFilterKind(k)}
                >
                  <span>{k}</span>
                  <span className="text-[10px] opacity-70">({count})</span>
                </button>
              )
            })}
          </div>

          {/* Right Tools: Scope & Search */}
          <div className="flex items-center gap-2">
            <label className="scope-select flex items-center gap-1.5 bg-[#121118] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-[#b8b0c2]">
              <Layers size={13} className="text-violet-400" />
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="bg-transparent border-0 text-xs text-[#eee7f2] focus:outline-none cursor-pointer"
                aria-label="Filter notes by workspace"
              >
                <option value="all">All spaces</option>
                <option value="personal">Personal notes</option>
                {workspaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="search-field flex items-center gap-2 bg-[#121118] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-[#b8b0c2] w-48 sm:w-56">
              <Search size={13} className="text-[#888190]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes or tags..."
                className="bg-transparent border-0 text-xs text-[#eee7f2] placeholder:text-[#6f6978] focus:outline-none flex-1 min-w-0"
                aria-label="Search notes"
              />
              {query && (
                <button
                  type="button"
                  className="search-clear text-[#888190] hover:text-[#eee7f2]"
                  onClick={() => setQuery('')}
                  aria-label="Clear note search"
                >
                  <X size={13} />
                </button>
              )}
            </label>
          </div>
        </section>

        {/* Note Cards Grid */}
        <div className="knowledge-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 my-4 w-full">
          {filteredEntries.map((entry) => {
            const workspace = entry.workspaceId
              ? workspaces.find((w) => w.id === entry.workspaceId)
              : null

            return (
              <article
                key={entry.id}
                onClick={() => setPreviewItem(entry)}
                className="knowledge-card group cursor-pointer p-4 rounded-xl bg-[#111018] border border-white/[0.07] hover:border-violet-500/40 hover:bg-[#13111c] transition-all duration-150 flex flex-col justify-between gap-3.5 min-w-0 w-full"
              >
                <div className="flex flex-col gap-2.5 min-w-0 w-full">
                  {/* Meta row */}
                  <div className="flex items-center justify-between text-xs text-[#8f8899] gap-2 min-w-0 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className="px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-300 border border-violet-500/20 text-[11px] font-medium shrink-0">
                        {entry.kind}
                      </span>

                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] text-[#b4adc0] text-[11px] shrink-0">
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

                    <div className="flex items-center gap-1 text-[11px] text-[#7a7482] shrink-0 ml-auto">
                      <Clock size={11} />
                      <span>{formatRelativeTime(entry.updatedAt || entry.createdAt)}</span>
                    </div>
                  </div>

                  {/* Title & Preview */}
                  <h3 className="text-sm font-semibold text-[#eee7f2] group-hover:text-violet-200 transition-colors flex items-start justify-between gap-2 min-w-0">
                    <span className="break-words min-w-0 flex-1 leading-snug">{entry.title}</span>
                    <ArrowUpRight
                      size={15}
                      className="text-[#7d7585] group-hover:text-violet-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0 mt-0.5"
                    />
                  </h3>

                  <p className="text-xs leading-relaxed text-[#b4adb9] line-clamp-3 whitespace-pre-wrap break-words min-w-0">
                    {entry.content}
                  </p>
                </div>

                {/* Tags and Action Bar */}
                <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.05] text-xs gap-2 min-w-0 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                    {entry.tags.length > 0 ? (
                      entry.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 rounded bg-white/[0.03] text-[#938b9c] text-[10px] truncate max-w-[120px]"
                        >
                          #{tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-[#696372]">No tags</span>
                    )}
                    {entry.tags.length > 3 && (
                      <span className="text-[10px] text-[#7a7384]">+{entry.tags.length - 3}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-auto" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => openEditForm(entry)}
                      className="px-2.5 py-1 rounded-md text-xs text-[#a69fb0] hover:text-white hover:bg-white/[0.06] border border-transparent hover:border-white/10 transition-colors flex items-center gap-1"
                      aria-label={`Edit note: ${entry.title}`}
                    >
                      <Edit3 size={12} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingItem(entry)}
                      className="px-2 py-1 rounded-md text-xs text-[#8e8796] hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors flex items-center gap-1"
                      aria-label={`Delete note: ${entry.title}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        {/* Empty State */}
        {filteredEntries.length === 0 && (
          <div className="library-empty py-12 px-6 rounded-2xl bg-white/[0.015] border border-white/5 text-center flex flex-col items-center justify-center gap-3 my-4">
            <span className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 flex items-center justify-center">
              <FileText size={20} />
            </span>
            <div className="max-w-md">
              <strong className="text-sm font-semibold text-[#eee7f2] block">
                {scopedEntries.length > 0
                  ? 'No notes match your current filters'
                  : scope === 'personal'
                  ? 'Your personal reference library is empty'
                  : scope === 'all'
                  ? 'Your knowledge library is empty'
                  : 'This workspace has no notes yet'}
              </strong>
              <p className="text-xs text-[#8f8899] mt-1 leading-normal">
                {scopedEntries.length > 0
                  ? 'Try clearing the search query or selecting another note type.'
                  : 'Capture architectural decisions, project documentation, research notes, and guidelines to reference later.'}
              </p>
            </div>
            {scopedEntries.length > 0 ? (
              <button
                type="button"
                className="subtle-pill text-xs mt-2"
                onClick={() => {
                  setQuery('')
                  setFilterKind('All')
                }}
              >
                <RotateCcw size={12} /> Clear filters
              </button>
            ) : (
              <button type="button" className="primary-pill text-xs mt-2" onClick={openAddForm}>
                <Plus size={13} /> Write first note
              </button>
            )}
          </div>
        )}

        {/* Storage status footer */}
        <p className="knowledge-storage-note text-[11px] text-[#746e7c] text-center my-6 flex items-center justify-center gap-1.5">
          <ShieldCheck size={13} className="text-violet-400" />
          <span>
            {storageAvailable
              ? 'Notes are stored safely and indexed for quick retrieval in your workspace.'
              : 'Browser storage is currently unavailable.'}
          </span>
        </p>

        {/* Note Reader Modal */}
        {previewItem && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            onClick={() => setPreviewItem(null)}
          >
            <div
              className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-[#111018] border border-white/10 p-6 shadow-2xl flex flex-col gap-4 text-left relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-300 border border-violet-500/20 text-xs font-medium">
                      {previewItem.kind}
                    </span>
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] text-[#b4adc0] text-xs">
                      {previewItem.workspaceId ? (
                        <>
                          <FolderKanban size={11} className="text-violet-400" />
                          <span>
                            {workspaces.find((w) => w.id === previewItem.workspaceId)?.name ?? 'Workspace'}
                          </span>
                        </>
                      ) : (
                        <>
                          <User size={11} className="text-[#a49db0]" />
                          <span>Personal Note</span>
                        </>
                      )}
                    </span>
                    <span className="text-xs text-[#7a7482] flex items-center gap-1">
                      <Clock size={11} />
                      <span>{formatRelativeTime(previewItem.updatedAt || previewItem.createdAt)}</span>
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-[#eee7f2] mt-1">{previewItem.title}</h2>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setPreviewItem(null)}
                  aria-label="Close note preview"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Tags */}
              {previewItem.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {previewItem.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded bg-white/[0.04] text-xs text-[#a69fb0] flex items-center gap-1"
                    >
                      <Tag size={10} className="text-violet-400" />
                      <span>{tag}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Note body */}
              <div className="p-4 rounded-xl bg-black/30 border border-white/5 font-mono text-sm leading-relaxed text-[#ded8e5] whitespace-pre-wrap max-h-96 overflow-y-auto">
                {previewItem.content}
              </div>

              {/* Actions footer */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-1.5"
                  onClick={() => {
                    const toDelete = previewItem
                    setPreviewItem(null)
                    setDeletingItem(toDelete)
                  }}
                >
                  <Trash2 size={13} />
                  <span>Delete note</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="subtle-pill text-xs px-3.5 py-1.5"
                    onClick={() => setPreviewItem(null)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="primary-pill text-xs px-4 py-1.5"
                    onClick={() => openEditForm(previewItem)}
                  >
                    <Edit3 size={13} /> Edit note
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Centered Confirm Delete Modal */}
        <ConfirmDialog
          open={Boolean(deletingItem)}
          title="Delete this note?"
          description={
            deletingItem
              ? `“${deletingItem.title}” will be permanently removed from your knowledge library.`
              : ''
          }
          confirmLabel="Delete note"
          onCancel={() => setDeletingItem(null)}
          onConfirm={() => {
            if (deletingItem) {
              onDelete(deletingItem.id)
              setDeletingItem(null)
            }
          }}
        />
      </div>
    </div>
  )
}
