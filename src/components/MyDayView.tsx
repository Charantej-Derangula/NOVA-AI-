import React, { useEffect, useRef, useState } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, MessageCircle, Plus, Sparkles } from 'lucide-react'
import type { TaskDraft, TaskItem, WorkspaceItem } from '../types'
import { dateFromLocalKey, fromDateTimeInput, isOnLocalDate, localDateKey, minutesLabel, nextQuarterHour, toDateTimeInput } from '../utils/dateTime'
import { TaskTimeline } from './TaskTimeline'

interface MyDayViewProps {
  tasks: TaskItem[]
  onAddTask: (task: TaskDraft) => void
  onToggleTask: (id: string) => void
  onOpenTasks: () => void
  onOpenChatWithPrompt: (prompt: string) => void
  storageAvailable: boolean
  workspaces: WorkspaceItem[]
  currentWorkspaceId: string | null
  syncStatus?: 'cloud' | 'offline' | 'local' | 'syncing'
}

export const MyDayView: React.FC<MyDayViewProps> = ({ tasks, onAddTask, onToggleTask, onOpenTasks, onOpenChatWithPrompt, storageAvailable, workspaces, currentWorkspaceId, syncStatus = 'local' }) => {
  const [showScheduler, setShowScheduler] = useState(false)
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState(() => toDateTimeInput(nextQuarterHour()))
  const [selectedDay, setSelectedDay] = useState(() => localDateKey())
  const [estimateMinutes, setEstimateMinutes] = useState(30)
  const [priority, setPriority] = useState<TaskItem['priority']>('medium')
  const [formError, setFormError] = useState('')
  const taskNameRef = useRef<HTMLInputElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const today = new Date()
  const viewedDate = dateFromLocalKey(selectedDay)
  const viewingToday = selectedDay === localDateKey(today)
  const dayTasks = tasks.filter((task) => isOnLocalDate(task.scheduledAt, viewedDate))
  const pendingDay = dayTasks.filter((task) => !task.completed)
  const completedDay = dayTasks.length - pendingDay.length
  const plannedMinutes = pendingDay.reduce((total, task) => total + task.estimateMinutes, 0)
  const completionPercent = dayTasks.length ? Math.round(completedDay / dayTasks.length * 100) : 0
  const unscheduled = tasks.filter((task) => !task.completed && !task.scheduledAt)
  const date = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(viewedDate)
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(viewedDate)
  const currentWorkspaceName = workspaces.find((workspace) => workspace.id === currentWorkspaceId)?.name

  const setDay = (dateKey: string) => {
    const nextDate = dateFromLocalKey(dateKey)
    if (Number.isNaN(nextDate.getTime())) return
    setSelectedDay(localDateKey(nextDate))
    if (showScheduler) {
      const defaultStart = new Date(nextDate)
      if (localDateKey(nextDate) === localDateKey()) defaultStart.setTime(nextQuarterHour().getTime())
      else defaultStart.setHours(9, 0, 0, 0)
      setScheduledAt(toDateTimeInput(defaultStart))
    }
  }

  const openScheduler = () => {
    if (showScheduler) {
      setShowScheduler(false)
      setFormError('')
      return
    }
    const defaultStart = new Date(viewedDate)
    if (viewingToday) defaultStart.setTime(nextQuarterHour().getTime())
    else defaultStart.setHours(9, 0, 0, 0)
    setScheduledAt(toDateTimeInput(defaultStart))
    setShowScheduler(true)
    setFormError('')
  }

  useEffect(() => {
    if (showScheduler) taskNameRef.current?.focus({ preventScroll: true })
  }, [showScheduler])

  useEffect(() => {
    let midnightTimer = 0
    const scheduleMidnightRefresh = () => {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      midnightTimer = window.setTimeout(() => {
        setSelectedDay(localDateKey())
        setScheduledAt(toDateTimeInput(nextQuarterHour()))
        scheduleMidnightRefresh()
      }, Math.max(1_000, midnight.getTime() - now.getTime() + 100))
    }
    scheduleMidnightRefresh()
    return () => window.clearTimeout(midnightTimer)
  }, [])

  const submitSchedule = (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) {
      setFormError('Add a task name before scheduling it.')
      return
    }
    const parsed = fromDateTimeInput(scheduledAt)
    if (!parsed) {
      setFormError('Choose a date and time for this task.')
      return
    }
    onAddTask({ title: title.trim(), scheduledAt: parsed, estimateMinutes, priority, workspaceId: currentWorkspaceId })
    setTitle('')
    setFormError('')
    setShowScheduler(false)
    window.requestAnimationFrame(() => {
      if (pageRef.current) pageRef.current.scrollTop = 0
    })
  }

  return <div ref={pageRef} className="page-scroll day-page"><div className="page-content day-content day-planner-content">
    <div className="day-heading day-planner-heading"><div><p className="eyebrow"><CalendarDays size={14}/> YOUR DAILY PLAN</p><h1>A day with room to focus<span className="day-heading-period">.</span></h1><p className="intro-copy">{date} <span>·</span> {viewingToday ? 'A flexible plan for what matters today.' : 'Your saved schedule for this day.'}</p></div><div className="day-heading-actions"><button className="subtle-pill" type="button" onClick={() => onOpenChatWithPrompt(`Help me review my scheduled tasks for ${date} and decide what to do next.`)}><MessageCircle size={15}/> Open chat</button><button className="primary-pill" type="button" onClick={openScheduler}><Plus size={15}/> Schedule a task</button></div></div>

    <div className="day-hero day-command glass-panel">
      <div className="day-command-main">
        <span className="day-date-square"><b>{viewedDate.getDate()}</b><small>{new Intl.DateTimeFormat(undefined, { month: 'short' }).format(viewedDate)}</small></span>
        <div className="day-command-copy"><span className="eyebrow">{viewingToday ? 'TODAY, AT YOUR PACE' : `${weekday.toUpperCase()} · DAY AT A GLANCE`}</span><h2>{pendingDay.length > 0 ? `${pendingDay.length} ${pendingDay.length === 1 ? 'commitment' : 'commitments'} still ahead.` : dayTasks.length > 0 ? 'Everything on this day is complete.' : viewingToday ? 'Your day has room to breathe.' : 'Nothing scheduled for this day.'}</h2><p>{dayTasks.length === 0 ? viewingToday ? 'Add a time to a task and give your day a shape.' : 'Choose another date or add a task to this day.' : `${minutesLabel(plannedMinutes)} of estimated work remains on this schedule.`}</p></div>
        <div className="day-completion-ring" style={{ '--day-progress': `${completionPercent}%` } as React.CSSProperties} role="img" aria-label={`${completionPercent}% of ${date}'s scheduled tasks complete`}><span>{completionPercent}<small>%</small></span><small>complete</small></div>
      </div>
      <div className="day-command-bottom">
        <div className="day-command-stats"><span><b>{dayTasks.length}</b> planned</span><i/><span><b>{completedDay}</b> done</span><i/><span><b>{pendingDay.length}</b> remaining</span></div>
        <div className="day-command-progress" role="progressbar" aria-label={`${date} scheduled task progress`} aria-valuemin={0} aria-valuemax={dayTasks.length || 1} aria-valuenow={completedDay}><span style={{ width: `${completionPercent}%` }}/></div>
      </div>
    </div>

    {showScheduler && <form className="day-schedule-form" noValidate onSubmit={submitSchedule}>
      <div className="day-schedule-title"><span className="schedule-form-icon"><Sparkles size={16}/></span><div><strong>Give a task a place in your day</strong><p>It appears in My Day, Overview, and Tasks. Saved to {currentWorkspaceName ?? 'your personal list'}.</p></div></div>
      <label className="schedule-field schedule-name-field"><span>Task name</span><input ref={taskNameRef} value={title} onChange={(event) => { setTitle(event.target.value); setFormError('') }} placeholder="What needs your attention?" aria-invalid={Boolean(formError) && !title.trim()} aria-describedby={formError ? 'day-schedule-error' : undefined}/></label>
      <label className="schedule-field"><span>Starts</span><input type="datetime-local" value={scheduledAt} onChange={(event) => { setScheduledAt(event.target.value); setFormError('') }}/></label>
      <label className="schedule-field"><span>Estimate</span><select value={estimateMinutes} onChange={(event) => setEstimateMinutes(Number(event.target.value))}><option value={15}>15 minutes</option><option value={25}>25 minutes</option><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>1 hour</option><option value={90}>1.5 hours</option><option value={120}>2 hours</option></select></label>
      <label className="schedule-field"><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as TaskItem['priority'])}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      {formError && <p className="form-error" id="day-schedule-error" role="alert">{formError}</p>}
      <div className="day-schedule-actions"><button className="subtle-pill" type="button" onClick={() => setShowScheduler(false)}>Cancel</button><button className="primary-pill" type="submit">Add to timeline</button></div>
    </form>}

    <section className="day-timeline-section day-schedule-board"><div className="section-heading day-timeline-heading"><div><p className="eyebrow">THE DAY, IN ORDER</p><h2>{viewingToday ? 'Today’s timeline' : `${weekday}’s timeline`}</h2><p className="day-timeline-caption">{viewingToday ? 'A full-day map with every commitment in its place.' : 'Your saved tasks for this date, in order.'}</p></div><div className="day-timeline-controls"><div className="day-date-switcher" aria-label="Browse daily plans"><button type="button" aria-label="Previous day" onClick={() => { const next = new Date(viewedDate); next.setDate(next.getDate() - 1); setDay(localDateKey(next)) }}><ChevronLeft size={15}/></button><label><input type="date" aria-label="Choose a day" value={selectedDay} onChange={(event) => setDay(event.target.value)}/></label><button type="button" aria-label="Next day" onClick={() => { const next = new Date(viewedDate); next.setDate(next.getDate() + 1); setDay(localDateKey(next)) }}><ChevronRight size={15}/></button></div>{!viewingToday && <button type="button" className="day-today-button" onClick={() => setDay(localDateKey())}>Today</button>}<span className="timeline-count"><Clock3 size={14}/> {pendingDay.length} open</span></div></div><TaskTimeline tasks={dayTasks} workspaces={workspaces} onToggleTask={onToggleTask} onSchedule={openScheduler} showCurrentTime={viewingToday} emptyTitle={viewingToday ? 'Nothing planned for today' : 'Nothing scheduled for this day'} emptyDescription={viewingToday ? 'Your timeline is open. Add one commitment and see it land on the day map.' : 'Choose another date or schedule a task above to see it here.'}/></section>

    {unscheduled.length > 0 && <section className="unscheduled-panel"><div><p className="eyebrow">WITHOUT A TIME</p><h2>Unscheduled tasks <span>{unscheduled.length}</span></h2><p>These tasks stay in your list until you choose when to do them.</p></div><button className="text-action" type="button" onClick={onOpenTasks}>Schedule in Tasks <span aria-hidden="true">→</span></button><ul>{unscheduled.slice(0, 4).map((task) => <li key={task.id}><span className={`priority-dot priority-${task.priority}`}/><span>{task.title}</span>{task.workspaceId && <small className="schedule-workspace-label">{workspaces.find((workspace) => workspace.id === task.workspaceId)?.name ?? 'Workspace'}</small>}<small>{minutesLabel(task.estimateMinutes)}</small></li>)}</ul></section>}

    <div className="day-footer-card"><div><p className="eyebrow">A NOTE FOR LATER</p><h2>Leave a little room for the unexpected.</h2><p>Your plan can move with you. Update a task’s time from the Tasks page whenever you need.</p></div><span className="day-spark" aria-hidden="true">✳</span><button className="text-action" type="button" onClick={onOpenTasks}>Adjust tasks <span aria-hidden="true">→</span></button></div>
    <p className="day-storage-note">
      {syncStatus === 'cloud' && (
        <><Check size={13}/> Schedule changes are synced with Supabase cloud.</>
      )}
      {syncStatus === 'syncing' && (
        <><Clock3 size={13}/> Syncing schedule changes with Supabase cloud...</>
      )}
      {syncStatus === 'offline' && (
        <><Clock3 size={13}/> Offline mode — schedule changes are saved in this browser and will sync when reconnected.</>
      )}
      {(!syncStatus || syncStatus === 'local') && (
        <><Check size={13}/> {storageAvailable ? 'Schedule changes are saved in this browser.' : 'Browser storage is unavailable; schedule changes may not persist.'}</>
      )}
    </p>
  </div></div>
}
