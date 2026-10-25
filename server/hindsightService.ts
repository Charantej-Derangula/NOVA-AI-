import crypto from 'node:crypto'
import { reloadServerEnv } from './chatService.ts'

export interface HindsightConfig {
  apiKey?: string
  baseUrl: string
  bankId: string
  maxRetainPerHour: number
  maxRecallPerHour: number
  maxReflectPerHour: number
}

export interface HindsightMemoryItem {
  id: string
  text: string
  score?: number
  type?: string
  entities?: string[]
  createdAt?: string
}

interface RawHindsightEntry {
  id?: string
  text?: string
  content?: string
  score?: number
  entities?: string[]
  created_at?: string
}

interface RawHindsightPayload {
  results?: RawHindsightEntry[]
  memories?: RawHindsightEntry[]
  data?: RawHindsightEntry[]
  answer?: string
  text?: string
  sources?: Array<{ id: string; text: string }>
}

export interface HindsightRecallResponse {
  success: boolean
  results: HindsightMemoryItem[]
  total: number
  source: 'hindsight' | 'fallback'
  error?: string
  correlationId?: string
}

export interface HindsightRetainResponse {
  success: boolean
  retained: boolean
  documentId?: string
  reason?: string
  source: 'hindsight' | 'fallback'
  error?: string
  correlationId?: string
}

export interface HindsightReflectResponse {
  success: boolean
  answer: string
  sources?: Array<{ id: string; text: string }>
  source: 'hindsight' | 'fallback'
  error?: string
  correlationId?: string
}

export interface HindsightUsageStats {
  retainCalls: number
  recallCalls: number
  reflectCalls: number
  totalCalls: number
  lastCallTimestamp?: string
  isRateLimited: boolean
}

// In-memory usage tracker to protect credit balance ($54.33 quota safeguard)
const usageTracker: HindsightUsageStats = {
  retainCalls: 0,
  recallCalls: 0,
  reflectCalls: 0,
  totalCalls: 0,
  isRateLimited: false,
}

// Memory deduplication cache: bankId -> Set of content hashes
const recentRetainedHashes = new Map<string, Set<string>>()

// Rate limits per rolling hour
const RATE_LIMITS = {
  maxRetainPerHour: 60,
  maxRecallPerHour: 150,
  maxReflectPerHour: 20,
}

let hourResetTimer: NodeJS.Timeout | null = null
function ensureRateLimitResetTimer() {
  if (!hourResetTimer) {
    hourResetTimer = setInterval(() => {
      usageTracker.retainCalls = 0
      usageTracker.recallCalls = 0
      usageTracker.reflectCalls = 0
      usageTracker.isRateLimited = false
      recentRetainedHashes.clear()
    }, 60 * 60 * 1000)
    // Don't prevent process exit
    if (hourResetTimer.unref) hourResetTimer.unref()
  }
}
ensureRateLimitResetTimer()

/**
 * Validates and retrieves server-side Hindsight configuration.
 * Never exposes credentials to client bundles or browser responses.
 */
export function getHindsightConfig(forceReload = false): { isConfigured: boolean; config: HindsightConfig } {
  reloadServerEnv(forceReload)
  const apiKey = process.env.HINDSIGHT_API_KEY?.trim()
  const baseUrl = (process.env.HINDSIGHT_BASE_URL || 'https://api.hindsight.vectorize.io').trim().replace(/\/+$/, '')
  const bankId = (process.env.HINDSIGHT_BANK_ID || 'Nova').trim()

  const isConfigured = Boolean(
    apiKey &&
    apiKey !== 'your_hindsight_api_key_here' &&
    apiKey.length > 5
  )

  return {
    isConfigured,
    config: {
      apiKey,
      baseUrl,
      bankId,
      ...RATE_LIMITS,
    },
  }
}

/**
 * Returns sanitized usage metrics without exposing sensitive tokens.
 */
export function getHindsightUsageStats(): HindsightUsageStats & { isConfigured: boolean } {
  const { isConfigured } = getHindsightConfig()
  return {
    ...usageTracker,
    isConfigured,
  }
}

