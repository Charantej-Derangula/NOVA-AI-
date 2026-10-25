import React from 'react'
import { ArrowRight, CalendarClock, Check, Circle, Clock3, Plus, Sparkles } from 'lucide-react'
import type { FocusTimerState, TaskItem, WorkspaceItem } from '../types'
import { isDateOnly, isOnLocalDate, localDateKey, minutesLabel, parseDateValue } from '../utils/dateTime'
import { TaskTimeline } from './TaskTimeline'
import { useSystemTime } from '../hooks/useSystemTime'
import { FocusTimerCard } from './FocusTimerCard'

interface DashboardViewProps {
  tasks: TaskItem[]
  focusTimer: FocusTimerState
  onFocusTimerChange: React.Dispatch<React.SetStateAction<FocusTimerState>>
  onToggleTask: (id: string) => void
  onOpen: (tab: 'my-day' | 'tasks') => void
  storageAvailable: boolean
  workspaces: WorkspaceItem[]
}

const startOfWeek = (date: Date) => {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

const priorityOrder: Record<TaskItem['priority'], number> = { high: 0, medium: 1, low: 2 }

const nextStepSchedule = (task: TaskItem, now: Date) => {
  if (!task.scheduledAt) return 'Flexible timing'
  const scheduled = parseDateValue(task.scheduledAt)
  if (!scheduled || Number.isNaN(scheduled.getTime())) return 'Scheduled'

  const hasSpecificTime = !isDateOnly(task.scheduledAt)
  const time = hasSpecificTime
    ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(scheduled)
    : ''
  const dateKey = localDateKey(scheduled)
  const todayKey = localDateKey(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dateLabel = dateKey === todayKey
    ? 'Today'
    : dateKey === localDateKey(yesterday)
      ? 'Yesterday'
      : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(scheduled)
  if (scheduled.getTime() < now.getTime()) {
    return hasSpecificTime ? `Overdue · ${dateLabel} at ${time}` : `Overdue · ${dateLabel}`
  }
  if (dateKey === todayKey) return hasSpecificTime ? `Today · ${time}` : 'Today'

  const date = dateKey === localDateKey(tomorrow)
    ? 'Tomorrow'
    : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(scheduled)
  return hasSpecificTime ? `${date} · ${time}` : date
}

export const DashboardView: React.FC<DashboardViewProps> = ({ tasks, focusTimer, onFocusTimerChange, onToggleTask, onOpen, storageAvailable, workspaces }) => {
  const now = useSystemTime(focusTimer.startedAt ? 1000 : 60_000)
  const today = new Date(now)
  const todayKey = localDateKey(today)
  const todaysTasks = tasks.filter((task) => isOnLocalDate(task.scheduledAt, today))
  const completeToday = todaysTasks.filter((task) => task.completed).length
  const pendingToday = todaysTasks.filter((task) => !task.completed)
  const pendingAll = tasks.filter((task) => !task.completed).sort((left, right) => {
    const leftTime = left.scheduledAt ? new Date(left.scheduledAt).getTime() : Number.NaN
    const rightTime = right.scheduledAt ? new Date(right.scheduledAt).getTime() : Number.NaN
    const leftHasTime = Number.isFinite(leftTime)
    const rightHasTime = Number.isFinite(rightTime)
    if (leftHasTime !== rightHasTime) return leftHasTime ? -1 : 1
    if (leftHasTime && rightHasTime) {
      const leftIsOverdue = leftTime < now
      const rightIsOverdue = rightTime < now
      if (leftIsOverdue !== rightIsOverdue) return leftIsOverdue ? -1 : 1
      if (leftTime !== rightTime) return leftIsOverdue ? rightTime - leftTime : leftTime - rightTime
    }
    if (left.priority !== right.priority) return priorityOrder[left.priority] - priorityOrder[right.priority]
    return left.createdAt.localeCompare(right.createdAt)
  })
  const plannedMinutes = pendingToday.reduce((total, task) => total + task.estimateMinutes, 0)
  const nextTask = [...pendingToday].sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))[0]
  const completionPercent = todaysTasks.length ? Math.round(completeToday / todaysTasks.length * 100) : 0
  const miniTimelineTasks = todaysTasks.flatMap((task) => {
    if (!task.scheduledAt) return []
    const start = new Date(task.scheduledAt)
    const minutesFromSix = start.getHours() * 60 + start.getMinutes() - 6 * 60
    const visibleStart = Math.max(0, minutesFromSix)
    const visibleEnd = Math.min(18 * 60, minutesFromSix + task.estimateMinutes)
    if (visibleEnd <= visibleStart) return []
    return [{
      task,
      left: visibleStart / (18 * 60) * 100,
      width: Math.max(1.2, (visibleEnd - visibleStart) / (18 * 60) * 100),
    }]
  })
  const date = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(today)
  const weekStart = startOfWeek(today)
  const priorWeekStart = new Date(weekStart)
  priorWeekStart.setDate(priorWeekStart.getDate() - 7)
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart)
    day.setDate(day.getDate() + index)
    const previous = new Date(priorWeekStart)
    previous.setDate(previous.getDate() + index)
    const countFor = (date: Date) => tasks.filter((task) => task.completedAt && isOnLocalDate(task.completedAt, date)).length
    return { date: day, previous: countFor(previous), current: countFor(day) }
  })
  const maxCompletions = Math.max(1, ...days.flatMap((day) => [day.previous, day.current]))
  const weekTotal = tasks.filter((task) => task.completedAt && new Date(task.completedAt) >= weekStart).length
  const weekLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(weekStart)

  return <div className="page-scroll dashboard-page">
    <div className="page-content dashboard-content">
      <div className="dash-intro">
        <div><p className="eyebrow">YOUR PERSONAL SPACE · {date.toUpperCase()}</p><h1>Stay on track today<span className="title-period">.</span></h1><p className="intro-copy">A clear view of the work you’ve scheduled and the next useful step.</p></div>
        <button className="primary-pill" type="button" onClick={() => onOpen('my-day')}><Sparkles size={15}/> Open my day <ArrowRight size={15}/></button>
      </div>

      <div className="dashboard-welcome glass-panel">
        <div className="welcome-icon"><Check size={24}/></div><div className="welcome-copy"><strong>{pendingAll.length === 0 ? 'Your list is clear.' : todaysTasks.length === 0 ? 'Make a little room for today.' : pendingToday.length === 0 ? 'Today’s plan is complete.' : 'You have a plan for today.'}</strong><span>{todaysTasks.length === 0 ? 'Add a task and choose a time to see it on your timeline.' : `${completeToday} of ${todaysTasks.length} scheduled ${todaysTasks.length === 1 ? 'task is' : 'tasks are'} complete.`}</span></div>
        <button className="text-action" type="button" onClick={() => onOpen('tasks')}>View tasks <ArrowRight size={14}/></button>
      </div>

      <div className="goal-strip glass-panel"><div className="date-chip"><b>{today.getDate()}</b><span>{new Intl.DateTimeFormat(undefined, { month: 'short' }).format(today)}</span></div><div className="goal-meta"><strong>Today’s progress</strong><span>{completeToday} of {todaysTasks.length} scheduled complete</span></div><div className="progress-track" role="progressbar" aria-label="Today's scheduled task progress" aria-valuemin={0} aria-valuemax={todaysTasks.length || 1} aria-valuenow={completeToday}><span style={{ width: `${todaysTasks.length ? completeToday / todaysTasks.length * 100 : 0}%` }}/></div><button className="icon-button" type="button" aria-label="Open My Day" onClick={() => onOpen('my-day')}><ArrowRight size={17}/></button></div>

      <div className="dashboard-metrics dashboard-metrics-real">
        <FocusTimerCard focusTimer={focusTimer} onFocusTimerChange={onFocusTimerChange}/>
        <article className="metric-card plan-card">
          <div className="metric-label"><CalendarClock size={15}/> Planned work<span className="metric-state">Today</span></div>
          <strong>{minutesLabel(plannedMinutes)}</strong>
          <div className="plan-progress-copy"><span>{pendingToday.length} open {pendingToday.length === 1 ? 'commitment' : 'commitments'}</span><span>{completionPercent}% complete</span></div>
          <div className="plan-progress-track" role="progressbar" aria-label="Today's task completion" aria-valuemin={0} aria-valuemax={todaysTasks.length || 1} aria-valuenow={completeToday}><span style={{ width: `${completionPercent}%` }}/></div>
          <button className="metric-link" type="button" onClick={() => onOpen('my-day')}>Review your day <ArrowRight size={13}/></button>
        </article>
        <article className="metric-card next-card">
          <div className="metric-label"><span className="next-card-label">Next on your timeline</span><span className="score-chip">{pendingToday.length} open</span></div>
          {nextTask ? <div className="next-task-feature">
            <span className="next-time-chip"><small>UP NEXT</small><strong>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(nextTask.scheduledAt!))}</strong></span>
            <div className="next-task-feature-copy"><strong className="next-metric-title">{nextTask.title}</strong><span>{minutesLabel(nextTask.estimateMinutes)} <i>·</i> {nextTask.priority} priority{nextTask.workspaceId ? ` · ${workspaces.find((workspace) => workspace.id === nextTask.workspaceId)?.name ?? 'Workspace'}` : ''}</span></div>
          </div> : <div className="next-task-feature next-task-feature-empty"><span className="next-time-chip"><small>UP NEXT</small><strong>—</strong></span><div className="next-task-feature-copy"><strong className="next-metric-title">Nothing scheduled yet</strong><span>Choose a time for a task to see it here.</span></div></div>}
          <div className="next-mini-timeline" aria-label="Today's scheduled task positions between 6 AM and midnight">
            <div className="next-mini-track">{miniTimelineTasks.map(({ task, left, width }, index) => <span key={task.id} className={`next-mini-event ${task.completed ? 'is-done' : ''} ${task.id === nextTask?.id ? 'is-next' : ''} tone-${index % 3}`} style={{ left: `${left}%`, width: `${width}%` }} title={`${task.title} · ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(task.scheduledAt!))}`}/>)}</div>
            <div className="next-mini-axis"><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span></div>
          </div>
          <button className="metric-link" type="button" onClick={() => onOpen('tasks')}>{nextTask ? 'View timeline' : 'Plan a task'} <ArrowRight size={13}/></button>
        </article>
      </div>

      <section className="timeline-panel timeline-panel-real"><div className="section-heading"><div><p className="eyebrow">YOUR SCHEDULE</p><h2>Today’s timeline</h2></div><button className="text-action" type="button" onClick={() => onOpen('my-day')}>Open My Day <ArrowRight size={14}/></button></div><TaskTimeline tasks={todaysTasks} workspaces={workspaces} onToggleTask={onToggleTask} compact emptyTitle="Your timeline is open" emptyDescription="Add a task with a time to see it here."/></section>

      <section className="dashboard-lower"><article className="habit-panel glass-panel"><div className="section-heading"><div><p className="eyebrow">WEEKLY RHYTHM</p><h2>Tasks completed</h2></div><span className="trend">{weekTotal} this week</span></div><p className="week-context">Your completed tasks by day · week of {weekLabel}</p><div className="week-bars week-bars-real">{days.map(({ date: day, previous, current }) => <div className="week-column" key={localDateKey(day)} aria-label={`${new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(day)}: ${current} completed this week, ${previous} previous week`}><span className="day-check">{localDateKey(day) === todayKey && <span className="today-dot"/>}</span><div className="double-bar"><i title={`${previous} completed previous week`} style={{ height: `${previous === 0 ? 3 : Math.max(10, previous / maxCompletions * 72)}%` }}/><i title={`${current} completed this week`} style={{ height: `${current === 0 ? 3 : Math.max(10, current / maxCompletions * 72)}%` }}/></div><span className="weekday">{new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day).slice(0, 1)}</span></div>)}</div><div className="legend"><span><i/>Previous week</span><span><i/>Current week</span></div></article>
        <article className="next-panel glass-panel">
          <div className="section-heading">
            <div><p className="eyebrow">UP NEXT</p><h2>Your next steps</h2></div>
            <button className="icon-button" type="button" onClick={() => onOpen('tasks')} aria-label="View all tasks"><ArrowRight size={17}/></button>
          </div>
          {pendingAll.slice(0, 3).map((task, index) => (
            <div className={`next-task ${index === 0 ? 'next-task--first' : ''}`} key={task.id}>
              <button className="next-task-check" type="button" onClick={() => onToggleTask(task.id)} aria-label={`Complete task ${task.title}`} title={`Complete ${task.title}`}>
                <Circle size={17}/>
              </button>
              <div className="next-task-copy">
                <div className="next-task-title-line"><strong>{task.title}</strong>{index === 0 && <span className="next-task-now">NEXT</span>}</div>
                <div className="next-task-details">
                  <span>{nextStepSchedule(task, new Date(now))}</span><i aria-hidden="true">·</i><span>{minutesLabel(task.estimateMinutes)}</span>
                  {task.workspaceId && <><i aria-hidden="true">·</i><span>{workspaces.find((workspace) => workspace.id === task.workspaceId)?.name ?? 'Workspace'}</span></>}
                </div>
              </div>
              <span className={`next-task-priority next-task-priority--${task.priority}`}>{task.priority}</span>
            </div>
          ))}
          {pendingAll.length === 0 && <p className="empty-note">Everything is clear. Add a task when something needs a place.</p>}
          <button className="add-link" type="button" onClick={() => onOpen('tasks')}><Plus size={14}/> Add a task <ArrowRight size={13}/></button>
        </article>
      </section>
      <div className="dashboard-footer-note"><Clock3 size={14}/> Focus time is counted only while the timer is running. {storageAvailable ? 'Activity is saved in this browser.' : 'Browser storage is unavailable; changes may not persist.'}</div>
    </div>
  </div>
}
