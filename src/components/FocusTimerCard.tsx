import React from 'react'
import { Clock3, Pause, Play } from 'lucide-react'
import type { FocusTimerState } from '../types'
import { formatDuration, localDateKey } from '../utils/dateTime'
import { readSystemTime, useSystemTime } from '../hooks/useSystemTime'

interface FocusTimerCardProps {
  focusTimer: FocusTimerState
  onFocusTimerChange: React.Dispatch<React.SetStateAction<FocusTimerState>>
}

export const FocusTimerCard: React.FC<FocusTimerCardProps> = ({ focusTimer, onFocusTimerChange }) => {
  const now = useSystemTime(focusTimer.startedAt ? 1000 : 60_000)
  const todayKey = localDateKey(new Date(now))
  const liveSeconds = focusTimer.elapsedSeconds + (focusTimer.startedAt ? Math.max(0, Math.floor((now - focusTimer.startedAt) / 1000)) : 0)
  const focusToday = (focusTimer.totalsByDate[todayKey] ?? 0) + (focusTimer.startedDate === todayKey && focusTimer.startedAt ? Math.max(0, Math.floor((now - focusTimer.startedAt) / 1000)) : 0)

  const toggleFocus = () => {
    const timestamp = readSystemTime()
    if (focusTimer.startedAt) {
      const elapsed = focusTimer.elapsedSeconds + Math.max(0, Math.floor((timestamp - focusTimer.startedAt) / 1000))
      const dateKey = focusTimer.startedDate ?? todayKey
      onFocusTimerChange((current) => ({
        ...current,
        startedAt: null,
        startedDate: null,
        elapsedSeconds: 0,
        totalsByDate: { ...current.totalsByDate, [dateKey]: (current.totalsByDate[dateKey] ?? 0) + elapsed },
      }))
    } else {
      onFocusTimerChange((current) => ({ ...current, startedAt: timestamp, startedDate: todayKey, elapsedSeconds: 0 }))
    }
  }

  return <article className={`metric-card focus-card ${focusTimer.startedAt ? 'focus-card-running' : ''}`}>
    <div className="metric-card-glow" aria-hidden="true"/>
    <div className="metric-label"><Clock3 size={15}/> Focus today<span className={`metric-state ${focusTimer.startedAt ? 'is-live' : ''}`}><i/>{focusTimer.startedAt ? 'Live' : 'Tracked'}</span></div>
    <strong>{formatDuration(focusToday)}</strong>
    <span className="metric-note">{focusTimer.startedAt ? `${formatDuration(liveSeconds)} in this session` : 'Time adds up while the timer runs'}</span>
    <button className="focus-control" type="button" onClick={toggleFocus} aria-label={focusTimer.startedAt ? 'Pause focus timer' : 'Start focus timer'}>{focusTimer.startedAt ? <Pause size={14}/> : <Play size={14}/>} {focusTimer.startedAt ? 'Pause focus' : 'Start focus'}</button>
  </article>
}
