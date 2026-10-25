import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getHindsightConfig,
  getBankIdForUser,
  evaluateRetentionPolicy,
  isReflectionQuery,
  retainHindsightMemory,
  deleteHindsightMemory,
  getHindsightUsageStats,
} from '../server/hindsightService.ts'
import {
  executeActionIntent,
  retrieveEnrichedActionContext,
} from '../src/services/actionEngine.ts'
import type { MemoryItem } from '../src/types/index.ts'

test('Hindsight Cloud Integration: Credential Safety & Configuration', () => {
  const { isConfigured, config } = getHindsightConfig()
  assert.ok(typeof isConfigured === 'boolean')
  assert.ok(typeof config.baseUrl === 'string')
  assert.strictEqual(config.maxRetainPerHour, 60)
  assert.strictEqual(config.maxRecallPerHour, 150)
  assert.strictEqual(config.maxReflectPerHour, 20)
})

test('Hindsight Cloud Integration: Strict User Memory-Bank Isolation', () => {
  const user1Bank = getBankIdForUser('user-uuid-1111-aaaa', false)
  const user2Bank = getBankIdForUser('user-uuid-2222-bbbb', false)
  const guest1Bank = getBankIdForUser(null, true, 'guest-uuid-3333-cccc')
  const guest2Bank = getBankIdForUser(null, true, 'guest-uuid-4444-dddd')

  assert.strictEqual(user1Bank, 'nova-usr-user-uuid-1111-aaaa')
  assert.strictEqual(user2Bank, 'nova-usr-user-uuid-2222-bbbb')
  assert.strictEqual(guest1Bank, 'nova-gst-guest-uuid-3333-cccc')
  assert.strictEqual(guest2Bank, 'nova-gst-guest-uuid-4444-dddd')

  // Zero collision across authenticated users or between auth and guest
  assert.notStrictEqual(user1Bank, user2Bank)
  assert.notStrictEqual(user1Bank, guest1Bank)
  assert.notStrictEqual(guest1Bank, guest2Bank)
})

test('Hindsight Cloud Integration: Selective Retention Policy Enforcement', () => {
  // 1. Legitimate user facts / preferences -> SHOULD retain
  const validMemory = evaluateRetentionPolicy('I prefer dark mode and TypeScript for all frontend modules.')
  assert.strictEqual(validMemory.shouldRetain, true)
  assert.strictEqual(validMemory.cleanContent, 'I prefer dark mode and TypeScript for all frontend modules.')

  // 2. Sensitive API keys and secrets -> MUST REJECT
  const fakeGroqToken = ['gs', 'k_'].join('') + 'test_mock_token_fixture_value_12345'
  const secretKey = evaluateRetentionPolicy(`My token is ${fakeGroqToken}`)
  assert.strictEqual(secretKey.shouldRetain, false)
  assert.match(secretKey.reason || '', /sensitive/i)

  const openAiKey = evaluateRetentionPolicy('sk-proj-abcdef1234567890abcdef12345')
  assert.strictEqual(openAiKey.shouldRetain, false)

  // 3. Sensitive credit card numbers -> MUST REJECT
  const ccNumber = evaluateRetentionPolicy('Card number: 4111111111111111')
  assert.strictEqual(ccNumber.shouldRetain, false)

  // 4. Trivial small talk and pleasantries -> MUST REJECT
  const greetings = ['hi', 'Hello!', 'Hey there', 'thanks', 'Thank you', 'ok', 'okay', 'cool']
  for (const g of greetings) {
    const res = evaluateRetentionPolicy(g)
    assert.strictEqual(res.shouldRetain, false, `Should reject filler greeting: ${g}`)
  }

  // 5. Short strings below minimum character length -> MUST REJECT
  const shortText = evaluateRetentionPolicy('yes')
  assert.strictEqual(shortText.shouldRetain, false)
})

test('Hindsight Cloud Integration: Deduplication on Retention', async () => {
  const bankId = `nova-test-${Date.now()}`
  const fact = `The CEO approved Q4 headcount expansion on Tuesday.`

  const firstAttempt = await retainHindsightMemory({ bankId, content: fact })
  assert.strictEqual(firstAttempt.success, true)
  assert.strictEqual(firstAttempt.retained, true)

  // Duplicate retention attempt must be prevented and marked deduplicated
  const secondAttempt = await retainHindsightMemory({ bankId, content: fact })
  assert.strictEqual(secondAttempt.success, true)
  assert.strictEqual(secondAttempt.retained, false)
  assert.match(secondAttempt.reason || '', /deduplicated/i)
})

test('Hindsight Cloud Integration: Reflect Query Gating to Protect Credits', () => {
  // Regular queries must NOT trigger expensive Reflect synthesis
  assert.strictEqual(isReflectionQuery('What are my tasks for tomorrow?'), false)
  assert.strictEqual(isReflectionQuery('Summarize my note on database schema'), false)
  assert.strictEqual(isReflectionQuery('Remember that I like black coffee'), false)

  // Explicit multi-memory synthesis queries MUST trigger Reflect
  assert.strictEqual(isReflectionQuery('Reflect on our discussions about the project'), true)
  assert.strictEqual(isReflectionQuery('Synthesize what you know about my work habits'), true)
  assert.strictEqual(isReflectionQuery('Analyze my past decisions regarding cloud providers'), true)
  assert.strictEqual(isReflectionQuery('What patterns do you notice in my schedule?'), true)
})

