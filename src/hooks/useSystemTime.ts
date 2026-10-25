import { useEffect, useState } from 'react'

/** Read wall-clock time outside render, then refresh at a deliberate interval. */
export const readSystemTime = () => Date.now()

export function useSystemTime(intervalMs = 60_000) {
  const [time, setTime] = useState(() => readSystemTime())

  useEffect(() => {
    const interval = window.setInterval(() => setTime(readSystemTime()), intervalMs)
    return () => {
      window.clearInterval(interval)
    }
  }, [intervalMs])

  return time
}
