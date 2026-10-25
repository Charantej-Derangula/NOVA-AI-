import type http from 'node:http'
import { reloadServerEnv } from '../server/chatService.ts'
import { getHindsightConfig } from '../server/hindsightService.ts'

export default async function handler(req: http.IncomingMessage, res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method Not Allowed' }))
    return
  }

  reloadServerEnv()
  const hasGeminiKey = Boolean(
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here' &&
    process.env.GEMINI_API_KEY.trim().length > 0
  )
  const hasGroqKey = Boolean(
    process.env.GROQ_API_KEY &&
    process.env.GROQ_API_KEY !== 'your_groq_api_key_here' &&
    process.env.GROQ_API_KEY.trim().length > 0
  )
  const { isConfigured: hasHindsightKey } = getHindsightConfig()

  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({
    status: 'ok',
    hasKey: hasGeminiKey,
    hasGeminiKey,
    hasGroqKey,
    hasApiKey: hasGroqKey,
    hasHindsightKey,
    timestamp: new Date().toISOString(),
  }))
}
