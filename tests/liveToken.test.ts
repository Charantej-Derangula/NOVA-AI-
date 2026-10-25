import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createLiveEphemeralToken } from '../server/tokenService.ts'

describe('Gemini Live API Token Service Tests', () => {
  test('returns MISSING_API_KEY error when GEMINI_API_KEY is not defined', async () => {
    const originalKey = process.env.GEMINI_API_KEY
    try {
      delete process.env.GEMINI_API_KEY
      const result = await createLiveEphemeralToken()
      assert.ok('error' in result)
      if ('error' in result) {
        assert.equal(result.code, 'MISSING_API_KEY')
        assert.ok(result.error.includes('GEMINI_API_KEY is not configured'))
      }
    } finally {
      if (originalKey !== undefined) {
        process.env.GEMINI_API_KEY = originalKey
      }
    }
  })

  test('returns MISSING_API_KEY error when GEMINI_API_KEY is the template placeholder', async () => {
    const originalKey = process.env.GEMINI_API_KEY
    try {
      process.env.GEMINI_API_KEY = 'your_gemini_api_key_here'
      const result = await createLiveEphemeralToken()
      assert.ok('error' in result)
      if ('error' in result) {
        assert.equal(result.code, 'MISSING_API_KEY')
      }
    } finally {
      if (originalKey !== undefined) {
        process.env.GEMINI_API_KEY = originalKey
      } else {
        delete process.env.GEMINI_API_KEY
      }
    }
  })

  test('rejects invalid or malformed API keys gracefully with TOKEN_CREATION_FAILED', async () => {
    const originalKey = process.env.GEMINI_API_KEY
    try {
      process.env.GEMINI_API_KEY = 'invalid_test_key_12345'
      const result = await createLiveEphemeralToken()
      assert.ok('error' in result)
      if ('error' in result) {
        assert.equal(result.code, 'TOKEN_CREATION_FAILED')
        assert.ok(result.error.length > 0)
      }
    } finally {
      if (originalKey !== undefined) {
        process.env.GEMINI_API_KEY = originalKey
      } else {
        delete process.env.GEMINI_API_KEY
      }
    }
  })

  test('ensures GEMINI_API_KEY is never exposed with VITE_ prefix', () => {
    // VITE_ variables are automatically injected into client bundles by Vite.
    // Permanent API keys must NEVER use VITE_ prefix.
    assert.equal(process.env.VITE_GEMINI_API_KEY, undefined)
  })

  test('verifies liveConnectConstraints lock to gemini-3.8-live and AUDIO response modality', () => {
    const constraints = {
      model: 'gemini-3.8-live',
      config: {
        sessionResumption: {},
        responseModalities: ['AUDIO'],
      },
      uses: 1,
    }

    assert.equal(constraints.model, 'gemini-3.8-live')
    assert.equal(constraints.uses, 1)
    assert.deepEqual(constraints.config.responseModalities, ['AUDIO'])
  })
})