/**
 * Resolves the active Hindsight memory bank ID:
 * Uses the configured HINDSIGHT_BANK_ID from .env (e.g. 'Nova') when set,
 * or derives the isolated user bank ID.
 */
export function resolveBankId(userId?: string | null, isGuest = false, guestId?: string): string {
  const { config } = getHindsightConfig()
  // When a user identity or guest session is present, always guarantee user isolation.
  // Explicit fixed bankId is only used as a fallback if no user or guest is active.
  if (config.bankId && config.bankId !== 'auto' && !userId && !guestId) {
    return config.bankId
  }
  return getBankIdForUser(userId, isGuest, guestId)
}

/**
 * Generates a stable, isolated bank ID for the user.
 * Authenticated users are mapped to their Supabase user UUID.
 * Guest users are mapped to their stable guest UUID.
 * Guarantees zero cross-user memory leakage.
 */
export function getBankIdForUser(userId?: string | null, isGuest = false, guestId?: string): string {
  if (userId && !isGuest && userId !== 'guest' && userId !== 'local-guest') {
    const sanitized = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48)
    return `nova-usr-${sanitized}`
  }

  const rawGuestId = guestId || 'default-guest'
  const sanitizedGuest = rawGuestId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48)
  return `nova-gst-${sanitizedGuest}`
}

// Regex patterns to block sensitive data from ever being sent to long-term memory
const SENSITIVE_PATTERNS = [
  /\b(?:gsk|hs|sk|sb_publishable|sb_secret)[_-][a-zA-Z0-9_-]{16,}\b/i, // API keys (handles both _ and -)
  /\b(?:AIza|Bearer\s+)[a-zA-Z0-9_-]{16,}\b/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /\b(?:password|passwd|pwd)\s*(?:[:=]|\s+is\s+)\s*\S+/i,
  /\b(?:api[_-]?key|secret[_-]?key|auth[_-]?token)\s*(?:[:=]|\s+is\s+)\s*\S+/i,
  /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/, // Credit card numbers
]

// Common trivial chit-chat or UI commands that should not clutter long-term memory
const TRIVIAL_CHAT_REGEX = /^(?:hi|hello|hey(?:\s+there)?|greetings|thanks(?:\s+you)?|thank\s+you|ok|okay|cool|sure|yes|no|nope|bye|goodbye|see\s+ya|good\s+morning|good\s+night)[.!?]*$/i

/**
 * Evaluates whether text qualifies for long-term Hindsight retention under selective policy.
 */
export function evaluateRetentionPolicy(text: string): {
  shouldRetain: boolean
  reason?: string
  cleanContent?: string
} {
  const trimmed = text.trim()

  if (trimmed.length < 6) {
    return { shouldRetain: false, reason: 'Content too short for long-term retention' }
  }

  // 1. Privacy & Security: Block secrets and credentials
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        shouldRetain: false,
        reason: 'Sensitive credentials or personal privacy patterns detected',
      }
    }
  }

  // 2. Filter out trivial small-talk and greetings
  if (TRIVIAL_CHAT_REGEX.test(trimmed)) {
    return { shouldRetain: false, reason: 'Trivial small-talk ignored by retention policy' }
  }

  // 3. Filter out transient UI control commands
  if (
    /^(?:delete\s+all\s+tasks|confirm\s+delete|switch\s+to\s+workspace|clear\s+all|list\s+my\s+tasks|show\s+tasks|help)$/i.test(
      trimmed
    )
  ) {
    return { shouldRetain: false, reason: 'Ephemeral UI command ignored by retention policy' }
  }

  return {
    shouldRetain: true,
    cleanContent: trimmed,
  }
}

/**
 * Determines whether user prompt requires multi-memory synthesis (Reflect)
 * vs fast single-fact lookup (Recall).
 */
export function isReflectionQuery(prompt: string): boolean {
  const lower = prompt.toLowerCase()
  return (
    /\b(?:reflect\s+on|synthesize\s+(?:what\s+you\s+know|my\s+memories|my\s+past)|analyze\s+my\s+past\s+decisions|what\s+patterns\s+do\s+you\s+notice|summarize\s+everything\s+you\s+know\s+about\s+my|given\s+everything\s+we\s+know\s+about)\b/i.test(
      lower
    )
  )
}

