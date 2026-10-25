import React from 'react'
import { ArrowUpRight, Check, Clock3, Plus, Sparkles } from 'lucide-react'
import type { TaskItem, WorkspaceItem } from '../types'
import { displayTime, minutesLabel, parseDateValue } from '../utils/dateTime'
import { useSystemTime } from '../hooks/useSystemTime'

interface TaskTimelineProps {
  tasks: TaskItem[]
  onToggleTask: (id: string) => void
  emptyTitle: string
  emptyDescription: string
  compact?: boolean
  workspaces?: WorkspaceItem[]
  onSchedule?: () => void
  showCurrentTime?: boolean
}

const timeMarks = [
  { label: '12 AM', minute: 0 },
  { label: '6 AM', minute: 360 },
  { label: '12 PM', minute: 720 },
  { label: '6 PM', minute: 1080 },
  { label: '12 AM', minute: 1440 },
]

const getDaypart = (date: Date) => {
  const hour = date.getHours()
  if (hour < 5) return 'Late night'
  if (hour < 12) return 'Morning'
  if (hour < 17) return 'Afternoon'
  return 'Evening'
}

const getEndTime = (start: string, minutes: number) => {
  const parsed = parseDateValue(start)
  if (!parsed) return ''
  const end = new Date(parsed.getTime() + minutes * 60_000)
  return displayTime(end.toISOString())
}

