import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

export type LocalSaveStatus = 'saved' | 'unavailable'

/** Known legacy and alternative storage keys for safe migration and data recovery. */
export const LEGACY_STORAGE_KEYS: Record<string, string[]> = {
  'nova:tasks:v1': ['nova:tasks', 'nova_tasks', 'nova-tasks', 'tasks'],
  'nova:sessions:v1': ['nova:sessions', 'nova_sessions', 'nova-sessions', 'sessions', 'nova:chats'],
  'nova:current-session:v1': ['nova:current-session', 'nova_current_session', 'nova-current-session'],
  'nova:memories:v1': ['nova:memories', 'nova_memories', 'nova-memories', 'memories'],
  'nova:knowledge:v1': ['nova:knowledge', 'nova_knowledge', 'nova-knowledge', 'knowledge', 'nova:notes:v1', 'nova:notes', 'nova_notes', 'notes'],
  'nova:workspaces:v1': ['nova:workspaces', 'nova_workspaces', 'nova-workspaces', 'workspaces'],
  'nova:active-workspace:v1': ['nova:active-workspace', 'nova_active_workspace', 'nova-active-workspace'],
  'nova:preferences:v1': ['nova:preferences', 'nova_preferences', 'preferences'],
  'nova:focus-timer:v1': ['nova:focus-timer', 'nova_focus_timer', 'nova-focus-timer'],
  'nova:active-tab:v1': ['nova:active-tab', 'nova_active_tab'],
}

export function getSafeStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
      return (globalThis as unknown as { localStorage: Storage }).localStorage
    }
    return null
  } catch {
    return null
  }
}

/**
 * Safely read a value from storage with automatic legacy key recovery and corruption protection.
 * Never overwrites a recoverable dataset with an empty default state.
 */
export function readStoredValue<T>(key: string, fallback: T): T {
  const storage = getSafeStorage()
  if (!storage) return fallback

  try {
    const stored = storage.getItem(key)
    if (stored !== null) {
      try {
        const parsed = JSON.parse(stored) as T
        // If parsed value is a non-empty array or an object/primitive, return it
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
        // If parsed value is an empty array, check if legacy keys have recoverable records
        if (Array.isArray(parsed) && parsed.length === 0) {
          const legacyKeys = LEGACY_STORAGE_KEYS[key] || []
          for (const legacyKey of legacyKeys) {
            const legacyVal = storage.getItem(legacyKey)
            if (legacyVal !== null) {
              try {
                const legacyParsed = JSON.parse(legacyVal) as T
                if (Array.isArray(legacyParsed) && legacyParsed.length > 0) {
                  // Recover legacy data into canonical key
                  storage.setItem(key, JSON.stringify(legacyParsed))
                  return legacyParsed
                }
              } catch {
                // Ignore corrupt legacy key
              }
            }
          }
        }
        return parsed
      } catch (parseError) {
        // Prevent accidental permanent loss of corrupt data: preserve backup
        try {
          storage.setItem(`${key}:backup-corrupt-${Date.now()}`, stored)
        } catch {
          // Storage write error
        }
        console.warn(`[NOVA Storage] Failed to parse stored value for "${key}". Created backup.`, parseError)
      }
    }

    // Check legacy fallback keys if canonical key is missing
    const legacyKeys = LEGACY_STORAGE_KEYS[key] || []
    for (const legacyKey of legacyKeys) {
      const legacyVal = storage.getItem(legacyKey)
      if (legacyVal !== null) {
        try {
          const legacyParsed = JSON.parse(legacyVal) as T
          if (legacyParsed !== null && (!Array.isArray(legacyParsed) || legacyParsed.length > 0)) {
            // Migrate to canonical key without deleting legacy key
            storage.setItem(key, JSON.stringify(legacyParsed))
            return legacyParsed
          }
        } catch {
          // Continue checking next legacy key
        }
      }
    }

    return fallback
  } catch {
    return fallback
  }
}

/**
 * Automatically backs up current data into a snapshot key so all items have redundant recovery.
 */
export function createStorageSnapshot(): void {
  const storage = getSafeStorage()
  if (!storage) return
  try {
    const snapshot: Record<string, unknown> = {
      product: 'NOVA',
      version: '1.0.0',
      snapshotAt: new Date().toISOString(),
    }
    const keys = [
      'nova:tasks:v1',
      'nova:memories:v1',
      'nova:knowledge:v1',
      'nova:workspaces:v1',
      'nova:sessions:v1',
      'nova:preferences:v1',
      'nova:focus-timer:v1',
      'nova:active-workspace:v1',
    ]
    for (const k of keys) {
      const raw = storage.getItem(k)
      if (raw !== null) {
        try {
          snapshot[k] = JSON.parse(raw)
        } catch {
          snapshot[k] = raw
        }
      }
    }
    storage.setItem('nova:snapshot:latest', JSON.stringify(snapshot))
  } catch {
    // Quota or unavailable
  }
}

