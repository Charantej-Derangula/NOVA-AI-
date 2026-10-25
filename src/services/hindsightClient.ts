import { getCurrentAuthInfo } from '../lib/supabaseClient.ts'

export interface HindsightClientMemoryItem {
  id: string
  text: string
  score?: number
  type?: string
  entities?: string[]
  createdAt?: string
}

export interface HindsightClientRecallResult {
  success: boolean
  results: HindsightClientMemoryItem[]
  total: number
  source: 'hindsight' | 'fallback'
  error?: string
}

export interface HindsightClientRetainResult {
  success: boolean
  retained: boolean
  documentId?: string
  reason?: string
  source: 'hindsight' | 'fallback'
  error?: string
}

export interface HindsightClientReflectResult {
  success: boolean
  answer: string
  sources?: Array<{ id: string; text: string }>
  source: 'hindsight' | 'fallback'
  error?: string
}

export interface HindsightClientStatus {
  isConfigured: boolean
  retainCalls: number
  recallCalls: number
  reflectCalls: number
  totalCalls: number
  lastCallTimestamp?: string
  isRateLimited: boolean
}

const GUEST_ID_STORAGE_KEY = 'nova:guest-user-id:v1'

/**
 * Retrieves or initializes a stable UUID for guest sessions to guarantee
 * consistent per-user memory bank isolation without cross-user leakage.
 */
export function getStableGuestId(): string {
  try {
    const existing = localStorage.getItem(GUEST_ID_STORAGE_KEY)
    if (existing && existing.trim().length > 0) {
      return existing.trim()
    }
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `guest-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    localStorage.setItem(GUEST_ID_STORAGE_KEY, generated)
    return generated
  } catch {
    return 'fallback-guest-user'
  }
}

/**
 * Derives current user identity tokens for memory bank routing.
 */
export async function getActiveUserIdentifiers(): Promise<{
  userId?: string
  isGuest: boolean
  guestId?: string
}> {
  try {
    const auth = await getCurrentAuthInfo()
    if (auth.isAuthenticated && auth.userId && !auth.isAnonymous) {
      return {
        userId: auth.userId,
        isGuest: false,
      }
    }
  } catch {
    // Continue with guest mapping
  }

  return {
    isGuest: true,
    guestId: getStableGuestId(),
  }
}

/**
 * Checks server-side Hindsight Cloud telemetry and budget status.
 */
export async function getHindsightMemoryStatus(): Promise<HindsightClientStatus> {
  try {
    const res = await fetch('/api/memory/status')
    if (res.ok) {
      return await res.json()
    }
  } catch (err) {
    console.warn('[NOVA Hindsight] Failed to fetch memory status:', err)
  }

  return {
    isConfigured: false,
    retainCalls: 0,
    recallCalls: 0,
    reflectCalls: 0,
    totalCalls: 0,
    isRateLimited: false,
  }
}

function getEndpointUrl(path: string): string {
  if (typeof window !== 'undefined') {
    return path
  }
  const host = typeof process !== 'undefined' && process.env?.HOST ? process.env.HOST : '127.0.0.1'
  const port = typeof process !== 'undefined' && process.env?.PORT ? process.env.PORT : 3001
  return `http://${host}:${port}${path}`
}

/**
 * Recalls relevant memories from Hindsight Cloud before generating an AI response.
 * Uses fast semantic retrieval without calling LLMs.
 */
export async function recallMemories(
  query: string,
  limit = 5
): Promise<HindsightClientRecallResult> {
  if (!query || !query.trim()) {
    return { success: true, results: [], total: 0, source: 'fallback' }
  }

  const userIds = await getActiveUserIdentifiers()

  try {
    const res = await fetch(getEndpointUrl('/api/memory/recall'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...userIds,
        query: query.trim(),
        limit,
      }),
    })

    if (res.ok) {
      return await res.json()
    }

    const errData = await res.json().catch(() => ({}))
    return {
      success: false,
      results: [],
      total: 0,
      source: 'fallback',
      error: errData.error || `HTTP ${res.status}`,
    }
  } catch (err) {
    if (typeof window === 'undefined') {
      try {
        const srv = await import(/* @vite-ignore */ '../../server/hindsightService.ts')
        const bankId = srv.resolveBankId(userIds.userId, userIds.isGuest, userIds.guestId)
        const directRes = await srv.recallHindsightMemories({ bankId, query: query.trim(), limit })
        return directRes
      } catch {
        // Fall back below
      }
    }

    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      results: [],
      total: 0,
      source: 'fallback',
      error: msg,
    }
  }
}