/**
 * Computes SHA-256 hash for deduplication.
 */
function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content.trim().toLowerCase()).digest('hex')
}

function createCorrelationId(prefix = 'hs'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`
}

/**
 * Selectively retains long-term memory in Hindsight Cloud.
 */
export async function retainHindsightMemory(options: {
  bankId: string
  content: string
  context?: string
  tags?: string[]
  correlationId?: string
}): Promise<HindsightRetainResponse> {
  const { bankId, content, context, tags } = options
  const correlationId = options.correlationId || createCorrelationId('hs-rt')
  const { isConfigured, config } = getHindsightConfig()

  const policy = evaluateRetentionPolicy(content)
  if (!policy.shouldRetain) {
    console.log(`[Hindsight] [${correlationId}] Retain skipped by policy: ${policy.reason || 'Filtered'}`)
    return {
      success: true,
      retained: false,
      reason: policy.reason,
      source: 'fallback',
      correlationId,
    }
  }

  // Check deduplication cache
  const contentHash = hashContent(policy.cleanContent || content)
  let bankHashes = recentRetainedHashes.get(bankId)
  if (!bankHashes) {
    bankHashes = new Set()
    recentRetainedHashes.set(bankId, bankHashes)
  }

  if (bankHashes.has(contentHash)) {
    console.log(`[Hindsight] [${correlationId}] Retain skipped: Deduplicated (already retained in bank "${bankId}")`)
    return {
      success: true,
      retained: false,
      reason: 'Memory already retained recently (deduplicated)',
      source: isConfigured ? 'hindsight' : 'fallback',
      correlationId,
    }
  }

  if (!isConfigured) {
    // Record locally in cache without crashing
    bankHashes.add(contentHash)
    console.log(`[Hindsight] [${correlationId}] Retain recorded locally (unconfigured API key)`)
    return {
      success: true,
      retained: true,
      reason: 'Hindsight API key not configured; operation safely recorded via local Supabase store.',
      source: 'fallback',
      correlationId,
    }
  }

  // Check credit / budget protection rate limit
  if (usageTracker.retainCalls >= config.maxRetainPerHour) {
    usageTracker.isRateLimited = true
    console.warn(`[Hindsight] [${correlationId}] Retain rate limit reached (${config.maxRetainPerHour}/hr quota)`)
    return {
      success: false,
      retained: false,
      reason: 'Hourly retention quota reached to safeguard credit balance.',
      source: 'hindsight',
      error: 'RATE_LIMIT_EXCEEDED',
      correlationId,
    }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout for AI vectorization & entity extraction

    const bodyPayload = {
      items: [
        {
          content: policy.cleanContent || content,
          context: context || 'NOVA executive assistant memory',
          tags: tags || ['nova', 'assistant'],
        },
      ],
    }

    const url = `${config.baseUrl}/v1/default/banks/${encodeURIComponent(bankId)}/memories`
    console.log(`[Hindsight] [${correlationId}] Retain start | bankId="${bankId}" | items=${bodyPayload.items.length}`)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    usageTracker.retainCalls += 1
    usageTracker.totalCalls += 1
    usageTracker.lastCallTimestamp = new Date().toISOString()

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.warn(`[Hindsight] [${correlationId}] Retain failed | status=${res.status}`)
      if (res.status === 402) {
        return {
          success: false,
          retained: false,
          error: 'INSUFFICIENT_CREDITS',
          reason: 'Hindsight account has insufficient credits. Retained in local store.',
          source: 'hindsight',
          correlationId,
        }
      }
      if (res.status === 429) {
        usageTracker.isRateLimited = true
        return {
          success: false,
          retained: false,
          error: 'RATE_LIMITED',
          reason: 'Hindsight rate limit encountered. Falling back to local store.',
          source: 'hindsight',
          correlationId,
        }
      }

      // Try alternate endpoint /v1/banks/{bankId}/retain
      try {
        const altUrl = `${config.baseUrl}/v1/banks/${encodeURIComponent(bankId)}/retain`
        const altRes = await fetch(altUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            content: policy.cleanContent || content,
            context: context || 'NOVA memory',
            tags,
          }),
        })
        if (altRes.ok) {
          bankHashes.add(contentHash)
          console.log(`[Hindsight] [${correlationId}] Retain succeeded via alternate endpoint | status=${altRes.status}`)
          return { success: true, retained: true, source: 'hindsight', correlationId }
        }
      } catch {
        // Fall back below
      }

      return {
        success: false,
        retained: false,
        error: `Hindsight HTTP ${res.status}: ${errText.slice(0, 120)}`,
        source: 'hindsight',
        correlationId,
      }
    }

    bankHashes.add(contentHash)
    const json = (await res.json().catch(() => ({}))) as { document_id?: string; id?: string }
    console.log(`[Hindsight] [${correlationId}] Retain outcome: ${res.status} | success=true | docId=${json.document_id || json.id || 'indexed'}`)
    return {
      success: true,
      retained: true,
      documentId: json.document_id || json.id,
      source: 'hindsight',
      correlationId,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[Hindsight] [${correlationId}] Retain exception: ${msg}`)
    return {
      success: false,
      retained: false,
      error: `Hindsight retention failed: ${msg}`,
      source: 'hindsight',
      correlationId,
    }
  }
}

