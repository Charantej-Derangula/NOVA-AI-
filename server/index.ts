import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { createLiveEphemeralToken } from './tokenService.ts'
import { streamGroqChat, validateGroqApiKey, reloadServerEnv, type ClientChatMessage } from './chatService.ts'
import { handleHindsightApi } from './hindsightHandler.ts'
import { getHindsightConfig } from './hindsightService.ts'

const PORT = Number(process.env.PORT) || 3001

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

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

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
    res.writeHead(200, { 'Content-Type': 'application/json' })
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
        const statusCode = result.code === 'MISSING_API_KEY' ? 400 : 502
        res.writeHead(statusCode, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
        return
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
      return
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `Internal server error: ${message}`, code: 'INTERNAL_ERROR' }))
      return
    }
  }

  // Text Chat Streaming Endpoint (Groq Llama 3.3 70B via SSE)
  if (url.pathname === '/api/chat' && req.method === 'POST') {
    const authCheck = validateGroqApiKey()
    if (!authCheck.valid) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(authCheck.error))
      return
    }

    try {
      const body = await readJsonBody<{ messages: ClientChatMessage[]; systemInstruction?: string }>(req)
      if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
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
      return
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: message, code: 'GENERATION_FAILED' }))
      } else if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`)
        res.end()
      }
      return
    }
  }

  // Return 404 JSON for unknown API endpoints (distinguishable from frontend routes)
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'API endpoint not found', path: url.pathname }))
    return
  }

  // Production SPA & Static Asset Serving
  if (req.method === 'GET' || req.method === 'HEAD') {
    const distDir = path.resolve(process.cwd(), 'dist')
    const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
    let targetFile = path.join(distDir, safePath)

    if (targetFile.startsWith(distDir)) {
      try {
        let stat = await fs.promises.stat(targetFile).catch(() => null)
        if (stat && stat.isDirectory()) {
          targetFile = path.join(targetFile, 'index.html')
          stat = await fs.promises.stat(targetFile).catch(() => null)
        }

        if (stat && stat.isFile()) {
          const ext = path.extname(targetFile).toLowerCase()
          const mimeTypes: Record<string, string> = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.mjs': 'application/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.webp': 'image/webp',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.map': 'application/json',
          }
          const contentType = mimeTypes[ext] || 'application/octet-stream'
          const cacheControl = targetFile.includes('/assets/')
            ? 'public, max-age=31536000, immutable'
            : 'no-cache'

          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': stat.size,
            'Cache-Control': cacheControl,
          })
          if (req.method === 'HEAD') {
            res.end()
            return
          }
          fs.createReadStream(targetFile).pipe(res)
          return
        }

        // SPA fallback: serve dist/index.html for client-side routing (e.g. /workspaces, /chat, /tasks, /settings)
        const indexFile = path.join(distDir, 'index.html')
        const indexStat = await fs.promises.stat(indexFile).catch(() => null)
        if (indexStat && indexStat.isFile()) {
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Length': indexStat.size,
            'Cache-Control': 'no-cache',
          })
          if (req.method === 'HEAD') {
            res.end()
            return
          }
          fs.createReadStream(indexFile).pipe(res)
          return
        }
      } catch {
        // Fall through to 404
      }
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('Not found. If deploying for production, ensure "npm run build" has been run before starting the server.')
})

const HOST = process.env.HOST || '127.0.0.1'

const isDirectExecution = Boolean(
  process.argv[1] &&
  (process.argv[1].endsWith('server/index.ts') || process.argv[1].endsWith('server/index.js'))
)

if (isDirectExecution || process.env.NODE_ENV === 'production') {
  server.listen(PORT, HOST, () => {
    const hasKey = Boolean(
      process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here' &&
      process.env.GEMINI_API_KEY.trim().length > 0
    )
    console.log(`[NOVA Backend] Running at http://${HOST}:${PORT}`)
    console.log(`[NOVA Backend] Endpoints: /api/live-token, /api/chat`)
    console.log(`[NOVA Backend] GEMINI_API_KEY configured: ${hasKey ? 'YES' : 'NO'}`)
  }).on('error', (err: NodeJS.ErrnoException) => {
    console.error(`[NOVA Backend] Server listen error (${err.code}):`, err.message)
  })
}

export default server
