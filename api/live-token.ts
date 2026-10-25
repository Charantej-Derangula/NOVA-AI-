import type http from 'node:http'
import { createLiveEphemeralToken } from '../server/tokenService.ts'

export default async function handler(req: http.IncomingMessage, res: http.ServerResponse) {
  // CORS and security headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method Not Allowed', code: 'METHOD_NOT_ALLOWED' }))
    return
  }

  try {
    const result = await createLiveEphemeralToken()
    if ('error' in result) {
      const statusCode = result.code === 'MISSING_API_KEY' ? 400 : 502
      res.statusCode = statusCode
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(result))
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: `Internal server error: ${message}`, code: 'INTERNAL_ERROR' }))
  }
}
