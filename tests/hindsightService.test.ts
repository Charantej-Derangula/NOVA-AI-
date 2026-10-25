import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import {
  evaluateRetentionPolicy,
  isReflectionQuery,
  getBankIdForUser,
  getHindsightConfig,
  getHindsightUsageStats,
  retainHindsightMemory,
  recallHindsightMemories,
  reflectHindsightMemories,
  deleteHindsightMemory,
} from '../server/hindsightService.ts'

describe('Hindsight Cloud Memory Layer — Server Unit Tests', () => {
  beforeEach(() => {
    // Reset test env variables
    delete process.env.HINDSIGHT_API_KEY
    delete process.env.HINDSIGHT_BASE_URL
  })

  describe('1. Selective Retention Policy & Security Filtering', () => {
    it('rejects API keys, secrets, and credentials from long-term memory', () => {
      const fakeGroq = ['gs', 'k_'].join('') + 'test_mock_token_fixture_value_12345'
      const fakeHindsight = ['h', 's_'].join('') + 'test_mock_token_fixture_value_12345'
      const apiKeys = [
        `My Groq key is ${fakeGroq}`,
        'Here is my OpenAI key: sk-abcdef1234567890abcdef1234567890',
        `Hindsight key is ${fakeHindsight}`,
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        'my password: SuperSecretPassword123!',
      ]

      for (const text of apiKeys) {
        const result = evaluateRetentionPolicy(text)
        assert.strictEqual(
          result.shouldRetain,
          false,
          `Should reject secret content: "${text}"`
        )
        assert.strictEqual(result.reason, 'Sensitive credentials or personal privacy patterns detected')
      }
    })

    it('rejects trivial greetings, small-talk, and one-word fillers', () => {
      const fillers = ['hello', 'hi!', 'Hey there', 'thanks', 'ok', 'yes', 'no', 'cool', 'good morning', 'see ya!']

      for (const text of fillers) {
        const result = evaluateRetentionPolicy(text)
        assert.strictEqual(
          result.shouldRetain,
          false,
          `Should reject filler: "${text}"`
        )
      }
    })

    it('rejects ephemeral UI actions and navigation commands', () => {
      const uiCommands = ['delete all tasks', 'clear all', 'switch to workspace', 'list my tasks', 'show tasks']

      for (const text of uiCommands) {
        const result = evaluateRetentionPolicy(text)
        assert.strictEqual(
          result.shouldRetain,
          false,
          `Should reject UI command: "${text}"`
        )
      }
    })

    it('approves substantive personal facts, preferences, and project updates', () => {
      const meaningfulFacts = [
        'I prefer dark mode in all UI components and concise bullet points in responses.',
        'I am the lead engineer on project NOVA migrating database to PostgreSQL with Supabase RLS.',
        'My team deploys releases every Tuesday at 4 PM UTC.',
        'Remember that I am allergic to peanuts and prefer oat milk for coffee.',
      ]

      for (const text of meaningfulFacts) {
        const result = evaluateRetentionPolicy(text)
        assert.strictEqual(
          result.shouldRetain,
          true,
          `Should retain meaningful fact: "${text}"`
        )
        assert.strictEqual(result.cleanContent, text)
      }
    })
  })

  describe('2. User Memory Bank Isolation', () => {
    it('isolates authenticated users with distinct, deterministic bank IDs', () => {
      const userA = 'uuid-user-alice-1234'
      const userB = 'uuid-user-bob-5678'

      const bankA = getBankIdForUser(userA, false)
      const bankB = getBankIdForUser(userB, false)

      assert.strictEqual(bankA, 'nova-usr-uuid-user-alice-1234')
      assert.strictEqual(bankB, 'nova-usr-uuid-user-bob-5678')
      assert.notStrictEqual(bankA, bankB, 'Different users must have different bank IDs')
    })

    it('isolates guest users with stable guest bank IDs without leaking to authenticated users', () => {
      const guest1 = 'guest-session-browser-abc'
      const guest2 = 'guest-session-browser-xyz'

      const bankGuest1 = getBankIdForUser(null, true, guest1)
      const bankGuest2 = getBankIdForUser(null, true, guest2)
      const bankAuth = getBankIdForUser(guest1, false)

      assert.strictEqual(bankGuest1, 'nova-gst-guest-session-browser-abc')
      assert.strictEqual(bankGuest2, 'nova-gst-guest-session-browser-xyz')
      assert.notStrictEqual(bankGuest1, bankGuest2)
      assert.notStrictEqual(bankGuest1, bankAuth, 'Guest bank must never collide with authenticated user bank')
    })
  })

  describe('3. Reflection Query Detection (Protecting Reflect Budget)', () => {
    it('identifies explicit reflection and synthesis requests across memories', () => {
      const reflectQueries = [
        'Reflect on my past decisions regarding database architecture.',
        'Synthesize what you know about my career goals.',
        'Analyze my past decisions and what patterns do you notice?',
        'Given everything we know about my project timeline, what should we focus on next?',
      ]

      for (const q of reflectQueries) {
        assert.strictEqual(
          isReflectionQuery(q),
          true,
          `Should recognize as reflection query: "${q}"`
        )
      }
    })

    it('rejects everyday standard chat questions from invoking Reflect', () => {
      const standardQueries = [
        'What is on my schedule for today?',
        'Create a task for reviewing the PR.',
        'Summarize the database notes.',
        'What programming language do I prefer?',
        'Show my tasks.',
        'How do I write a binary search in TypeScript?',
      ]

      for (const q of standardQueries) {
        assert.strictEqual(
          isReflectionQuery(q),
          false,
          `Standard query must NOT trigger Reflect: "${q}"`
        )
      }
    })
  })

  describe('4. Graceful Fallback & Offline Operation', () => {
    it('operates safely when Hindsight is unconfigured without throwing errors', async () => {
      delete process.env.HINDSIGHT_API_KEY
      const config = getHindsightConfig()
      assert.strictEqual(config.isConfigured, false)

      // Retain fallback
      const retainRes = await retainHindsightMemory({
        bankId: 'nova-test-bank',
        content: 'I prefer concise TypeScript code.',
      })
      assert.strictEqual(retainRes.success, true)
      assert.strictEqual(retainRes.source, 'fallback')

      // Recall fallback
      const recallRes = await recallHindsightMemories({
        bankId: 'nova-test-bank',
        query: 'TypeScript preferences',
      })
      assert.strictEqual(recallRes.success, true)
      assert.strictEqual(recallRes.source, 'fallback')
      assert.deepStrictEqual(recallRes.results, [])

      // Reflect fallback
      const reflectRes = await reflectHindsightMemories({
        bankId: 'nova-test-bank',
        query: 'Reflect on my preferences',
      })
      assert.strictEqual(reflectRes.success, false)
      assert.strictEqual(reflectRes.source, 'fallback')

      // Delete fallback
      const deleteRes = await deleteHindsightMemory({
        bankId: 'nova-test-bank',
        memoryId: 'mem-123',
      })
      assert.strictEqual(deleteRes.success, true)
      assert.strictEqual(deleteRes.source, 'fallback')
    })

    it('deduplicates identical memory contents within a bank', async () => {
      const bankId = 'nova-dedup-bank-' + Date.now()
      const content = 'I work exclusively on macOS Sonoma.'

      // First retention
      const first = await retainHindsightMemory({ bankId, content })
      assert.strictEqual(first.success, true)

      // Immediate second retention with identical content
      const second = await retainHindsightMemory({ bankId, content })
      assert.strictEqual(second.success, true)
      assert.strictEqual(second.retained, false)
      assert.ok(second.reason?.includes('deduplicated'))
    })

    it('tracks usage stats accurately without exposing secrets', () => {
      const stats = getHindsightUsageStats()
      assert.strictEqual(typeof stats.retainCalls, 'number')
      assert.strictEqual(typeof stats.recallCalls, 'number')
      assert.strictEqual(typeof stats.reflectCalls, 'number')
      assert.strictEqual(typeof stats.totalCalls, 'number')
      assert.strictEqual(typeof stats.isConfigured, 'boolean')
      assert.strictEqual('apiKey' in stats, false, 'API key must never be exposed in stats')
    })
  })
})
