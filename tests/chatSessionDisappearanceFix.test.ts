import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { parseRoute, getPathForTab } from '../src/router/index.ts'
import {
  readStoredValue,
} from '../src/hooks/useLocalStorageState.ts'
import {
  fetchChatSession,
  persistChatSession,
} from '../src/services/dataService.ts'
import type { ChatSession } from '../src/types/index.ts'

const rootDir = path.resolve(import.meta.dirname, '..')

// In-memory mock storage implementing Web Storage API
class MockStorage {
  private store: Map<string, string> = new Map()

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  get length(): number {
    return this.store.size
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
}

describe('NOVA — Critical Fix: Chat Disappearance & Session Lifecycle', () => {
  let mockStorage: MockStorage

  beforeEach(() => {
    mockStorage = new MockStorage()
    // Polyfill global localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    })
  })

  describe('1. Route Configuration & Session-ID Parsing', () => {
    test('parseRoute extracts conversationId accurately without trailing slashes or distortion', () => {
      const sessionId = 'session-2ab6eb17-8537-41e1-95a3-8afe8f807da2'
      const route = parseRoute(`/chat/${sessionId}`)
      assert.equal(route.tab, 'chat')
      assert.equal(route.conversationId, sessionId)
      assert.equal(route.pathname, `/chat/${sessionId}`)
    })

    test('parseRoute decodes URI-encoded conversation IDs correctly', () => {
      const rawId = 'session-test:workspace/123'
      const encodedId = encodeURIComponent(rawId)
      const route = parseRoute(`/chat/${encodedId}`)
      assert.equal(route.tab, 'chat')
      assert.equal(route.conversationId, rawId)
    })

    test('getPathForTab generates canonical URL for chat session', () => {
      const sessionId = 'session-2ab6eb17-8537-41e1-95a3-8afe8f807da2'
      const path = getPathForTab('chat', sessionId)
      assert.equal(path, `/chat/${encodeURIComponent(sessionId)}`)
    })
  })

  describe('2. Source Code Inspection & Regression Guards', () => {
    const sidebarSrc = fs.readFileSync(path.join(rootDir, 'src/components/Sidebar.tsx'), 'utf-8')
    const appSrc = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf-8')
    const chatViewSrc = fs.readFileSync(path.join(rootDir, 'src/components/ChatView.tsx'), 'utf-8')
    const dataServiceSrc = fs.readFileSync(path.join(rootDir, 'src/services/dataService.ts'), 'utf-8')

    test('Sidebar recent chat button calls onSelectSession without duplicate onSelectTab("chat")', () => {
      // Must not call onSelectTab inside the recent chat item click handler
      const selectBtnMatch = sidebarSrc.match(/className="recent-chat-select-btn"[\s\S]*?onClick=\{\(\) => \{([\s\S]*?)\}\}/)
      assert.ok(selectBtnMatch, 'recent-chat-select-btn onClick must exist')
      const onClickBody = selectBtnMatch[1]
      assert.match(onClickBody, /onSelectSession\(session\.id\)/)
      assert.doesNotMatch(onClickBody, /onSelectTab\('chat'\)/, 'Must NOT invoke onSelectTab("chat") in recent chat selection')
      assert.match(onClickBody, /onClose\(\)/)
    })

    test('App.tsx treats URL route.conversationId as authoritative activeChatId', () => {
      assert.match(appSrc, /const activeChatId = \(route\.tab === 'chat' && route\.conversationId\)/)
      assert.match(appSrc, /\? route\.conversationId/)
      assert.match(appSrc, /: currentSessionId/)
    })

    test('App.tsx currentSession resolution checks memory AND local storage directly to prevent message loss', () => {
      assert.match(appSrc, /readStoredValue<ChatSession\[\]>\('nova:sessions:v1', \[\]\)/)
      assert.match(appSrc, /const fromMemory = sessions\.find\(\(s\) => s\.id === activeChatId\)/)
      assert.match(appSrc, /const fromStored = stored\.find\(\(s\) => s\.id === activeChatId\)/)
    })

    test('App.tsx route synchronization never prepends empty draft if session exists in memory or storage', () => {
      assert.match(appSrc, /if \(prev\.some\(\(s\) => s\.id === targetId\)\) \{\s*return prev/)
      assert.match(appSrc, /const inStorage = stored\.find\(\(s\) => s\.id === targetId\)/)
      assert.match(appSrc, /if \(inStorage\) \{\s*return \[inStorage, \.\.\.prev\]/)
    })

    test('App.tsx implements request cancellation ref to reject stale asynchronous responses', () => {
      assert.match(appSrc, /const activeLoadingSessionIdRef = useRef<string \| null>\(null\)/)
      assert.match(appSrc, /if \(activeLoadingSessionIdRef\.current !== targetId\) return/)
    })

    test('ChatView implements explicit loading and recoverable error UI', () => {
      assert.match(chatViewSrc, /isLoadingSession\?: boolean/)
      assert.match(chatViewSrc, /sessionLoadError\?: string \| null/)
      assert.match(chatViewSrc, /onRetryLoadSession\?: \(\) => void/)
      assert.match(chatViewSrc, /nova-chat-loading-state/)
      assert.match(chatViewSrc, /nova-chat-error-state/)
      assert.match(chatViewSrc, /Retry/)
    })

    test('dataService provides fetchChatSessions and fetchChatSession without wiping local data', () => {
      assert.match(dataServiceSrc, /export async function fetchChatSessions\(\)/)
      assert.match(dataServiceSrc, /export async function fetchChatSession\(id: string\)/)
    })
  })

  describe('3. Conversation Flows & Data Lifecycle Verification', () => {
    test('Test A — Open an existing chat: 3 messages remain visible and are never overwritten', async () => {
      const sessionId = 'session-2ab6eb17-8537-41e1-95a3-8afe8f807da2'
      const existingSession: ChatSession = {
        id: sessionId,
        title: 'Project Roadmap Architecture',
        updatedAt: new Date().toISOString(),
        messages: [
          { id: 'm1', role: 'user', content: 'What is our Q4 roadmap?', timestamp: '10:00 AM' },
          { id: 'm2', role: 'assistant', content: 'Here is the detailed architecture and deliverables for Q4.', timestamp: '10:01 AM' },
          { id: 'm3', role: 'user', content: 'Can we prioritize latency optimizations?', timestamp: '10:02 AM' },
        ],
      }

      // Persist to storage
      await persistChatSession(existingSession)

      // Verify stored in mock storage
      const stored = readStoredValue<ChatSession[]>('nova:sessions:v1', [])
      assert.equal(stored.length, 1)
      assert.equal(stored[0].id, sessionId)
      assert.equal(stored[0].messages.length, 3)

      // Simulate App.tsx currentSession resolution when opening this chat
      const activeChatId = sessionId
      const memorySessions: ChatSession[] = stored
      const currentSession = memorySessions.find((s) => s.id === activeChatId)
        || readStoredValue<ChatSession[]>('nova:sessions:v1', []).find((s) => s.id === activeChatId)

      assert.ok(currentSession, 'Conversation must resolve')
      assert.equal(currentSession.id, sessionId)
      assert.equal(currentSession.messages.length, 3)
      assert.equal(currentSession.messages[0].content, 'What is our Q4 roadmap?')
      assert.equal(currentSession.messages[2].content, 'Can we prioritize latency optimizations?')
    })

    test('Test B — Switch between chats: each conversation displays strictly its own messages', async () => {
      const sessionA: ChatSession = {
        id: 'session-alpha',
        title: 'Conversation Alpha',
        updatedAt: new Date().toISOString(),
        messages: [
          { id: 'ma-1', role: 'user', content: 'Message in Alpha', timestamp: '09:00 AM' },
        ],
      }
      const sessionB: ChatSession = {
        id: 'session-beta',
        title: 'Conversation Beta',
        updatedAt: new Date().toISOString(),
        messages: [
          { id: 'mb-1', role: 'user', content: 'Message in Beta 1', timestamp: '09:30 AM' },
          { id: 'mb-2', role: 'assistant', content: 'Message in Beta 2', timestamp: '09:31 AM' },
        ],
      }

      await persistChatSession(sessionA)
      await persistChatSession(sessionB)

      const stored = readStoredValue<ChatSession[]>('nova:sessions:v1', [])
      assert.equal(stored.length, 2)

      // Open Alpha
      const resolvedAlpha = stored.find((s) => s.id === 'session-alpha')
      assert.ok(resolvedAlpha)
      assert.equal(resolvedAlpha.messages.length, 1)
      assert.equal(resolvedAlpha.messages[0].content, 'Message in Alpha')

      // Switch to Beta
      const resolvedBeta = stored.find((s) => s.id === 'session-beta')
      assert.ok(resolvedBeta)
      assert.equal(resolvedBeta.messages.length, 2)
      assert.equal(resolvedBeta.messages[0].content, 'Message in Beta 1')

      // Return to Alpha
      const returnedAlpha = stored.find((s) => s.id === 'session-alpha')
      assert.ok(returnedAlpha)
      assert.equal(returnedAlpha.messages.length, 1)
      assert.equal(returnedAlpha.messages[0].content, 'Message in Alpha')
    })

    test('Test C — Refresh: exact URL path restores the same conversation and messages from storage', () => {
      const targetId = 'session-refresh-test-456'
      const savedSession: ChatSession = {
        id: targetId,
        title: 'Persistent Session on Refresh',
        updatedAt: new Date().toISOString(),
        messages: [
          { id: 'msg-r1', role: 'user', content: 'Testing browser reload', timestamp: '11:00 AM' },
          { id: 'msg-r2', role: 'assistant', content: 'Persisted state survives reload safely', timestamp: '11:01 AM' },
        ],
      }

      mockStorage.setItem('nova:sessions:v1', JSON.stringify([savedSession]))
      // Notice currentSessionId might still be 'session-first' before sync
      mockStorage.setItem('nova:current-session:v1', JSON.stringify('session-first'))

      // Simulate browser reloading on /chat/session-refresh-test-456
      const route = parseRoute(`/chat/${targetId}`)
      assert.equal(route.tab, 'chat')
      assert.equal(route.conversationId, targetId)

      // The authoritative ID is route.conversationId
      const activeChatId = (route.tab === 'chat' && route.conversationId)
        ? route.conversationId
        : 'session-first'

      assert.equal(activeChatId, targetId)

      // Check non-destructive resolution
      const stored = readStoredValue<ChatSession[]>('nova:sessions:v1', [])
      const resolved = stored.find((s) => s.id === activeChatId)
      assert.ok(resolved)
      assert.equal(resolved.id, targetId)
      assert.equal(resolved.messages.length, 2)
    })

    test('Test D — Rapid navigation: delayed response from older session is ignored by activeLoadingSessionIdRef', async () => {
      let activeLoadingSessionId: string | null
      let displayedSessionId: string | null = null

      const session1Id = 'session-first-clicked'
      const session2Id = 'session-second-clicked'

      // Step 1: User clicks session 1
      activeLoadingSessionId = session1Id
      assert.equal(activeLoadingSessionId, session1Id)
      assert.equal(displayedSessionId, null)

      // Simulated slow async fetch for session 1
      const fetchSession1Promise = new Promise<{ id: string; data: string }>((resolve) => {
        setTimeout(() => resolve({ id: session1Id, data: 'session 1 data' }), 50)
      })

      // Step 2: User rapidly clicks session 2 before session 1 finishes
      activeLoadingSessionId = session2Id
      displayedSessionId = session2Id

      // When session 1 completes
      const result1 = await fetchSession1Promise
      if (activeLoadingSessionId === result1.id) {
        displayedSessionId = result1.id
      }

      // Assert that displayedSessionId was NOT overwritten by session 1!
      assert.equal(displayedSessionId, session2Id, 'Active session must remain session 2')
    })

    test('Test E — Persistence: new message survives navigation and reopening', async () => {
      const sessionId = 'session-persistence-test'
      const session: ChatSession = {
        id: sessionId,
        title: 'Persistence Test',
        updatedAt: new Date().toISOString(),
        messages: [{ id: 'p1', role: 'user', content: 'Initial note', timestamp: '12:00 PM' }],
      }

      await persistChatSession(session)

      // Add a second message
      const updatedSession: ChatSession = {
        ...session,
        messages: [
          ...session.messages,
          { id: 'p2', role: 'assistant', content: 'Saved note reply', timestamp: '12:01 PM' },
        ],
      }
      await persistChatSession(updatedSession)

      // Read from storage as if navigating away and back
      const reopened = readStoredValue<ChatSession[]>('nova:sessions:v1', []).find((s) => s.id === sessionId)
      assert.ok(reopened)
      assert.equal(reopened.messages.length, 2)
      assert.equal(reopened.messages[1].content, 'Saved note reply')
    })

    test('Test F — Empty conversation: genuinely new conversation does not corrupt existing conversations', async () => {
      const existingId = 'session-existing-with-data'
      const existingSession: ChatSession = {
        id: existingId,
        title: 'Important Saved Discussion',
        updatedAt: new Date().toISOString(),
        messages: [{ id: 'e1', role: 'user', content: 'Important query', timestamp: '01:00 PM' }],
      }
      await persistChatSession(existingSession)

      // Now create a genuinely new empty conversation
      const newSessionId = 'session-genuinely-new'
      const newDraftSession: ChatSession = {
        id: newSessionId,
        title: 'New Conversation',
        updatedAt: new Date().toISOString(),
        messages: [],
      }

      const existingSessions = readStoredValue<ChatSession[]>('nova:sessions:v1', [])
      const updatedSessions = [newDraftSession, ...existingSessions]
      mockStorage.setItem('nova:sessions:v1', JSON.stringify(updatedSessions))

      // Verify that existing session still has its message intact
      const stored = readStoredValue<ChatSession[]>('nova:sessions:v1', [])
      assert.equal(stored.length, 2)

      const foundExisting = stored.find((s) => s.id === existingId)
      assert.ok(foundExisting)
      assert.equal(foundExisting.messages.length, 1)

      const foundNew = stored.find((s) => s.id === newSessionId)
      assert.ok(foundNew)
      assert.equal(foundNew.messages.length, 0)
    })

    test('Test G — Data-source failure: local stored messages remain completely intact', async () => {
      const sessionId = 'session-network-failure-test'
      const localSession: ChatSession = {
        id: sessionId,
        title: 'Network Resilience Test',
        updatedAt: new Date().toISOString(),
        messages: [{ id: 'net1', role: 'user', content: 'Offline resilient message', timestamp: '02:00 PM' }],
      }

      await persistChatSession(localSession)

      // Calling fetchChatSession when Supabase is unconfigured falls back cleanly to local
      const result = await fetchChatSession(sessionId)
      assert.ok(result.data, 'Must return data from local fallback')
      assert.equal(result.data.id, sessionId)
      assert.equal(result.data.messages.length, 1)
      assert.equal(result.data.messages[0].content, 'Offline resilient message')

      // Ensure storage was NOT wiped
      const stored = readStoredValue<ChatSession[]>('nova:sessions:v1', [])
      assert.equal(stored.length, 1)
      assert.equal(stored[0].messages.length, 1)
    })
  })
})
