import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import type http from 'node:http'
import { createLiveEphemeralToken } from './server/tokenService.ts'
import { streamGroqChat, validateGroqApiKey, reloadServerEnv, type ClientChatMessage } from './server/chatService.ts'
import { handleHindsightApi } from './server/hindsightHandler.ts'
import { getHindsightConfig } from './server/hindsightService.ts'

async function readJsonBody<T = unknown>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function geminiLiveTokenPlugin(): Plugin {
  return {
    name: 'gemini-live-token-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`)

        if (await handleHindsightApi(req, res, url.pathname)) {
          return
        }

        if (url.pathname === '/api/health' && req.method === 'GET') {
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
          return
        }

        if (url.pathname === '/api/live-token' && (req.method === 'GET' || req.method === 'POST')) {
          try {
            const result = await createLiveEphemeralToken()
            if ('error' in result) {
              res.statusCode = result.code === 'MISSING_API_KEY' ? 400 : 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(result))
              return
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(result))
            return
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: `Internal server error: ${message}`, code: 'INTERNAL_ERROR' }))
            return
          }
        }

        // Text Chat Streaming Endpoint (Groq Llama 3.3 70B via SSE)
        if (url.pathname === '/api/chat' && req.method === 'POST') {
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

            res.statusCode = 200
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
            res.setHeader('Cache-Control', 'no-cache, no-transform')
            res.setHeader('Connection', 'keep-alive')
            res.setHeader('X-Accel-Buffering', 'no')

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
            return
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
            return
          }
        }

        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    geminiLiveTokenPlugin(),
  ],
})
