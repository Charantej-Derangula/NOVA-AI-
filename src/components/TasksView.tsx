import React, { useState } from 'react'
import { AlertCircle, BriefcaseBusiness, CalendarClock, Check, Clock3, CloudOff, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { TaskDraft, TaskItem, WorkspaceItem } from '../types'
import {
  displayTime,
  formatTaskSchedule,
  fromDateTimeInput,
  getLocalDateKey,
  isDateOnly,
  localDateKey,
  minutesLabel,
  toDateTimeInput,
} from '../utils/dateTime'
import { useSystemTime } from '../hooks/useSystemTime'
import { ConfirmDialog } from './ConfirmDialog'

export interface TasksViewProps {
  tasks: TaskItem[]
  onToggleTask: (id: string) => Promise<void> | void
  onAddTask: (task: TaskDraft) => Promise<TaskItem | void> | TaskItem | void
  onUpdateTask: (id: string, updates: Partial<TaskItem>) => Promise<void> | void
  onDeleteTask: (id: string) => Promise<void> | void
  storageAvailable: boolean
  workspaces: WorkspaceItem[]
  currentWorkspaceId: string | null
  syncStatus?: 'cloud' | 'offline' | 'local' | 'syncing'
  syncError?: string | null
  onRetrySync?: () => Promise<void> | void
}

type TaskFilter = 'all' | 'pending' | 'completed'
type TaskDateScope = 'today' | 'earlier' | 'upcoming' | 'all'
const priorities: TaskItem['priority'][] = ['low', 'medium', 'high']
const priorityRank: Record<TaskItem['priority'], number> = { high: 0, medium: 1, low: 2 }

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  onToggleTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  storageAvailable,
  workspaces,
  currentWorkspaceId,
  syncStatus = 'local',
  syncError = null,
  onRetrySync,
}) => {
  const [filter, setFilter] = useState<TaskFilter>('all')
  const [dateScope, setDateScope] = useState<TaskDateScope>('today')
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<TaskItem['priority']>('medium')
  const [newSchedule, setNewSchedule] = useState('')
  const [newEstimate, setNewEstimate] = useState(30)
  const [formError, setFormError] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editing, setEditing] = useState<TaskItem | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPriority, setEditPriority] = useState<TaskItem['priority']>('medium')
  const [editSchedule, setEditSchedule] = useState('')
  const [editEstimate, setEditEstimate] = useState(30)
  const [editWorkspaceId, setEditWorkspaceId] = useState('')
  const [editError, setEditError] = useState('')
  const [deleting, setDeleting] = useState<TaskItem | null>(null)

  // Wall-clock time updates every minute and ensures midnight rollover updates smoothly
  const nowTime = useSystemTime(60_000)
  const todayDate = new Date(nowTime)
  const todayKey = localDateKey(todayDate)

  // Guarantee task uniqueness by ID while preserving order
  const uniqueTasks = Array.from(new Map(tasks.map((t) => [t.id, t])).values())

  const taskDateKey = (task: TaskItem): string => {
    return getLocalDateKey(task.scheduledAt ?? task.createdAt)
  }

  const dateCounts: Record<TaskDateScope, number> = {
    today: uniqueTasks.filter((task) => {
      const key = taskDateKey(task)
      return key !== '' && key === todayKey
    }).length,
    earlier: uniqueTasks.filter((task) => {
      const key = taskDateKey(task)
      return key !== '' && key < todayKey
    }).length,
    upcoming: uniqueTasks.filter((task) => {
      const key = taskDateKey(task)
      return key !== '' && key > todayKey
    }).length,
    all: uniqueTasks.length,
  }

  const scopedTasks = uniqueTasks.filter((task) => {
    const dateKey = taskDateKey(task)
    if (dateScope === 'today') return dateKey !== '' && dateKey === todayKey
    if (dateScope === 'earlier') return dateKey !== '' && dateKey < todayKey
    if (dateScope === 'upcoming') return dateKey !== '' && dateKey > todayKey
    return true
  })

  const completed = scopedTasks.filter((task) => task.completed).length
  const pending = scopedTasks.filter((task) => !task.completed)
  const pendingMinutes = pending.reduce((total, task) => total + task.estimateMinutes, 0)
  const completionPercent = scopedTasks.length ? Math.round((completed / scopedTasks.length) * 100) : 0

  const nextTask = [...pending].sort((a, b) => {
    if (a.scheduledAt && b.scheduledAt) return a.scheduledAt.localeCompare(b.scheduledAt)
    if (a.scheduledAt) return -1
    if (b.scheduledAt) return 1
    return priorityRank[a.priority] - priorityRank[b.priority]
  })[0]

  const filtered = scopedTasks
    .filter((task) => (filter === 'pending' ? !task.completed : filter === 'completed' ? task.completed : true))
    .sort((a, b) => Number(a.completed) - Number(b.completed) || (a.scheduledAt ?? '9999').localeCompare(b.scheduledAt ?? '9999'))

  const dateScopeLabel =
    dateScope === 'today'
      ? 'Today'
      : dateScope === 'earlier'
      ? 'Earlier dates'
      : dateScope === 'upcoming'
      ? 'Upcoming'
      : 'All dates'

  const taskListTitle =
    dateScope === 'today'
      ? 'Today’s tasks'
      : dateScope === 'earlier'
      ? 'Earlier tasks'
      : dateScope === 'upcoming'
      ? 'Upcoming tasks'
      : 'All tasks'

  const addTask = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newTitle.trim()) {
      setFormError('Add a task name before saving.')
      return
    }
    setActionError(null)
    setIsSubmitting(true)
    try {
      await onAddTask({
        title: newTitle.trim(),
        priority: newPriority,
        scheduledAt: fromDateTimeInput(newSchedule),
        estimateMinutes: newEstimate,
        workspaceId: currentWorkspaceId,
      })
      setNewTitle('')
      setNewSchedule('')
      setNewPriority('medium')
      setNewEstimate(30)
      setFormError('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setFormError(msg)
      setActionError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const beginEdit = (task: TaskItem) => {
    setEditing(task)
    setEditError('')
    setActionError(null)
    setEditTitle(task.title)
    setEditPriority(task.priority)
    setEditSchedule(toDateTimeInput(task.scheduledAt))
    setEditEstimate(task.estimateMinutes)
    setEditWorkspaceId(task.workspaceId ?? '')
  }

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editing) return
    if (!editTitle.trim()) {
      setEditError('Add a task name before saving.')
      return
    }
    setActionError(null)
    try {
      await onUpdateTask(editing.id, {
        title: editTitle.trim(),
        priority: editPriority,
        scheduledAt: fromDateTimeInput(editSchedule),
        estimateMinutes: editEstimate,
        workspaceId: editWorkspaceId || undefined,
      })
      setEditing(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setEditError(msg)
      setActionError(msg)
    }
  }

  const handleToggle = async (id: string) => {
    setActionError(null)
    try {
      await onToggleTask(id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setActionError(msg)
    }
  }

  const handleDelete = async (id: string) => {
    setActionError(null)
    try {
      await onDeleteTask(id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setActionError(msg)
    }
  }

  return (
    <div className="page-scroll tasks-page">
      <div className="page-content tasks-content task-workspace">
        <div className="tasks-heading">
          <div>
            <p className="eyebrow">YOUR WORKBENCH</p>
            <h1>Tasks</h1>
            <p className="intro-copy">A clear queue for the work you want to move forward.</p>
            <span className="task-context-label">
              <BriefcaseBusiness size={13} />
              {currentWorkspaceId
                ? `New tasks go to ${workspaces.find((space) => space.id === currentWorkspaceId)?.name ?? 'your current workspace'}`
                : 'New tasks go to your personal list'}
            </span>
          </div>
          <span className="task-date-label">
            {dateScope === 'today'
              ? `${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(todayDate)} · `
              : ''}
            {dateCounts[dateScope]} {dateCounts[dateScope] === 1 ? 'task' : 'tasks'} · {dateScopeLabel}
          </span>
        </div>

        {(actionError || syncError) && (
          <div className="task-action-error-banner flex items-center justify-between p-3 mb-4 rounded-lg bg-red-950/40 border border-red-500/30 text-red-200 text-xs" role="alert">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="text-red-400 shrink-0" />
              <span>{actionError || syncError}</span>
            </div>
            <div className="flex items-center gap-2">
              {onRetrySync && syncError && (
                <button
                  type="button"
                  onClick={() => onRetrySync()}
                  className="px-2 py-0.5 rounded bg-red-900/50 hover:bg-red-800/50 text-red-200 border border-red-500/30 font-medium cursor-pointer"
                >
                  Retry Sync
                </button>
              )}
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                aria-label="Dismiss error"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        <div className="tasks-overview task-queue-snapshot">
          <div className="queue-snapshot-summary">
            <span className="queue-snapshot-label">
              {dateScope === 'today' ? 'TODAY’S QUEUE' : `${dateScopeLabel.toUpperCase()} QUEUE`}
            </span>
            <div className="queue-total-line">
              <strong>{String(scopedTasks.length).padStart(2, '0')}</strong>
              <span>{scopedTasks.length === 1 ? 'task in this view' : 'tasks in this view'}</span>
            </div>
            <div className="queue-state-line">
              <span>
                <i className="queue-open-dot" />
                {pending.length} active
              </span>
              <i className="queue-divider" />
              <span>{completed} done</span>
            </div>
          </div>
          <div className="queue-snapshot-progress">
            <div className="queue-progress-heading">
              <span>Progress through {dateScope === 'today' ? 'today' : dateScope === 'all' ? 'all dates' : dateScopeLabel.toLowerCase()}</span>
              <strong>{completionPercent}%</strong>
            </div>
            <div
              className="queue-progress-track"
              role="progressbar"
              aria-label="Task completion"
              aria-valuemin={0}
              aria-valuemax={scopedTasks.length || 1}
              aria-valuenow={completed}
            >
              <span style={{ width: `${completionPercent}%` }} />
            </div>
            <div className="queue-progress-foot">
              <span>
                {scopedTasks.length
                  ? `${completed} of ${scopedTasks.length} complete · ${minutesLabel(pendingMinutes)} estimated work left`
                  : dateScope === 'today' && dateCounts.earlier
                  ? `${dateCounts.earlier} ${dateCounts.earlier === 1 ? 'task is' : 'tasks are'} saved under earlier dates.`
                  : 'Add the first task to start this view.'}
              </span>
              <span>{pending.length} left</span>
            </div>
          </div>
        </div>

        <div className="active-task-banner">
          <div className="active-task-orb">
            <CalendarClock size={17} />
          </div>
          <div>
            <span>
              {nextTask
                ? nextTask.scheduledAt
                  ? 'UP NEXT · SCHEDULED'
                  : 'UP NEXT · PRIORITY'
                : dateScope === 'today' && dateCounts.earlier
                ? 'EARLIER TASKS PRESERVED'
                : 'YOUR NEXT STEP'}
            </span>
            <strong>
              {nextTask?.title ??
                (dateScope === 'today' && dateCounts.earlier
                  ? `${dateCounts.earlier} ${dateCounts.earlier === 1 ? 'task is' : 'tasks are'} in your earlier dates`
                  : 'Add a task to build your plan')}
            </strong>
          </div>
          <span className="focus-suggestion">
            {nextTask
              ? `${nextTask.priority} priority${nextTask.scheduledAt && !isDateOnly(nextTask.scheduledAt) ? ` · ${displayTime(nextTask.scheduledAt)}` : ''}`
              : 'A clear place to start'}
          </span>
        </div>

        <form className="task-create task-create-scheduled task-capture-card" noValidate onSubmit={addTask}>
          <div className="task-capture-heading">
            <span className="task-capture-mark">
              <Plus size={18} aria-hidden="true" />
            </span>
            <div>
              <span className="task-capture-kicker">CAPTURE A COMMITMENT</span>
              <strong>What needs a place in your day?</strong>
              <small>Keep it flexible now. Add a time whenever you’re ready.</small>
            </div>
            <span className="task-capture-space">
              <BriefcaseBusiness size={13} />
              {currentWorkspaceId
                ? workspaces.find((space) => space.id === currentWorkspaceId)?.name ?? 'Current workspace'
                : 'Personal list'}
            </span>
          </div>
          <label className="task-create-title">
            <span>Task</span>
            <input
              value={newTitle}
              onChange={(event) => {
                setNewTitle(event.target.value)
                setFormError('')
              }}
              placeholder="For example, prepare the product brief"
              aria-label="New task title"
              aria-invalid={Boolean(formError)}
              aria-describedby={formError ? 'task-form-error' : undefined}
            />
          </label>
          <div className="task-capture-details">
            <label className="task-create-field task-schedule-field">
              <span>
                Schedule <small>optional</small>
              </span>
              <input
                type="datetime-local"
                value={newSchedule}
                onChange={(event) => setNewSchedule(event.target.value)}
                aria-label="Schedule date and time"
              />
            </label>
            <label className="task-create-field task-duration-field">
              <span>Estimate</span>
              <select
                value={newEstimate}
                onChange={(event) => setNewEstimate(Number(event.target.value))}
                aria-label="Estimated duration"
              >
                <option value={15}>15 minutes</option>
                <option value={25}>25 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </label>
            <label className="task-create-field task-priority-field">
              <span>Priority</span>
              <select
                value={newPriority}
                onChange={(event) => setNewPriority(event.target.value as TaskItem['priority'])}
                aria-label="Task priority"
              >
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority[0].toUpperCase() + priority.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Add to list
            </button>
          </div>
        </form>
        {formError && (
          <p className="form-error task-form-error" id="task-form-error" role="alert">
            {formError}
          </p>
        )}

        <div className="task-date-scopes" role="group" aria-label="Choose task date range">
          {(['today', 'earlier', 'upcoming', 'all'] as const).map((scope) => (
            <button
              type="button"
              key={scope}
              className={dateScope === scope ? 'chosen' : ''}
              aria-pressed={dateScope === scope}
              onClick={() => setDateScope(scope)}
            >
              <span>{scope === 'today' ? 'Today' : scope === 'earlier' ? 'Earlier' : scope === 'upcoming' ? 'Upcoming' : 'All dates'}</span>
              <small>{dateCounts[scope]}</small>
            </button>
          ))}
        </div>

        <div className="task-list-header">
          <div>
            <p className="eyebrow">
              {dateScope === 'earlier' ? 'YOUR HISTORY' : dateScope === 'upcoming' ? 'ON THE HORIZON' : 'YOUR QUEUE'}
            </p>
            <h2 className="flex items-center gap-2">
              <span>
                {filter === 'all'
                  ? taskListTitle
                  : filter === 'pending'
                  ? `Active · ${taskListTitle.toLowerCase()}`
                  : `Completed · ${taskListTitle.toLowerCase()}`}
              </span>
              <span className="task-count-pill">{filtered.length}</span>
            </h2>
          </div>
          <div className="task-filters" aria-label="Filter task status">
            {(['all', 'pending', 'completed'] as const).map((tab) => (
              <button
                type="button"
                key={tab}
                className={filter === tab ? 'chosen' : ''}
                aria-pressed={filter === tab}
                onClick={() => setFilter(tab)}
              >
                {tab === 'all' ? 'All' : tab === 'pending' ? 'Active' : 'Done'}
              </button>
            ))}
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="task-list">
            {filtered.map((task) => (
              <React.Fragment key={task.id}>
                <article className={`task-row task-priority-${task.priority} ${task.completed ? 'task-done' : ''}`}>
                  <button
                    className="task-checkbox"
                    type="button"
                    onClick={() => handleToggle(task.id)}
                    aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                    aria-pressed={task.completed}
                  >
                    {task.completed && <Check size={13} />}
                  </button>
                  <div className="task-row-content">
                    <span className="task-title">{task.title}</span>
                    <div className="task-row-meta">
                      <span className={`priority-dot priority-${task.priority}`} />
                      <span>{task.priority} priority</span>
                      <span className="task-meta-divider">·</span>
                      <span>{formatTaskSchedule(task.scheduledAt, task.createdAt)}</span>
                      <span className="task-meta-divider">·</span>
                      <span>{minutesLabel(task.estimateMinutes)}</span>
                      {task.workspaceId && (
                        <>
                          <span className="task-meta-divider">·</span>
                          <span className="task-workspace-label">
                            {workspaces.find((space) => space.id === task.workspaceId)?.name ?? 'Workspace'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="task-row-actions">
                    <button
                      className="task-edit"
                      type="button"
                      onClick={() => beginEdit(task)}
                      aria-label={`Edit ${task.title}`}
                    >
                      <Pencil size={15} />
                      <span>Edit</span>
                    </button>
                    <button
                      className="task-delete"
                      type="button"
                      onClick={() => setDeleting(task)}
                      aria-label={`Delete ${task.title}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>

                {editing?.id === task.id && (
                  <form className="task-edit-panel" noValidate onSubmit={saveEdit}>
                    <div className="task-edit-heading">
                      <strong>Edit task</strong>
                      <button type="button" onClick={() => setEditing(null)} aria-label="Cancel editing">
                        <X size={15} />
                      </button>
                    </div>
                    <label className="task-edit-name">
                      <span>Task name</span>
                      <input
                        value={editTitle}
                        onChange={(event) => {
                          setEditTitle(event.target.value)
                          setEditError('')
                        }}
                        aria-label="Task title"
                        aria-invalid={Boolean(editError)}
                        aria-describedby={editError ? 'task-edit-error' : undefined}
                      />
                    </label>
                    <label>
                      <span>Schedule</span>
                      <input
                        type="datetime-local"
                        value={editSchedule}
                        onChange={(event) => setEditSchedule(event.target.value)}
                        aria-label="Schedule date and time"
                      />
                    </label>
                    <label>
                      <span>Estimate</span>
                      <select
                        value={editEstimate}
                        onChange={(event) => setEditEstimate(Number(event.target.value))}
                        aria-label="Estimated duration"
                      >
                        <option value={15}>15 min</option>
                        <option value={25}>25 min</option>
                        <option value={30}>30 min</option>
                        <option value={45}>45 min</option>
                        <option value={60}>1 hour</option>
                        <option value={90}>1.5 hours</option>
                        <option value={120}>2 hours</option>
                      </select>
                    </label>
                    <label>
                      <span>Priority</span>
                      <select
                        value={editPriority}
                        onChange={(event) => setEditPriority(event.target.value as TaskItem['priority'])}
                        aria-label="Priority"
                      >
                        {priorities.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority[0].toUpperCase() + priority.slice(1)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Workspace</span>
                      <select
                        value={editWorkspaceId}
                        onChange={(event) => setEditWorkspaceId(event.target.value)}
                        aria-label="Workspace"
                      >
                        <option value="">Personal list</option>
                        {workspaces.map((space) => (
                          <option key={space.id} value={space.id}>
                            {space.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {editError && (
                      <p id="task-edit-error" className="form-error" role="alert">
                        {editError}
                      </p>
                    )}
                    <button type="submit" className="task-edit-save">
                      Save changes
                    </button>
                  </form>
                )}
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div className="task-empty task-empty-card">
            <span className="task-empty-icon">
              <Check size={18} />
            </span>
            <div className="task-empty-body">
              <strong>
                {uniqueTasks.length
                  ? dateScope === 'today' && dateCounts.earlier
                    ? 'Nothing scheduled for today'
                    : 'No tasks in this view'
                  : 'Your task list starts here'}
              </strong>
              <p>
                {uniqueTasks.length
                  ? dateScope === 'today' && dateCounts.earlier
                    ? `${dateCounts.earlier} ${dateCounts.earlier === 1 ? 'task is' : 'tasks are'} still available under Earlier.`
                    : 'Choose another date range or status filter to see the rest of your list.'
                  : 'Add a real commitment above. Give it a time if you want it on your timeline.'}
              </p>
              {uniqueTasks.length > 0 && dateScope === 'today' && dateCounts.earlier > 0 && (
                <button
                  type="button"
                  className="task-empty-action"
                  onClick={() => {
                    setDateScope('earlier')
                    setFilter('all')
                  }}
                >
                  <span>View earlier tasks</span>
                  <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="tasks-bottom-note">
          {syncStatus === 'cloud' && (
            <>
              <Check size={13} className="text-emerald-400" />
              <span>Tasks and schedule are synced with Supabase cloud.</span>
            </>
          )}
          {syncStatus === 'syncing' && (
            <>
              <Loader2 size={13} className="animate-spin text-violet-400" />
              <span>Syncing tasks with Supabase cloud...</span>
            </>
          )}
          {syncStatus === 'offline' && (
            <>
              <CloudOff size={13} className="text-amber-400" />
              <span>Offline mode — tasks are saved in this browser and will sync when reconnected.</span>
            </>
          )}
          {syncStatus === 'local' && (
            <>
              <Clock3 size={13} />
              <span>
                {storageAvailable
                  ? 'Tasks and schedule are saved in this browser.'
                  : 'Browser storage is unavailable; changes may not persist.'}
              </span>
            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this task?"
        description={deleting ? `“${deleting.title}” will be removed from your task list and timeline.` : ''}
        confirmLabel="Delete task"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) handleDelete(deleting.id)
          setDeleting(null)
        }}
      />
    </div>
  )
}