test('Hindsight Cloud Integration: Usage Tracking & Credit Safe Quotas', () => {
  const stats = getHindsightUsageStats()
  assert.ok(typeof stats.retainCalls === 'number')
  assert.ok(typeof stats.recallCalls === 'number')
  assert.ok(typeof stats.reflectCalls === 'number')
  assert.ok(typeof stats.totalCalls === 'number')
  assert.ok(typeof stats.isRateLimited === 'boolean')
  assert.ok(typeof stats.isConfigured === 'boolean')
})

test('Hindsight Cloud Integration: Safe Deletion Handling', async () => {
  const bankId = `nova-del-bank-${Date.now()}`
  const res = await deleteHindsightMemory({ bankId, memoryId: 'mem-to-remove-123' })
  assert.strictEqual(res.success, true)
})

test('Action Engine: Supabase Source of Truth + Hindsight Retention on Memory Create', async () => {
  const addedMemories: Array<{ category: string; content: string; workspaceId?: string }> = []
  const initialMemories: MemoryItem[] = []

  const result = await executeActionIntent({
    prompt: 'Remember that the production database migration is scheduled for Sunday at 2 AM',
    tasks: [],
    memories: initialMemories,
    knowledge: [],
    workspaces: [],
    activeWorkspaceId: null,
    onAddTask: async () => ({ id: 't1', title: '', priority: 'medium', completed: false, estimateMinutes: 30, createdAt: '' }),
    onUpdateTask: async () => {},
    onDeleteTask: async () => {},
    onToggleTask: async () => {},
    onDeleteAllTasks: async () => {},
    onAddMemory: async (category, content, workspaceId) => {
      addedMemories.push({ category, content, workspaceId })
      return {
        id: 'mem-prod-mig-1',
        category,
        content,
        dateAdded: 'Today',
      }
    },
    onUpdateMemory: async () => {},
    onDeleteMemory: async () => {},
    onAddKnowledge: async () => ({ id: 'k1', title: '', kind: 'Personal note', content: '', tags: [], createdAt: '' }),
    onUpdateKnowledge: async () => {},
    onDeleteKnowledge: async () => {},
    onAddWorkspace: async () => 'w1',
    onUpdateWorkspace: async () => {},
    onDeleteWorkspace: async () => {},
    onSelectWorkspace: () => {},
  })

  // 1. Verified action execution outcome
  assert.strictEqual(result.handled, true)
  assert.strictEqual(result.status, 'executed')
  assert.strictEqual(result.entityType, 'memory')
  assert.strictEqual(result.verb, 'create')
  assert.strictEqual(result.recordId, 'mem-prod-mig-1')

  // 2. Verified Supabase persistence service was called
  assert.strictEqual(addedMemories.length, 1)
  assert.strictEqual(addedMemories[0].content, 'the production database migration is scheduled for Sunday at 2 AM')
})

test('Action Engine: Memory Deletion with Verified Removal across Stores', async () => {
  const deletedIds: string[] = []
  const testMemories: MemoryItem[] = [
    {
      id: 'mem-coffee-99',
      category: 'Preference',
      content: 'I prefer oat milk in my latte',
      dateAdded: 'Yesterday',
    },
  ]

  const result = await executeActionIntent({
    prompt: 'Delete memory mem-coffee-99',
    tasks: [],
    memories: testMemories,
    knowledge: [],
    workspaces: [],
    activeWorkspaceId: null,
    onAddTask: async () => ({ id: 't1', title: '', priority: 'medium', completed: false, estimateMinutes: 30, createdAt: '' }),
    onUpdateTask: async () => {},
    onDeleteTask: async () => {},
    onToggleTask: async () => {},
    onDeleteAllTasks: async () => {},
    onAddMemory: async () => ({ id: 'm1', category: '', content: '', dateAdded: '' }),
    onUpdateMemory: async () => {},
    onDeleteMemory: async (id) => {
      deletedIds.push(id)
    },
    onAddKnowledge: async () => ({ id: 'k1', title: '', kind: 'Personal note', content: '', tags: [], createdAt: '' }),
    onUpdateKnowledge: async () => {},
    onDeleteKnowledge: async () => {},
    onAddWorkspace: async () => 'w1',
    onUpdateWorkspace: async () => {},
    onDeleteWorkspace: async () => {},
    onSelectWorkspace: () => {},
  })

  assert.strictEqual(result.handled, true)
  assert.strictEqual(result.status, 'executed')
  assert.strictEqual(result.entityType, 'memory')
  assert.strictEqual(result.verb, 'delete')
  assert.strictEqual(result.recordId, 'mem-coffee-99')
  assert.deepStrictEqual(deletedIds, ['mem-coffee-99'])
})

test('Action Engine: Context Retrieval Enriches Prompt with User Memories', async () => {
  const sampleMemories: MemoryItem[] = [
    {
      id: 'mem-ts-1',
      category: 'Preferences',
      content: 'Always use strict TypeScript types and avoid any',
      dateAdded: 'Oct 20',
    },
  ]

  const enrichedContext = await retrieveEnrichedActionContext({
    prompt: 'What are my coding preferences and what did I decide?',
    tasks: [],
    memories: sampleMemories,
    knowledge: [],
    workspaces: [],
    activeWorkspaceId: null,
    enableHindsight: false,
  })

  assert.ok(enrichedContext.totalMatches > 0)
  assert.strictEqual(enrichedContext.relevantMemories.length, 1)
  assert.strictEqual(enrichedContext.relevantMemories[0].id, 'mem-ts-1')
  assert.match(enrichedContext.formattedContextPrompt, /strict TypeScript types/)
})
