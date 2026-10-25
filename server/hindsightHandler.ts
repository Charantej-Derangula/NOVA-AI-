import type http from 'node:http'
import {
  getHindsightUsageStats,
  resolveBankId,
  retainHindsightMemory,
  recallHindsightMemories,
  reflectHindsightMemories,
  deleteHindsightMemory,
} from './hindsightService.ts'

export async function readJsonBody<T = unknown>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

/**
 * Handles all /api/memory/* endpoints for both Vite dev server and standalone Node server.
 * Ensures identical behavior and zero credential leakage.
 */
export async function handleHindsightApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string
): Promise<boolean> {
  if (!pathname.startsWith('/api/memory')) {
    return false
  }

  // Common CORS and security headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return true
  }

  // 1. Memory Service Status & Telemetry
  if (pathname === '/api/memory/status' && req.method === 'GET') {
    const stats = getHindsightUsageStats()
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(stats))
    return true
  }

  // 2. Fast Recall (Retrieve relevant memories before generating AI responses)
  if (pathname === '/api/memory/recall' && req.method === 'POST') {
    try {
      const body = await readJsonBody<{
        userId?: string
        isGuest?: boolean
        guestId?: string
        query?: string
        limit?: number
        correlationId?: string
      }>(req)

      if (!body.query || typeof body.query !== 'string') {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Query string is required for memory recall.', success: false }))
        return true
      }

      const correlationId =
        (req.headers['x-correlation-id'] as string) ||
        body.correlationId ||
        `hs-rc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`

      const bankId = resolveBankId(body.userId, body.isGuest, body.guestId)
      const result = await recallHindsightMemories({
        bankId,
        query: body.query,
        limit: body.limit || 5,
        correlationId,
      })

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('X-Correlation-Id', correlationId)
      res.end(JSON.stringify(result))
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: msg, success: false, results: [] }))
      return true
    }
  }

  // 3. Selective Retain (Store useful long-term memories)
  if (pathname === '/api/memory/retain' && req.method === 'POST') {
    try {
      const body = await readJsonBody<{
        userId?: string
        isGuest?: boolean
        guestId?: string
        content?: string
        context?: string
        tags?: string[]
        correlationId?: string
      }>(req)

      if (!body.content || typeof body.content !== 'string') {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Content string is required for memory retain.', success: false }))
        return true
      }

      const correlationId =
        (req.headers['x-correlation-id'] as string) ||
        body.correlationId ||
        `hs-rt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`

      const bankId = resolveBankId(body.userId, body.isGuest, body.guestId)
      const result = await retainHindsightMemory({
        bankId,
        content: body.content,
        context: body.context,
        tags: body.tags,
        correlationId,
      })

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('X-Correlation-Id', correlationId)
      res.end(JSON.stringify(result))
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: msg, success: false, retained: false }))
      return true
    }
  }

  // 4. Reflect (Multi-memory synthesis - strictly called when synthesis is explicitly requested)
  if (pathname === '/api/memory/reflect' && req.method === 'POST') {
    try {
      const body = await readJsonBody<{
        userId?: string
        isGuest?: boolean
        guestId?: string
        query?: string
      }>(req)

      if (!body.query || typeof body.query !== 'string') {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Query string is required for reflection.', success: false }))
        return true
      }

      const bankId = resolveBankId(body.userId, body.isGuest, body.guestId)
      const result = await reflectHindsightMemories({
        bankId,
        query: body.query,
      })

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(result))
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: msg, success: false, answer: '' }))
      return true
    }
  }

  // 5. Delete Memory (Respect user privacy and deletion requests)
  if (
    (pathname === '/api/memory/delete' && req.method === 'POST') ||
    (pathname === '/api/memory' && req.method === 'DELETE')
  ) {
    try {
      const body = await readJsonBody<{
        userId?: string
        isGuest?: boolean
        guestId?: string
        memoryId?: string
      }>(req)

      if (!body.memoryId || typeof body.memoryId !== 'string') {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'memoryId is required for deletion.', success: false }))
        return true
      }

      const bankId = resolveBankId(body.userId, body.isGuest, body.guestId)
      const result = await deleteHindsightMemory({
        bankId,
        memoryId: body.memoryId,
      })

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(result))
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: msg, success: false }))
      return true
    }
  }

  return false
}
