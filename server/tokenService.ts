import { GoogleGenAI, Modality } from '@google/genai'
import { reloadServerEnv } from './chatService.ts'

export interface EphemeralTokenResult {
  token: string
  model: string
  expireTime: string
  newSessionExpireTime: string
}

export interface EphemeralTokenError {
  error: string
  code: 'MISSING_API_KEY' | 'TOKEN_CREATION_FAILED'
  details?: string
}

export async function createLiveEphemeralToken(): Promise<EphemeralTokenResult | EphemeralTokenError> {
  reloadServerEnv()
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
    return {
      error: 'GEMINI_API_KEY is not configured on the server. Please create a .env file in the project root with your GEMINI_API_KEY.',
      code: 'MISSING_API_KEY',
    }
  }

  try {
    const client = new GoogleGenAI({ apiKey })
    const now = Date.now()
    const expireTime = new Date(now + 30 * 60 * 1000).toISOString()
    const newSessionExpireTime = new Date(now + 1 * 60 * 1000).toISOString()

    const token = await client.authTokens.create({
      config: {
        uses: 1, // Single-use ephemeral token
        expireTime,
        newSessionExpireTime,
        liveConnectConstraints: {
          model: 'gemini-3.8-live',
          config: {
            sessionResumption: {},
            responseModalities: [Modality.AUDIO],
          },
        },
      },
    })

    if (!token?.name) {
      return {
        error: 'Gemini API did not return an ephemeral token name.',
        code: 'TOKEN_CREATION_FAILED',
      }
    }

    return {
      token: token.name,
      model: 'gemini-3.8-live',
      expireTime,
      newSessionExpireTime,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      error: `Gemini Live token provisioning failed: ${message}`,
      code: 'TOKEN_CREATION_FAILED',
      details: message,
    }
  }
}