/**
 * Restore an exported JSON backup or snapshot into canonical storage keys.
 */
export function restoreStorageBackup(backupJson: string): {
  success: boolean
  counts: { tasks: number; memories: number; knowledge: number; workspaces: number; sessions: number }
  error?: string
} {
  const storage = getSafeStorage()
  if (!storage) {
    return {
      success: false,
      counts: { tasks: 0, memories: 0, knowledge: 0, workspaces: 0, sessions: 0 },
      error: 'Browser storage is unavailable in this environment.',
    }
  }

  try {
    const parsed = JSON.parse(backupJson) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') {
      return {
        success: false,
        counts: { tasks: 0, memories: 0, knowledge: 0, workspaces: 0, sessions: 0 },
        error: 'Invalid backup file: not a JSON object.',
      }
    }

    // Extract arrays from either canonical keys or property names
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : Array.isArray(parsed['nova:tasks:v1']) ? parsed['nova:tasks:v1'] : []
    const memories = Array.isArray(parsed.memories) ? parsed.memories : Array.isArray(parsed['nova:memories:v1']) ? parsed['nova:memories:v1'] : []
    const knowledge = Array.isArray(parsed.knowledge) ? parsed.knowledge : Array.isArray(parsed['nova:knowledge:v1']) ? parsed['nova:knowledge:v1'] : []
    const workspaces = Array.isArray(parsed.workspaces) ? parsed.workspaces : Array.isArray(parsed['nova:workspaces:v1']) ? parsed['nova:workspaces:v1'] : []
    const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : Array.isArray(parsed['nova:sessions:v1']) ? parsed['nova:sessions:v1'] : []

    if (tasks.length > 0) storage.setItem('nova:tasks:v1', JSON.stringify(tasks))
    if (memories.length > 0) storage.setItem('nova:memories:v1', JSON.stringify(memories))
    if (knowledge.length > 0) storage.setItem('nova:knowledge:v1', JSON.stringify(knowledge))
    if (workspaces.length > 0) storage.setItem('nova:workspaces:v1', JSON.stringify(workspaces))
    if (sessions.length > 0) storage.setItem('nova:sessions:v1', JSON.stringify(sessions))

    createStorageSnapshot()

    return {
      success: true,
      counts: {
        tasks: tasks.length,
        memories: memories.length,
        knowledge: knowledge.length,
        workspaces: workspaces.length,
        sessions: sessions.length,
      },
    }
  } catch (err) {
    return {
      success: false,
      counts: { tasks: 0, memories: 0, knowledge: 0, workspaces: 0, sessions: 0 },
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Keep the interface useful offline and preserve real user changes between visits. */
export function useLocalStorageState<T>(
  key: string,
  initialValue: T | (() => T),
): [T, Dispatch<SetStateAction<T>>, LocalSaveStatus] {
  const [value, setValue] = useState<T>(() => {
    const fallback = typeof initialValue === 'function'
      ? (initialValue as () => T)()
      : initialValue
    return readStoredValue(key, fallback)
  })
  const [saveStatus, setSaveStatus] = useState<LocalSaveStatus>(() => (getSafeStorage() ? 'saved' : 'unavailable'))

  useEffect(() => {
    const storage = getSafeStorage()
    if (!storage) {
      return
    }

    let nextStatus: LocalSaveStatus = 'saved'
    try {
      storage.setItem(key, JSON.stringify(value))
      // Periodically keep latest snapshot up to date
      if (Array.isArray(value) && value.length > 0) {
        createStorageSnapshot()
      }
    } catch {
      nextStatus = 'unavailable'
    }
    if (nextStatus !== saveStatus) {
      const updateStatus = window.setTimeout(() => setSaveStatus(nextStatus), 0)
      return () => window.clearTimeout(updateStatus)
    }
  }, [key, value, saveStatus])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncFromAnotherTab = (event: StorageEvent) => {
      if (event.key !== key || event.newValue === null) return
      try {
        setValue(JSON.parse(event.newValue) as T)
      } catch {
        // Ignore a malformed update from another browser tab.
      }
    }
    window.addEventListener('storage', syncFromAnotherTab)
    return () => window.removeEventListener('storage', syncFromAnotherTab)
  }, [key])

  return [value, setValue, saveStatus]
}
