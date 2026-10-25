import type { ChatMessage } from '../types'

export interface StreamChatOptions {
  messages: ChatMessage[]
  systemInstruction?: string
  signal?: AbortSignal
  onChunk: (textChunk: string) => void
  onComplete: () => void
  onError: (error: string) => void
}

/**
 * Sends a conversation to the secure server endpoint /api/chat and streams the response
 * via Server-Sent Events (SSE).
 */
export async function streamChatMessage({
  messages,
  systemInstruction,
  signal,
  onChunk,
  onComplete,
  onError,
}: StreamChatOptions): Promise<void> {
  try {
    const formattedMessages = messages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }))

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: formattedMessages,
        systemInstruction,
      }),
      signal,
    })

    if (!res.ok) {
      let errorText = `Server responded with status ${res.status}`
      try {
        const errorJson = await res.json()
        if (errorJson.error) {
          errorText = errorJson.error
        }
      } catch {
        // Fall back to status text
      }
      onError(errorText)
      return
    }

    if (!res.body) {
      onError('Response body is empty or not streamable.')
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      // Keep trailing incomplete fragment in the buffer
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue

        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') {
          onComplete()
          return
        }

        try {
          const parsed = JSON.parse(payload)
          if (parsed.text) {
            onChunk(parsed.text)
          } else if (parsed.error) {
            onError(parsed.error)
            return
          }
        } catch {
          // If JSON parse fails, check if plain text
          if (payload) {
            onChunk(payload)
          }
        }
      }
    }

    onComplete()
  } catch (err: unknown) {
    if (signal?.aborted) {
      // User cancelled generation
      onComplete()
      return
    }
    const message = err instanceof Error ? err.message : String(err)
    onError(message)
  }
}
