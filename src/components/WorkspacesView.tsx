import React, { useState, useEffect } from 'react'
import {
  Briefcase,
  Code2,
  PenLine,
  Sparkles,
  Plus,
  X,
  Trash2,
  Edit3,
  CheckSquare,
  BookOpen,
  MessageCircle,
  Bookmark,
  ArrowLeft,
  ArrowUpRight,
  Check,
  Layers,
  ShieldCheck,
} from 'lucide-react'
import type {
  ChatSession,
  KnowledgeItem,
  MemoryItem,
  NavigationTab,
  TaskItem,
  WorkspaceItem,
} from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import { formatRelativeTime } from '../utils/dateTime'

interface WorkspacesViewProps {
  spaces: WorkspaceItem[]
  activeId: string | null
  tasks: TaskItem[]
  memories: MemoryItem[]
  knowledge: KnowledgeItem[]
  sessions: ChatSession[]
  onSelect: (id: string | null) => void
  onAdd: (draft: Pick<WorkspaceItem, 'name' | 'description' | 'kind'>) => Promise<string> | string
  onUpdate: (id: string, updates: Partial<WorkspaceItem>) => Promise<void> | void
  onDelete: (id: string) => Promise<void> | void
  onNavigate: (tab: NavigationTab) => void
  onOpenChat: (workspaceId: string) => void
  onSelectChat: (sessionId: string) => void
  storageAvailable: boolean
}

const KINDS: WorkspaceItem['kind'][] = ['Project', 'Personal', 'Research']
const KIND_ICONS = {
  Project: Code2,
  Personal: PenLine,
  Research: Sparkles,
}