export const TaskTimeline: React.FC<TaskTimelineProps> = ({
  tasks,
  onToggleTask,
  emptyTitle,
  emptyDescription,
  compact = false,
  workspaces = [],
  onSchedule,
  showCurrentTime = false,
}) => {
  const now = useSystemTime()
  const ordered = [...tasks]
    .filter((task) => task.scheduledAt)
    .sort((left, right) => left.scheduledAt!.localeCompare(right.scheduledAt!))
  const nextTaskId = ordered.find((task) => !task.completed)?.id
  const nowDate = new Date(now)
  const currentMinute = nowDate.getHours() * 60 + nowDate.getMinutes()

  const dayMap = <div className={`schedule-day-map${ordered.length === 0 ? ' schedule-day-map--empty' : ''}`} aria-label="24 hour schedule overview">
    <div className="schedule-map-heading">
      <span>DAY MAP</span>
      <strong>{ordered.length ? `${ordered.length} ${ordered.length === 1 ? 'time block' : 'time blocks'}` : 'A clear day ahead'}</strong>
    </div>
    <div className="schedule-map-track-wrap">
      <div className="schedule-map-track" aria-hidden="true">
        {timeMarks.slice(0, -1).map((mark) => <i key={mark.minute} style={{ left: `${mark.minute / 1440 * 100}%` }}/>) }
        {ordered.map((task, index) => {
          const start = new Date(task.scheduledAt!).getHours() * 60 + new Date(task.scheduledAt!).getMinutes()
          const width = Math.max(.65, Math.min(task.estimateMinutes / 1440 * 100, 100 - start / 1440 * 100))
          return <i
            key={task.id}
            className={`schedule-map-block schedule-map-block--${task.completed ? 'done' : task.priority}`}
            style={{ left: `${start / 1440 * 100}%`, width: `${width}%`, top: `${5 + index % 3 * 7}px` }}
            title={`${displayTime(task.scheduledAt!)} · ${task.title}`}
          />
        })}
        {showCurrentTime && <i className="schedule-map-now" style={{ left: `${currentMinute / 1440 * 100}%` }} />}
      </div>
      <div className="schedule-map-labels">{timeMarks.map((mark, index) => <span key={`${mark.minute}-${index}`} style={{ left: `${mark.minute / 1440 * 100}%` }}>{mark.label}</span>)}</div>
    </div>
  </div>

  if (ordered.length === 0) {
    if (compact) return <div className="schedule-empty schedule-empty-compact">
      <span><Clock3 size={17}/></span>
      <div><strong>{emptyTitle}</strong><p>{emptyDescription}</p></div>
    </div>

    return <div className="schedule-canvas-empty">
      {dayMap}
      <div className="schedule-empty schedule-empty--canvas">
        <span><Sparkles size={18}/></span>
        <div><small>THE NEXT BLOCK IS YOURS TO SHAPE</small><strong>{emptyTitle}</strong><p>{emptyDescription}</p></div>
        {onSchedule && <button type="button" onClick={onSchedule}><Plus size={15}/> Place a time block <ArrowUpRight size={14}/></button>}
      </div>
      <div className="schedule-daypart-rail" aria-hidden="true"><span>Morning</span><i/><span>Afternoon</span><i/><span>Evening</span></div>
    </div>
  }

  if (compact) {
    return <ol className="schedule-list schedule-list-compact">
      {ordered.map((task) => {
        const timestamp = new Date(task.scheduledAt!).getTime()
        const overdue = timestamp < now && !task.completed
        const workspaceName = workspaces.find((workspace) => workspace.id === task.workspaceId)?.name
        return <li className={`schedule-row ${task.completed ? 'schedule-row-done' : ''} ${overdue ? 'schedule-row-overdue' : ''}`} key={task.id}>
          <time className="schedule-time" dateTime={task.scheduledAt}>{displayTime(task.scheduledAt!)}</time>
          <span className="schedule-marker" aria-hidden="true">{task.completed ? <Check size={12}/> : null}</span>
          <div className="schedule-task-copy"><strong>{task.title}</strong><span>{overdue ? 'Overdue' : task.completed ? 'Completed' : 'Scheduled'} <i>·</i> {minutesLabel(task.estimateMinutes)} <i>·</i> {task.priority} priority{workspaceName && <> <i>·</i> <b className="schedule-workspace-label">{workspaceName}</b></>}</span></div>
          <button className={`schedule-complete ${task.completed ? 'is-complete' : ''}`} type="button" onClick={() => onToggleTask(task.id)} aria-label={task.completed ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`} aria-pressed={task.completed}>{task.completed ? 'Done' : 'Complete'}</button>
        </li>
      })}
    </ol>
  }

  return <div className="schedule-canvas">
    {dayMap}
    <ol className="schedule-list schedule-agenda">
      {ordered.map((task, index) => {
        const start = new Date(task.scheduledAt!)
        const daypart = getDaypart(start)
        const previous = index > 0 ? new Date(ordered[index - 1].scheduledAt!) : null
        const showDaypart = !previous || getDaypart(previous) !== daypart
        const timestamp = start.getTime()
        const overdue = timestamp < now && !task.completed
        const workspaceName = workspaces.find((workspace) => workspace.id === task.workspaceId)?.name
        return <React.Fragment key={task.id}>
          {showDaypart && <li className="schedule-daypart-label"><span>{daypart}</span><i/></li>}
          <li className={`schedule-row agenda-row ${task.completed ? 'schedule-row-done' : ''} ${overdue ? 'schedule-row-overdue' : ''} ${task.id === nextTaskId ? 'schedule-row-next' : ''}`}>
            <div className="agenda-time-block"><time className="schedule-time" dateTime={task.scheduledAt}>{displayTime(task.scheduledAt!)}</time><span>UNTIL {getEndTime(task.scheduledAt!, task.estimateMinutes)}</span></div>
            <span className="schedule-marker" aria-hidden="true">{task.completed ? <Check size={12}/> : null}</span>
            <article className="agenda-card">
              <div className="agenda-card-top"><span className="agenda-card-state">{task.completed ? 'COMPLETE' : overdue ? 'PAST DUE' : task.id === nextTaskId ? 'UP NEXT' : 'ON THE PLAN'}</span><span className={`agenda-priority agenda-priority--${task.priority}`}><i/>{task.priority} priority</span></div>
              <h3>{task.title}</h3>
              <div className="agenda-card-footer"><span><Clock3 size={13}/>{minutesLabel(task.estimateMinutes)}</span>{workspaceName && <span className="schedule-workspace-label">{workspaceName}</span>}<button className={`schedule-complete ${task.completed ? 'is-complete' : ''}`} type="button" onClick={() => onToggleTask(task.id)} aria-label={task.completed ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`} aria-pressed={task.completed}>{task.completed ? <><Check size={13}/> Done</> : 'Complete'}</button></div>
            </article>
          </li>
        </React.Fragment>
      })}
    </ol>
  </div>
}
