import type http from 'node:http'
import {
  streamGroqChat,
  validateGroqApiKey,
  type ClientChatMessage,
} from '../server/chatService.ts'
import { readJsonBody } from '../server/hindsightHandler.ts'

export default async function handler(req: http.IncomingMessage, res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method Not Allowed' }))
    return
  }

  const authCheck = validateGroqApiKey()
  if (!authCheck.valid) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(authCheck.error))
    return
  }

  try {
    const body = await readJsonBody<{ messages: ClientChatMessage[]; systemInstruction?: string }>(req)
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Messages array is required.', code: 'INVALID_REQUEST' }))
      return
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    const abortController = new AbortController()
    req.on('close', () => {
      abortController.abort()
    })

    for await (const chunk of streamGroqChat(
      { messages: body.messages, systemInstruction: body.systemInstruction },
      abortController.signal
    )) {
      if (res.writableEnded) break
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`)
    }

    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n')
      res.end()
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: message, code: 'GENERATION_FAILED' }))
    } else if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`)
      res.end()
    }
  }
}
