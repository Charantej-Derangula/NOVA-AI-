import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateGroqApiKey,
  formatMessagesForGroq,
  streamGroqChat,
  DEFAULT_GROQ_MODEL,
  type ClientChatMessage,
} from '../server/chatService.ts'
import type Groq from 'groq-sdk'

describe('Server Chat Service & Groq Integration Tests', () => {
  test('validates missing or placeholder GROQ_API_KEY correctly', () => {
    const original = process.env.GROQ_API_KEY

    try {
      delete process.env.GROQ_API_KEY
      const check1 = validateGroqApiKey()
      assert.equal(check1.valid, false)
      if (!check1.valid) {
        assert.equal(check1.error.code, 'MISSING_API_KEY')
      }

      process.env.GROQ_API_KEY = 'your_groq_api_key_here'
      const check2 = validateGroqApiKey()
      assert.equal(check2.valid, false)
      if (!check2.valid) {
        assert.equal(check2.error.code, 'MISSING_API_KEY')
      }

      process.env.GROQ_API_KEY = 'gsk_test_groq_valid_api_key_123'
      const check3 = validateGroqApiKey()
      assert.equal(check3.valid, true)
      if (check3.valid) {
        assert.equal(check3.apiKey, 'gsk_test_groq_valid_api_key_123')
      }
    } finally {
      if (original !== undefined) {
        process.env.GROQ_API_KEY = original
      } else {
        delete process.env.GROQ_API_KEY
      }
    }
  })

  test('formats multi-turn conversation messages with system prompt into Groq structure', () => {
    const messages: ClientChatMessage[] = [
      { role: 'user', content: 'What is Groq LPU?' },
      { role: 'assistant', content: 'Groq LPUs are Language Processing Units optimized for sequential inference.' },
      { role: 'user', content: 'How does it achieve low latency?' },
    ]

    const systemPrompt = 'You are NOVA, an executive AI assistant.'
    const formatted = formatMessagesForGroq(messages, systemPrompt)

    assert.equal(formatted.length, 4)
    assert.deepEqual(formatted[0], {
      role: 'system',
      content: 'You are NOVA, an executive AI assistant.',
    })
    assert.deepEqual(formatted[1], {
      role: 'user',
      content: 'What is Groq LPU?',
    })
    assert.deepEqual(formatted[2], {
      role: 'assistant',
      content: 'Groq LPUs are Language Processing Units optimized for sequential inference.',
    })
    assert.deepEqual(formatted[3], {
      role: 'user',
      content: 'How does it achieve low latency?',
    })
  })

  test('skips empty or whitespace-only messages during formatting', () => {
    const messages: ClientChatMessage[] = [
      { role: 'user', content: '   ' },
      { role: 'assistant', content: '' },
      { role: 'user', content: 'Real question' },
    ]

    const formatted = formatMessagesForGroq(messages)
    assert.equal(formatted.length, 1)
    assert.equal(formatted[0].content, 'Real question')
  })

  test('ensures GROQ_API_KEY and GEMINI_API_KEY are not exposed with VITE_ prefix', () => {
    assert.equal(process.env.VITE_GROQ_API_KEY, undefined)
    assert.equal(process.env.VITE_GEMINI_API_KEY, undefined)
  })

  test('uses DEFAULT_GROQ_MODEL openai/gpt-oss-120b for high reasoning quality', () => {
    assert.equal(DEFAULT_GROQ_MODEL, 'openai/gpt-oss-120b')
  })

  test('streamGroqChat streams chunks using mocked Groq completions and supports cancellation', async () => {
    const originalKey = process.env.GROQ_API_KEY
    process.env.GROQ_API_KEY = 'gsk_mock_valid_key'

    try {
      async function* mockStream() {
        yield { choices: [{ delta: { content: 'Hello' } }] }
        yield { choices: [{ delta: { content: ' from' } }] }
        yield { choices: [{ delta: { content: ' Groq Llama 3.3!' } }] }
      }

      const mockGroq = {
        chat: {
          completions: {
            create: async () => mockStream(),
          },
        },
      } as unknown as Groq

      const chunks: string[] = []
      for await (const chunk of streamGroqChat(
        { messages: [{ role: 'user', content: 'Hello' }] },
        undefined,
        mockGroq
      )) {
        chunks.push(chunk)
      }

      assert.deepEqual(chunks, ['Hello', ' from', ' Groq Llama 3.3!'])

      // Test with pre-aborted signal
      const abortController = new AbortController()
      abortController.abort()

      const abortedChunks: string[] = []
      for await (const chunk of streamGroqChat(
        { messages: [{ role: 'user', content: 'Hello' }] },
        abortController.signal,
        mockGroq
      )) {
        abortedChunks.push(chunk)
      }
      assert.equal(abortedChunks.length, 0)
    } finally {
      if (originalKey !== undefined) {
        process.env.GROQ_API_KEY = originalKey
      } else {
        delete process.env.GROQ_API_KEY
      }
    }
  })

  test('streamChatMessage parses incoming SSE chunks and completes cleanly', async () => {
    const { streamChatMessage } = await import('../src/services/chatService.ts')

    const sseBody = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode('data: {"text":"Hello"}\n\n'))
        controller.enqueue(encoder.encode('data: {"text":" from Groq"}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    const originalFetch = globalThis.fetch
    try {
      // @ts-expect-error Mock fetch
      globalThis.fetch = async () =>
        new Response(sseBody, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })

      const chunks: string[] = []
      let completed = false
      let errorMessage = ''

      await streamChatMessage({
        messages: [{ id: '1', role: 'user', content: 'Hi', timestamp: '10:00' }],
        onChunk: (chunk) => chunks.push(chunk),
        onComplete: () => {
          completed = true
        },
        onError: (err) => {
          errorMessage = err
        },
      })

      assert.equal(completed, true)
      assert.equal(errorMessage, '')
      assert.deepEqual(chunks, ['Hello', ' from Groq'])
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('streamChatMessage handles aborted signal without raising error', async () => {
    const { streamChatMessage } = await import('../src/services/chatService.ts')

    const abortController = new AbortController()
    abortController.abort()

    let completed = false
    let errorMessage = ''

    await streamChatMessage({
      messages: [{ id: '1', role: 'user', content: 'Hi', timestamp: '10:00' }],
      signal: abortController.signal,
      onChunk: () => {},
      onComplete: () => {
        completed = true
      },
      onError: (err) => {
        errorMessage = err
      },
    })

    assert.equal(completed, true)
    assert.equal(errorMessage, '')
  })

  test('streamChatMessage invokes onError when backend returns 500 or error status', async () => {
    const { streamChatMessage } = await import('../src/services/chatService.ts')

    const originalFetch = globalThis.fetch
    try {
      // @ts-expect-error Mock fetch
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ error: 'Server GROQ_API_KEY is not configured.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })

      let completed = false
      let errorMessage = ''

      await streamChatMessage({
        messages: [{ id: '1', role: 'user', content: 'Hi', timestamp: '10:00' }],
        onChunk: () => {},
        onComplete: () => {
          completed = true
        },
        onError: (err) => {
          errorMessage = err
        },
      })

      assert.equal(completed, false)
      assert.equal(errorMessage, 'Server GROQ_API_KEY is not configured.')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
