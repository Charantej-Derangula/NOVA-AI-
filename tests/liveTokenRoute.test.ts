import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/live-token.ts'
import type http from 'node:http'

interface MockResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
  setHeader: (key: string, value: string) => void
  end: (chunk?: string | Buffer) => void
}

function createMockResponse(): MockResponse {
  const headers: Record<string, string> = {}
  let body = ''
  let statusCode = 200

  const res = {
    get statusCode() {
      return statusCode
    },
    set statusCode(val: number) {
      statusCode = val
    },
    headers,
    get body() {
      return body
    },
    setHeader(key: string, value: string) {
      headers[key.toLowerCase()] = value
    },
    end(chunk?: string | Buffer) {
      if (chunk) {
        body += chunk.toString()
      }
    },
  }

  return res
}

describe('Vercel /api/live-token Serverless Function Route', () => {
  test('handles OPTIONS request with 204 and CORS headers', async () => {
    const req = { method: 'OPTIONS', headers: {} } as unknown as http.IncomingMessage
    const res = createMockResponse()

    await handler(req, res as unknown as http.ServerResponse)

    assert.equal(res.statusCode, 204)
    assert.equal(res.headers['access-control-allow-origin'], '*')
    assert.equal(res.headers['access-control-allow-methods'], 'GET, POST, OPTIONS')
  })

  test('rejects unsupported HTTP methods with 405 Method Not Allowed', async () => {
    const req = { method: 'DELETE', headers: {} } as unknown as http.IncomingMessage
    const res = createMockResponse()

    await handler(req, res as unknown as http.ServerResponse)

    assert.equal(res.statusCode, 405)
    assert.equal(res.headers['content-type'], 'application/json')
    const json = JSON.parse(res.body)
    assert.equal(json.code, 'METHOD_NOT_ALLOWED')
  })

  test('returns 400 with MISSING_API_KEY when GEMINI_API_KEY is not defined', async () => {
    const originalKey = process.env.GEMINI_API_KEY
    try {
      delete process.env.GEMINI_API_KEY
      const req = { method: 'POST', headers: {} } as unknown as http.IncomingMessage
      const res = createMockResponse()

      await handler(req, res as unknown as http.ServerResponse)

      assert.equal(res.statusCode, 400)
      assert.equal(res.headers['content-type'], 'application/json')
      const json = JSON.parse(res.body)
      assert.equal(json.code, 'MISSING_API_KEY')
      assert.ok(json.error.includes('GEMINI_API_KEY is not configured'))
    } finally {
      if (originalKey !== undefined) {
        process.env.GEMINI_API_KEY = originalKey
      }
    }
  })

  test('returns 502 with TOKEN_CREATION_FAILED when upstream API call fails', async () => {
    const originalKey = process.env.GEMINI_API_KEY
    try {
      process.env.GEMINI_API_KEY = 'invalid_test_key_for_502'
      const req = { method: 'GET', headers: {} } as unknown as http.IncomingMessage
      const res = createMockResponse()

      await handler(req, res as unknown as http.ServerResponse)

      assert.equal(res.statusCode, 502)
      assert.equal(res.headers['content-type'], 'application/json')
      const json = JSON.parse(res.body)
      assert.equal(json.code, 'TOKEN_CREATION_FAILED')
    } finally {
      if (originalKey !== undefined) {
        process.env.GEMINI_API_KEY = originalKey
      } else {
        delete process.env.GEMINI_API_KEY
      }
    }
  })
})
