import { describe, it } from 'node:test'
import assert from 'node:assert'
import { EventEmitter } from 'node:events'
import server from '../server/index.ts'

interface SimulatedResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
}

function simulateRequest(
  method: string,
  urlPath: string,
  bodyObj?: unknown
): Promise<SimulatedResponse> {
  return new Promise<SimulatedResponse>((resolve) => {
    const req = new EventEmitter() as unknown as Record<string, unknown>
    req.method = method
    req.url = urlPath
    req.headers = { host: 'localhost' }

    let statusCode = 200
    const headers: Record<string, string> = {}
    let body = ''

    const res = new EventEmitter() as unknown as Record<string, unknown>
    res.setHeader = (k: string, v: string) => {
      headers[k.toLowerCase()] = v
    }
    res.writeHead = (code: number, hdrs?: Record<string, string>) => {
      statusCode = code
      if (hdrs) {
        for (const [k, v] of Object.entries(hdrs)) {
          headers[k.toLowerCase()] = v
        }
      }
    }
    res.write = (chunk: string | Buffer) => {
      body += chunk.toString()
    }
    res.end = (chunk?: string | Buffer) => {
      if (chunk) body += chunk.toString()
      res.writableEnded = true
      resolve({ statusCode, headers, body })
    }

    server.emit('request', req, res)

    process.nextTick(() => {
      if (bodyObj !== undefined) {
        (req as EventEmitter).emit('data', JSON.stringify(bodyObj))
      }
      (req as EventEmitter).emit('end')
    })
  })
}

describe('Production Server & SPA Routing Architecture', () => {
  it('distinguishes unknown API endpoints with 404 JSON', async () => {
    const res = await simulateRequest('GET', '/api/unknown-endpoint-test')

    assert.strictEqual(res.statusCode, 404)
    assert.strictEqual(res.headers['content-type'], 'application/json')
    const json = JSON.parse(res.body)
    assert.strictEqual(json.error, 'API endpoint not found')
    assert.strictEqual(json.path, '/api/unknown-endpoint-test')
  })

  it('serves health status on /api/health with expected keys', async () => {
    const res = await simulateRequest('GET', '/api/health')

    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.headers['content-type'], 'application/json')
    const json = JSON.parse(res.body)
    assert.strictEqual(json.status, 'ok')
    assert.ok(typeof json.hasApiKey === 'boolean')
  })

  it('rejects chat POST requests when missing messages array', async () => {
    const res = await simulateRequest('POST', '/api/chat', {})

    // Either 400 with invalid request or error response
    assert.ok(res.statusCode === 400 || res.statusCode === 500)
    const json = JSON.parse(res.body)
    assert.ok(json.error)
  })

  it('handles SPA routing gracefully when assets/dist are requested', async () => {
    const res = await simulateRequest('GET', '/workspaces')

    // In dev or before dist build, returns 404 text or 200 HTML
    assert.ok(res.statusCode === 200 || res.statusCode === 404)
    if (res.statusCode === 404) {
      assert.ok(res.body.includes('Not found'))
    }
  })
})