export const WorkspacesView: React.FC<WorkspacesViewProps> = ({
  spaces,
  activeId,
  tasks,
  memories,
  knowledge,
  sessions,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
  onNavigate,
  onOpenChat,
  onSelectChat,
  storageAvailable,
}) => {
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState<WorkspaceItem | null>(null)
  const [deletingWorkspace, setDeletingWorkspace] = useState<WorkspaceItem | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<WorkspaceItem['kind']>('Project')
  const [formError, setFormError] = useState('')

  // Periodic refresh for timestamps
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(timer)
  }, [])

  const resetForm = () => {
    setIsFormOpen(false)
    setEditingWorkspace(null)
    setName('')
    setDescription('')
    setKind('Project')
    setFormError('')
  }

  const openNewForm = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const openEditForm = (space: WorkspaceItem) => {
    setEditingWorkspace(space)
    setName(space.name)
    setDescription(space.description || '')
    setKind(space.kind)
    setFormError('')
    setIsFormOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setFormError('Please enter a name for the workspace.')
      return
    }

    const payload = {
      name: trimmedName,
      description: description.trim(),
      kind,
    }

    if (editingWorkspace) {
      await onUpdate(editingWorkspace.id, payload)
    } else {
      const newId = await onAdd(payload)
      onSelect(newId)
      setViewingId(newId)
    }

    resetForm()
  }

  const activeSpace = spaces.find((s) => s.id === viewingId)

  // Render Workspace Detail Hub if viewing a specific workspace
  if (viewingId && activeSpace) {
    const Icon = KIND_ICONS[activeSpace.kind] || Briefcase
    const spaceTasks = tasks.filter((t) => t.workspaceId === activeSpace.id)
    const openTasks = spaceTasks.filter((t) => !t.completed)
    const completedTasks = spaceTasks.filter((t) => t.completed)
    const spaceNotes = knowledge.filter((k) => k.workspaceId === activeSpace.id)
    const spaceMemories = memories.filter((m) => m.workspaceId === activeSpace.id)
    const spaceChats = sessions.filter((s) => s.workspaceId === activeSpace.id)

    const isCurrent = activeId === activeSpace.id
    const unassignedCount =
      tasks.filter((t) => !t.workspaceId).length +
      knowledge.filter((k) => !k.workspaceId).length +
      memories.filter((m) => !m.workspaceId).length

    return (
      <div className="page-scroll library-page">
        <div className="page-content library-content workspace-detail-content max-w-5xl">
          {/* Back Link */}
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-[#9d95a8] hover:text-[#eee7f2] mb-4 transition-colors"
            onClick={() => {
              setViewingId(null)
              resetForm()
            }}
          >
            <ArrowLeft size={14} />
            <span>All workspaces</span>
          </button>

          {/* Hero Section */}
          <section className="p-6 rounded-2xl bg-[#111018] border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 flex items-center justify-center shrink-0">
                <Icon size={22} />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-white/[0.05] text-[#b4adc0] text-[11px] font-medium uppercase tracking-wider">
                    {activeSpace.kind} Workspace
                  </span>
                  {isCurrent ? (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Active space
                    </span>
                  ) : null}
                </div>
                <h1 className="text-xl font-semibold text-[#eee7f2] tracking-tight">
                  {activeSpace.name}
                </h1>
                <p className="text-xs text-[#a09aa9] max-w-xl leading-relaxed">
                  {activeSpace.description || 'A dedicated home for this project’s tasks, documentation, and context.'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 self-start md:self-center shrink-0 flex-wrap">
              {!isCurrent && (
                <button
                  type="button"
                  className="subtle-pill text-xs px-3.5 py-2"
                  onClick={() => onSelect(activeSpace.id)}
                >
                  <Check size={13} /> Set as active
                </button>
              )}
              <button
                type="button"
                className="subtle-pill text-xs px-3.5 py-2"
                onClick={() => openEditForm(activeSpace)}
              >
                <Edit3 size={13} /> Edit details
              </button>
              <button
                type="button"
                className="primary-pill text-xs px-4 py-2"
                onClick={() => onOpenChat(activeSpace.id)}
              >
                <MessageCircle size={14} /> Start chat
              </button>
            </div>
          </section>

          {/* Edit Form (if open) */}
          {isFormOpen && (
            <form
              className="p-5 rounded-xl bg-[#13111b] border border-violet-500/30 flex flex-col gap-3 mb-6"
              onSubmit={handleSave}
              onKeyDown={(e) => {
                if (e.key === 'Escape') resetForm()
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave(e)
              }}
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div>
                  <p className="eyebrow">EDIT WORKSPACE</p>
                  <strong className="text-sm font-semibold text-[#eee7f2]">
                    Update workspace details
                  </strong>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={resetForm}
                  aria-label="Close form"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex flex-col gap-1 text-xs text-[#a7a0ac] sm:col-span-2">
                  <span>Workspace Name</span>
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (formError) setFormError('')
                    }}
                    placeholder="e.g. Mobile App Redesign"
                    className="bg-[#121118] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#eee7f2] focus:border-violet-500 focus:outline-none"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs text-[#a7a0ac]">
                  <span>Type</span>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as WorkspaceItem['kind'])}
                    className="bg-[#121118] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#eee7f2] focus:border-violet-500 focus:outline-none"
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-1 text-xs text-[#a7a0ac]">
                <span>Description</span>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="The goals, boundaries, or context of this workspace..."
                  className="bg-[#121118] border border-white/10 rounded-lg p-3 text-sm text-[#eee7f2] placeholder:text-[#6f6978] resize-none focus:border-violet-500 focus:outline-none"
                />
              </label>

              {formError && (
                <p className="text-xs text-rose-400" role="alert">
                  {formError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" className="subtle-pill text-xs px-3.5 py-1.5" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="primary-pill text-xs px-4 py-1.5">
                  Save changes
                </button>
              </div>
            </form>
          )}

          {/* Real Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-1">
              <span className="text-xs text-[#9d95a8] flex items-center gap-1.5">
                <CheckSquare size={13} className="text-violet-400" /> Tasks
              </span>
              <strong className="text-xl font-semibold text-[#eee7f2]">{spaceTasks.length}</strong>
              <span className="text-[11px] text-[#787181]">
                {openTasks.length} open · {completedTasks.length} completed
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-1">
              <span className="text-xs text-[#9d95a8] flex items-center gap-1.5">
                <BookOpen size={13} className="text-violet-400" /> Knowledge
              </span>
              <strong className="text-xl font-semibold text-[#eee7f2]">{spaceNotes.length}</strong>
              <span className="text-[11px] text-[#787181]">Notes and references</span>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-1">
              <span className="text-xs text-[#9d95a8] flex items-center gap-1.5">
                <Bookmark size={13} className="text-violet-400" /> Memory
              </span>
              <strong className="text-xl font-semibold text-[#eee7f2]">{spaceMemories.length}</strong>
              <span className="text-[11px] text-[#787181]">Saved context facts</span>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-1">
              <span className="text-xs text-[#9d95a8] flex items-center gap-1.5">
                <MessageCircle size={13} className="text-violet-400" /> Chats
              </span>
              <strong className="text-xl font-semibold text-[#eee7f2]">{spaceChats.length}</strong>
              <span className="text-[11px] text-[#787181]">Workspace conversations</span>
            </div>
          </div>

          {/* Quadrants Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* 1. Tasks Quadrant */}
            <section className="p-4 rounded-xl bg-[#111018] border border-white/5 flex flex-col justify-between gap-3">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <CheckSquare size={16} className="text-violet-400" />
                    <h3 className="text-sm font-semibold text-[#eee7f2]">Project Tasks</h3>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-violet-300 hover:text-white flex items-center gap-1"
                    onClick={() => {
                      onSelect(activeSpace.id)
                      onNavigate('tasks')
                    }}
                  >
                    <span>Open all</span>
                    <ArrowUpRight size={13} />
                  </button>
                </div>

                {spaceTasks.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {spaceTasks.slice(0, 4).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-white/[0.02]"
                      >
                        <span
                          className={`truncate max-w-[240px] ${
                            task.completed ? 'line-through text-[#6f6878]' : 'text-[#ded8e5]'
                          }`}
                        >
                          {task.title}
                        </span>
                        <span className="text-[10px] text-[#8e8796] uppercase font-mono">
                          {task.completed ? 'Done' : task.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#7d7585] py-4 text-center">
                    No tasks linked to this workspace yet.
                  </p>
                )}
              </div>

              <button
                type="button"
                className="text-xs text-[#a49db0] hover:text-[#eee7f2] flex items-center gap-1.5 pt-2 border-t border-white/5"
                onClick={() => {
                  onSelect(activeSpace.id)
                  onNavigate('tasks')
                }}
              >
                <Plus size={13} /> Add a task in this space
              </button>
            </section>

            {/* 2. Knowledge Quadrant */}
            <section className="p-4 rounded-xl bg-[#111018] border border-white/5 flex flex-col justify-between gap-3">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-violet-400" />
                    <h3 className="text-sm font-semibold text-[#eee7f2]">Reference & Notes</h3>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-violet-300 hover:text-white flex items-center gap-1"
                    onClick={() => {
                      onSelect(activeSpace.id)
                      onNavigate('knowledge')
                    }}
                  >
                    <span>Open all</span>
                    <ArrowUpRight size={13} />
                  </button>
                </div>

                {spaceNotes.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {spaceNotes.slice(0, 3).map((note) => (
                      <div
                        key={note.id}
                        className="flex flex-col gap-0.5 py-1.5 px-2 rounded-lg bg-white/[0.02]"
                      >
                        <span className="text-xs font-medium text-[#ded8e5] truncate">
                          {note.title}
                        </span>
                        <span className="text-[11px] text-[#7d7585] line-clamp-1">
                          {note.content}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#7d7585] py-4 text-center">
                    No reference notes in this space yet.
                  </p>
                )}
              </div>

              <button
                type="button"
                className="text-xs text-[#a49db0] hover:text-[#eee7f2] flex items-center gap-1.5 pt-2 border-t border-white/5"
                onClick={() => {
                  onSelect(activeSpace.id)
                  onNavigate('knowledge')
                }}
              >
                <Plus size={13} /> Add a reference note
              </button>
            </section>

            {/* 3. Memory Quadrant */}
            <section className="p-4 rounded-xl bg-[#111018] border border-white/5 flex flex-col justify-between gap-3">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Bookmark size={16} className="text-violet-400" />
                    <h3 className="text-sm font-semibold text-[#eee7f2]">Saved Context</h3>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-violet-300 hover:text-white flex items-center gap-1"
                    onClick={() => {
                      onSelect(activeSpace.id)
                      onNavigate('memory')
                    }}
                  >
                    <span>Open all</span>
                    <ArrowUpRight size={13} />
                  </button>
                </div>

                {spaceMemories.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {spaceMemories.slice(0, 3).map((memory) => (
                      <div
                        key={memory.id}
                        className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded-lg bg-white/[0.02]"
                      >
                        <span className="text-[#ded8e5] truncate">{memory.content}</span>
                        <span className="text-[10px] text-violet-300 shrink-0">
                          {memory.category}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#7d7585] py-4 text-center">
                    No context memories saved for this space yet.
                  </p>
                )}
              </div>

              <button
                type="button"
                className="text-xs text-[#a49db0] hover:text-[#eee7f2] flex items-center gap-1.5 pt-2 border-t border-white/5"
                onClick={() => {
                  onSelect(activeSpace.id)
                  onNavigate('memory')
                }}
              >
                <Plus size={13} /> Add a memory
              </button>
            </section>

            {/* 4. Conversations Quadrant */}
            <section className="p-4 rounded-xl bg-[#111018] border border-white/5 flex flex-col justify-between gap-3">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <MessageCircle size={16} className="text-violet-400" />
                    <h3 className="text-sm font-semibold text-[#eee7f2]">Workspace Chats</h3>
                  </div>
                  <span className="text-xs text-[#7d7585]">{spaceChats.length} conversations</span>
                </div>

                {spaceChats.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {spaceChats.slice(0, 3).map((chat) => (
                      <button
                        key={chat.id}
                        type="button"
                        onClick={() => onSelectChat(chat.id)}
                        className="flex items-center justify-between text-left py-1.5 px-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors group"
                      >
                        <span className="text-xs text-[#ded8e5] group-hover:text-violet-200 truncate max-w-[220px]">
                          {chat.title}
                        </span>
                        <span className="text-[10px] text-[#7d7585]">
                          {formatRelativeTime(chat.updatedAt)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#7d7585] py-4 text-center">
                    No conversations in this space yet.
                  </p>
                )}
              </div>

              <button
                type="button"
                className="text-xs text-[#a49db0] hover:text-[#eee7f2] flex items-center gap-1.5 pt-2 border-t border-white/5"
                onClick={() => onOpenChat(activeSpace.id)}
              >
                <Plus size={13} /> Start a workspace chat
              </button>
            </section>
          </div>

          {/* Unassigned Note */}
          {unassignedCount > 0 && (
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3 text-xs text-[#9d95a8] mb-6">
              <Layers size={16} className="text-violet-400 shrink-0" />
              <p>
                <strong>{unassignedCount} personal item{unassignedCount === 1 ? '' : 's'}</strong> outside this space. They stay safely organized in your personal views.
              </p>
            </div>
          )}

          {/* Footer with Delete Option */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs text-[#736c7b]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-violet-400" />
              <span>{storageAvailable ? 'Saved in local & cloud storage' : 'Storage unavailable'}</span>
            </span>

            <button
              type="button"
              className="px-2.5 py-1 rounded text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-1"
              onClick={() => setDeletingWorkspace(activeSpace)}
            >
              <Trash2 size={13} />
              <span>Delete workspace</span>
            </button>
          </div>

          <ConfirmDialog
            open={Boolean(deletingWorkspace)}
            title="Delete this workspace?"
            description={
              deletingWorkspace
                ? `“${deletingWorkspace.name}” will be removed. Its tasks, notes, memories, and chats will be retained in your personal lists.`
                : ''
            }
            confirmLabel="Delete workspace"
            onCancel={() => setDeletingWorkspace(null)}
            onConfirm={() => {
              if (deletingWorkspace) {
                onDelete(deletingWorkspace.id)
                setViewingId(null)
                setDeletingWorkspace(null)
              }
            }}
          />
        </div>
      </div>
    )
  }

  // Workspaces Directory List View
  return (
    <div className="page-scroll library-page">
      <div className="page-content library-content max-w-5xl">
        {/* Header */}
        <header className="library-heading">
          <div>
            <p className="eyebrow">
              <Briefcase size={13} className="text-violet-400" />
              <span>PROJECT SPACES</span>
            </p>
            <h1>Workspaces</h1>
            <p className="intro-copy">
              Organize tasks, reference documentation, memories, and conversations by project.
            </p>
          </div>
          <button className="primary-pill" type="button" onClick={openNewForm}>
            <Plus size={15} /> New workspace
          </button>
        </header>

        {/* Create Workspace Inline Form */}
        {isFormOpen && (
          <form
            className="my-4 p-5 rounded-xl bg-[#111018] border border-violet-500/30 flex flex-col gap-3"
            onSubmit={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Escape') resetForm()
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave(e)
            }}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div>
                <p className="eyebrow">NEW WORKSPACE</p>
                <strong className="text-sm font-semibold text-[#eee7f2]">
                  Create a dedicated space
                </strong>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={resetForm}
                aria-label="Close form"
              >
                <X size={15} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 text-xs text-[#a7a0ac] sm:col-span-2">
                <span>Workspace Name</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (formError) setFormError('')
                  }}
                  placeholder="e.g. NextGen Web App"
                  className="bg-[#14121b] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#eee7f2] focus:border-violet-500 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-[#a7a0ac]">
                <span>Type</span>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as WorkspaceItem['kind'])}
                  className="bg-[#14121b] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#eee7f2] focus:border-violet-500 focus:outline-none"
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1 text-xs text-[#a7a0ac]">
              <span>Description</span>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A concise description of this workspace's purpose or deliverables..."
                className="bg-[#14121b] border border-white/10 rounded-lg p-3 text-sm text-[#eee7f2] placeholder:text-[#6f6978] resize-none focus:border-violet-500 focus:outline-none"
              />
            </label>

            {formError && (
              <p className="text-xs text-rose-400" role="alert">
                {formError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" className="subtle-pill text-xs px-3.5 py-1.5" onClick={resetForm}>
                Cancel
              </button>
              <button type="submit" className="primary-pill text-xs px-4 py-1.5">
                Create and open
              </button>
            </div>
          </form>
        )}

        {/* Workspaces Grid */}
        {spaces.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 my-4">
            {spaces.map((space) => {
              const Icon = KIND_ICONS[space.kind] || Briefcase
              const isSelected = activeId === space.id
              const taskCount = tasks.filter((t) => t.workspaceId === space.id).length
              const noteCount = knowledge.filter((k) => k.workspaceId === space.id).length
              const memoryCount = memories.filter((m) => m.workspaceId === space.id).length
              const chatCount = sessions.filter((s) => s.workspaceId === space.id).length

              return (
                <article
                  key={space.id}
                  className={`p-5 rounded-2xl bg-[#111018] border transition-all duration-150 flex flex-col justify-between gap-4 cursor-pointer group ${
                    isSelected
                      ? 'border-violet-500/50 bg-[#13111e] shadow-lg shadow-violet-950/20'
                      : 'border-white/[0.07] hover:border-violet-500/30 hover:bg-[#13111b]'
                  }`}
                  onClick={() => {
                    onSelect(space.id)
                    setViewingId(space.id)
                  }}
                >
                  <div className="flex flex-col gap-3">
                    {/* Top Row: Icon, Kind & Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 flex items-center justify-center">
                          <Icon size={17} />
                        </div>
                        <span className="text-[11px] font-medium text-[#9d95a8] uppercase tracking-wider">
                          {space.kind}
                        </span>
                      </div>

                      {isSelected ? (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Active
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelect(space.id)
                          }}
                          className="text-[11px] text-[#8c8596] hover:text-white px-2 py-0.5 rounded hover:bg-white/[0.06] transition-colors"
                        >
                          Make active
                        </button>
                      )}
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-base font-semibold text-[#eee7f2] group-hover:text-violet-200 transition-colors flex items-center justify-between">
                        <span>{space.name}</span>
                        <ArrowUpRight
                          size={15}
                          className="text-[#6d6676] group-hover:text-violet-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        />
                      </h3>
                      <p className="text-xs text-[#a09aa9] mt-1 line-clamp-2 leading-relaxed">
                        {space.description || 'A dedicated home for this project’s tasks, documentation, and context.'}
                      </p>
                    </div>
                  </div>

                  {/* Real Metrics & Actions */}
                  <div className="flex flex-col gap-2.5 pt-3 border-t border-white/[0.04]">
                    <div className="flex items-center gap-3 text-xs text-[#8c8596]">
                      <span>{taskCount} tasks</span>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span>{noteCount} notes</span>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span>{memoryCount} memories</span>
                    </div>

                    <div
                      className="flex items-center justify-between text-xs pt-1 text-[#787181]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>{chatCount} chat{chatCount === 1 ? '' : 's'}</span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditForm(space)}
                          className="px-2 py-1 rounded text-[#a69fb0] hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-1"
                        >
                          <Edit3 size={11} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingWorkspace(space)}
                          className="px-2 py-1 rounded text-[#8e8796] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          aria-label={`Delete workspace ${space.name}`}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="library-empty py-16 px-6 rounded-2xl bg-white/[0.015] border border-white/5 text-center flex flex-col items-center justify-center gap-3 my-6">
            <span className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 flex items-center justify-center">
              <Briefcase size={22} />
            </span>
            <div className="max-w-md">
              <strong className="text-sm font-semibold text-[#eee7f2] block">
                No project workspaces yet
              </strong>
              <p className="text-xs text-[#8f8899] mt-1 leading-normal">
                Workspaces give each of your initiatives a dedicated place for tasks, notes, memories, and chats, while keeping personal items separate.
              </p>
            </div>
            <button type="button" className="primary-pill text-xs mt-2" onClick={openNewForm}>
              <Plus size={14} /> Create your first workspace
            </button>
          </div>
        )}

        {/* Footer */}
        <p className="workspace-bottom-note text-[11px] text-[#746e7c] text-center my-6 flex items-center justify-center gap-1.5">
          <ShieldCheck size={13} className="text-violet-400" />
          <span>
            {storageAvailable
              ? 'Workspaces keep context isolated between projects while preserving personal defaults.'
              : 'Browser storage is currently unavailable.'}
          </span>
        </p>

        {/* Centered Confirm Delete Modal */}
        <ConfirmDialog
          open={Boolean(deletingWorkspace)}
          title="Delete this workspace?"
          description={
            deletingWorkspace
              ? `“${deletingWorkspace.name}” will be deleted. Any tasks, notes, and memories in it will be preserved in your personal lists.`
              : ''
          }
          confirmLabel="Delete workspace"
          onCancel={() => setDeletingWorkspace(null)}
          onConfirm={() => {
            if (deletingWorkspace) {
              onDelete(deletingWorkspace.id)
              setDeletingWorkspace(null)
            }
          }}
        />
      </div>
    </div>
  )
}
