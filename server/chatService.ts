import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Groq from 'groq-sdk'
import dotenv from 'dotenv'

/**
 * Ensures environment variables from .env in project root are loaded into process.env.
 * Uses { override: true } so any runtime edits to .env (such as adding GROQ_API_KEY)
 * are immediately recognized without requiring a server restart.
 */
export function reloadServerEnv(force = false): void {
  const isTestEnvironment =
    process.env.NODE_ENV === 'test' ||
    process.execArgv.some((arg) => arg.startsWith('--test')) ||
    process.argv.some((arg) => arg.includes('.test.'))

  if (!force && isTestEnvironment) {
    return
  }

  try {
    const envPath = fileURLToPath(new URL('../.env', import.meta.url))
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: true })
      return
    }
  } catch {
    // fallback below
  }

  try {
    const cwdPath = path.resolve(process.cwd(), '.env')
    if (fs.existsSync(cwdPath)) {
      dotenv.config({ path: cwdPath, override: true })
      return
    }
  } catch {
    // fallback below
  }

  dotenv.config({ override: true })
}

// Initial load on startup
reloadServerEnv()

export interface ClientChatMessage {
  role: 'user' | 'system' | 'assistant'
  content: string
}

export interface ChatStreamRequest {
  messages: ClientChatMessage[]
  systemInstruction?: string
}

export interface ChatServiceError {
  error: string
  code: 'MISSING_API_KEY' | 'GENERATION_FAILED' | 'INVALID_REQUEST'
  details?: string
}

export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b'

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Validates the configured GROQ_API_KEY from server environment.
 * Dynamically reloads .env if missing to support hot credential updates.
 */
export function validateGroqApiKey(): { valid: true; apiKey: string } | { valid: false; error: ChatServiceError } {
  reloadServerEnv()
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || apiKey === 'your_groq_api_key_here' || apiKey.trim() === '') {
    return {
      valid: false,
      error: {
        error: 'GROQ_API_KEY is not configured on the server. Please add your GROQ_API_KEY to the .env file in the project root.',
        code: 'MISSING_API_KEY',
      },
    }
  }
  return { valid: true, apiKey: apiKey.trim() }
}

/**
 * Transforms client chat messages into Groq-compatible ChatCompletionMessageParam array.
 * Automatically prepends systemInstruction as role: 'system'.
 */
export function formatMessagesForGroq(
  messages: ClientChatMessage[],
  systemInstruction?: string
): GroqMessage[] {
  const formatted: GroqMessage[] = []

  if (systemInstruction && systemInstruction.trim().length > 0) {
    formatted.push({
      role: 'system',
      content: systemInstruction.trim(),
    })
  }

  for (const msg of messages) {
    const text = msg.content?.trim()
    if (!text) continue

    const role: 'system' | 'user' | 'assistant' =
      msg.role === 'system' ? 'system' : msg.role === 'assistant' ? 'assistant' : 'user'

    formatted.push({
      role,
      content: text,
    })
  }

  return formatted
}

/**
 * Streams responses from Groq (Llama 3.3 70B by default) as an async generator of text chunks.
 */
export async function* streamGroqChat(
  request: ChatStreamRequest,
  abortSignal?: AbortSignal,
  clientOverride?: Groq
): AsyncGenerator<string, void, unknown> {
  const authCheck = validateGroqApiKey()
  if (!authCheck.valid) {
    throw new Error(authCheck.error.error)
  }

  if (!Array.isArray(request.messages) || request.messages.length === 0) {
    throw new Error('At least one message is required to start a chat session.')
  }

  const systemPrompt =
    request.systemInstruction ||
    'You are NOVA, a calm, proactive, and intelligent personal AI executive assistant. Format your responses with clean Markdown, clear headings, code blocks, and bullet points where helpful.'

  const formattedMessages = formatMessagesForGroq(request.messages, systemPrompt)
  if (formattedMessages.length === 0 || (formattedMessages.length === 1 && formattedMessages[0].role === 'system')) {
    throw new Error('No valid message content was provided.')
  }

  let model = process.env.GROQ_CHAT_MODEL?.trim() || DEFAULT_GROQ_MODEL
  if (model === 'llama-3.3-70b-versatile' || model === 'llama-3.1-8b-instant') {
    model = DEFAULT_GROQ_MODEL
  }
  const groq = clientOverride || new Groq({ apiKey: authCheck.apiKey })

  const responseStream = await groq.chat.completions.create(
    {
      model,
      messages: formattedMessages,
      stream: true,
      temperature: 0.6,
    },
    {
      signal: abortSignal,
    }
  )

  for await (const chunk of responseStream) {
    if (abortSignal?.aborted) {
      break
    }
    const delta = chunk.choices[0]?.delta?.content
    if (delta) {
      yield delta
    }
  }
}