/**
 * Selectively retains long-term conversational memory in Hindsight Cloud.
 * Adheres to selective retention policies and credit protection quotas.
 */
export async function retainMemory(
  content: string,
  context?: string,
  tags?: string[]
): Promise<HindsightClientRetainResult> {
  if (!content || !content.trim()) {
    return { success: true, retained: false, reason: 'Empty content', source: 'fallback' }
  }

  const userIds = await getActiveUserIdentifiers()

  try {
    const res = await fetch(getEndpointUrl('/api/memory/retain'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...userIds,
        content: content.trim(),
        context,
        tags,
      }),
    })

    if (res.ok) {
      return await res.json()
    }

    const errData = await res.json().catch(() => ({}))
    return {
      success: false,
      retained: false,
      source: 'fallback',
      error: errData.error || `HTTP ${res.status}`,
      reason: errData.reason,
    }
  } catch (err) {
    if (typeof window === 'undefined') {
      try {
        const srv = await import(/* @vite-ignore */ '../../server/hindsightService.ts')
        const bankId = srv.resolveBankId(userIds.userId, userIds.isGuest, userIds.guestId)
        const directRes = await srv.retainHindsightMemory({
          bankId,
          content: content.trim(),
          context,
          tags,
        })
        return directRes
      } catch {
        // Fall back below
      }
    }

    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      retained: false,
      source: 'fallback',
      error: msg,
    }
  }
}

/**
 * Synthesizes cross-cutting conclusions across multiple memories.
 * GATED: Only invoked when the prompt explicitly asks for memory synthesis.
 */
export async function reflectMemories(query: string): Promise<HindsightClientReflectResult> {
  if (!query || !query.trim()) {
    return { success: false, answer: '', source: 'fallback', error: 'Empty query' }
  }

  try {
    const userIds = await getActiveUserIdentifiers()
    const res = await fetch('/api/memory/reflect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...userIds,
        query: query.trim(),
      }),
    })

    if (res.ok) {
      return await res.json()
    }

    const errData = await res.json().catch(() => ({}))
    return {
      success: false,
      answer: '',
      source: 'fallback',
      error: errData.error || `HTTP ${res.status}`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      answer: '',
      source: 'fallback',
      error: msg,
    }
  }
}

/**
 * Removes a memory item from Hindsight Cloud to respect deletion requests.
 */
export async function deleteMemory(
  memoryId: string
): Promise<{ success: boolean; source: 'hindsight' | 'fallback'; error?: string }> {
  if (!memoryId || !memoryId.trim()) {
    return { success: true, source: 'fallback' }
  }

  try {
    const userIds = await getActiveUserIdentifiers()
    const res = await fetch('/api/memory/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...userIds,
        memoryId: memoryId.trim(),
      }),
    })

    if (res.ok) {
      return await res.json()
    }

    const errData = await res.json().catch(() => ({}))
    return {
      success: false,
      source: 'fallback',
      error: errData.error || `HTTP ${res.status}`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      source: 'fallback',
      error: msg,
    }
  }
}

/**
 * Client-side detector for reflection synthesis queries.
 */
export function isReflectionQuery(prompt: string): boolean {
  const lower = prompt.toLowerCase()
  return (
    /\b(?:reflect\s+on|synthesize\s+(?:what\s+you\s+know|my\s+memories|my\s+past)|analyze\s+my\s+past\s+decisions|what\s+patterns\s+do\s+you\s+notice|summarize\s+everything\s+you\s+know\s+about\s+my|given\s+everything\s+we\s+know\s+about)\b/i.test(
      lower
    )
  )
}