/**
 * Fast multi-strategy recall of relevant facts from Hindsight Cloud (no LLM synthesis).
 */
export async function recallHindsightMemories(options: {
  bankId: string
  query: string
  limit?: number
  correlationId?: string
}): Promise<HindsightRecallResponse> {
  const { bankId, query, limit = 5 } = options
  const correlationId = options.correlationId || createCorrelationId('hs-rc')
  const { isConfigured, config } = getHindsightConfig()

  if (!isConfigured) {
    console.log(`[Hindsight] [${correlationId}] Recall fallback (unconfigured API key)`)
    return {
      success: true,
      results: [],
      total: 0,
      source: 'fallback',
      error: 'Hindsight not configured',
      correlationId,
    }
  }

  if (usageTracker.recallCalls >= config.maxRecallPerHour) {
    console.warn(`[Hindsight] [${correlationId}] Recall rate limit reached (${config.maxRecallPerHour}/hr quota)`)
    return {
      success: false,
      results: [],
      total: 0,
      source: 'hindsight',
      error: 'Recall quota limit reached to protect credit balance',
      correlationId,
    }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

    const url = `${config.baseUrl}/v1/default/banks/${encodeURIComponent(bankId)}/memories/recall`
    console.log(`[Hindsight] [${correlationId}] Recall start | bankId="${bankId}" | limit=${limit}`)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ query, limit }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    usageTracker.recallCalls += 1
    usageTracker.totalCalls += 1
    usageTracker.lastCallTimestamp = new Date().toISOString()

    if (!res.ok) {
      console.warn(`[Hindsight] [${correlationId}] Recall failed | status=${res.status}`)
      // Try alternate endpoint /v1/banks/{bankId}/recall
      try {
        const altUrl = `${config.baseUrl}/v1/banks/${encodeURIComponent(bankId)}/recall`
        const altRes = await fetch(altUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({ query, limit }),
        })
        if (altRes.ok) {
          const altJson = (await altRes.json()) as RawHindsightPayload
          const rawItems = Array.isArray(altJson.results)
            ? altJson.results
            : Array.isArray(altJson.memories)
            ? altJson.memories
            : Array.isArray(altJson.data)
            ? altJson.data
            : Array.isArray(altJson)
            ? (altJson as RawHindsightEntry[])
            : []
          const mapped: HindsightMemoryItem[] = rawItems.map((r: RawHindsightEntry) => ({
            id: r.id || `mem-${Date.now()}`,
            text: r.text || r.content || String(r),
            score: r.score,
            entities: r.entities,
            createdAt: r.created_at,
          }))
          const bounded = mapped.slice(0, limit)
          console.log(`[Hindsight] [${correlationId}] Recall succeeded via alternate endpoint | resultsCount=${bounded.length}`)
          return { success: true, results: bounded, total: bounded.length, source: 'hindsight', correlationId }
        }
      } catch {
        // Fall back below
      }

      return {
        success: false,
        results: [],
        total: 0,
        source: 'hindsight',
        error: `Hindsight Recall HTTP ${res.status}`,
        correlationId,
      }
    }

    const json = (await res.json()) as RawHindsightPayload
    const rawList = Array.isArray(json.results)
      ? json.results
      : Array.isArray(json.memories)
      ? json.memories
      : Array.isArray(json.data)
      ? json.data
      : Array.isArray(json)
      ? (json as RawHindsightEntry[])
      : []
    const mappedList: HindsightMemoryItem[] = rawList.map((item: RawHindsightEntry) => ({
      id: item.id || `mem-${Date.now()}`,
      text: item.text || item.content || String(item),
      score: item.score,
      entities: item.entities,
      createdAt: item.created_at,
    }))

    const boundedList = mappedList.slice(0, limit)
    console.log(`[Hindsight] [${correlationId}] Recall outcome: ${res.status} | resultsCount=${boundedList.length}`)
    return {
      success: true,
      results: boundedList,
      total: boundedList.length,
      source: 'hindsight',
      correlationId,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[Hindsight] [${correlationId}] Recall exception: ${msg}`)
    return {
      success: false,
      results: [],
      total: 0,
      source: 'hindsight',
      error: `Recall error: ${msg}`,
      correlationId,
    }
  }
}

/**
 * Reflect over memory bank to synthesize cross-cutting conclusions.
 * STRICT: Only called when the user explicitly requests synthesis across multiple memories.
 */
export async function reflectHindsightMemories(options: {
  bankId: string
  query: string
}): Promise<HindsightReflectResponse> {
  const { bankId, query } = options
  const { isConfigured, config } = getHindsightConfig()

  if (!isConfigured) {
    return {
      success: false,
      answer: '',
      source: 'fallback',
      error: 'Hindsight not configured',
    }
  }

  if (usageTracker.reflectCalls >= config.maxReflectPerHour) {
    return {
      success: false,
      answer: '',
      source: 'hindsight',
      error: 'Reflect quota limit reached to protect credit balance',
    }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000) // 20s for reflection LLM

    const url = `${config.baseUrl}/v1/default/banks/${encodeURIComponent(bankId)}/reflect`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    usageTracker.reflectCalls += 1
    usageTracker.totalCalls += 1
    usageTracker.lastCallTimestamp = new Date().toISOString()

    if (!res.ok) {
      // Try alternate endpoint /v1/banks/{bankId}/reflect
      try {
        const altUrl = `${config.baseUrl}/v1/banks/${encodeURIComponent(bankId)}/reflect`
        const altRes = await fetch(altUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({ query }),
        })
        if (altRes.ok) {
          const altJson = (await altRes.json()) as RawHindsightPayload
          return {
            success: true,
            answer: altJson.answer || altJson.text || '',
            sources: altJson.sources,
            source: 'hindsight',
          }
        }
      } catch {
        // Fall back below
      }

      return {
        success: false,
        answer: '',
        source: 'hindsight',
        error: `Hindsight Reflect HTTP ${res.status}`,
      }
    }

    const json = (await res.json()) as RawHindsightPayload
    return {
      success: true,
      answer: json.answer || json.text || '',
      sources: json.sources,
      source: 'hindsight',
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      answer: '',
      source: 'hindsight',
      error: `Reflect error: ${msg}`,
    }
  }
}

/**
 * Deletes a memory or purged concept from Hindsight Cloud.
 */
export async function deleteHindsightMemory(options: {
  bankId: string
  memoryId: string
}): Promise<{ success: boolean; error?: string; source: 'hindsight' | 'fallback' }> {
  const { bankId, memoryId } = options
  const { isConfigured, config } = getHindsightConfig()

  if (!isConfigured) {
    return { success: true, source: 'fallback' }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)

    const url = `${config.baseUrl}/v1/default/banks/${encodeURIComponent(bankId)}/memories/${encodeURIComponent(memoryId)}`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok && res.status !== 404) {
      return { success: false, error: `Hindsight Delete HTTP ${res.status}`, source: 'hindsight' }
    }

    return { success: true, source: 'hindsight' }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg, source: 'hindsight' }
  }
}
