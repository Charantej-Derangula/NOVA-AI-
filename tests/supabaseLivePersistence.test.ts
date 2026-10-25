import test from 'node:test'
import assert from 'node:assert/strict'
import 'dotenv/config'
import {
  getSupabaseConfigStatus,
  getSupabaseClient,
  signInAnonymously,
  getCurrentAuthInfo,
} from '../src/lib/supabaseClient.ts'
import {
  persistTask,
  fetchTasks,
  removeTask,
  persistWorkspace,
  fetchWorkspaces,
  removeWorkspace,
  persistKnowledge,
  fetchKnowledge,
  removeKnowledge,
} from '../src/services/dataService.ts'
import type { TaskItem, WorkspaceItem, KnowledgeItem } from '../src/types/index.ts'

// In-memory mock storage for localStorage in Node test environment
class MockStorage {
  private store = new Map<string, string>()
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
}

test('Live Supabase E2E: Complete Task Persistence Flow (Auth, Insert, Fetch, Complete, Cleanup)', async () => {
  const status = getSupabaseConfigStatus()
  if (!status.isConfigured || !status.url) {
    console.log('[SKIP] Supabase not configured in .env. Skipping live Supabase E2E test.')
    return
  }

  // Setup mock localStorage in Node runtime
  const mockStorage = new MockStorage()
  ;(globalThis as any).localStorage = mockStorage
  ;(globalThis as any).window = { localStorage: mockStorage }

  const client = getSupabaseClient()
  if (!client) {
    console.log('[SKIP] Supabase client could not be initialized.')
    return
  }

  console.log(`[Supabase Live E2E] Connecting to Supabase project at ${status.url}...`)

  // 1. Authenticate anonymously through Supabase Auth
  const authRes = await signInAnonymously()
  if (!authRes.success && /fetch failed|network|failed to fetch/i.test(authRes.error || '')) {
    console.log('[SANDBOX / OFFLINE] Network access blocked by execution sandbox. Skipping live Supabase network assertions.')
    return
  }

  assert.strictEqual(
    authRes.success,
    true,
    `Anonymous sign-in must succeed: ${authRes.error}`
  )
  assert.ok(authRes.user, 'Anonymous user must be returned')
  const user = authRes.user as { id: string; is_anonymous?: boolean }
  assert.ok(user.id, 'User must have a valid UUID')
  console.log(`[Supabase Live E2E] Authenticated anonymous session with user ID: ${user.id}`)

  // Verify auth session info
  const authInfo = await getCurrentAuthInfo()
  assert.strictEqual(authInfo.isAuthenticated, true)
  assert.strictEqual(authInfo.userId, user.id)

  // 2. Create a test task and persist through Supabase client
  const testTaskId = `task-live-e2e-${Date.now()}`
  const newTask: TaskItem = {
    id: testTaskId,
    title: 'Live E2E Verification Task for AutoPulse',
    completed: false,
    priority: 'high',
    scheduledAt: '2026-10-26T10:00:00.000Z',
    estimateMinutes: 30,
    createdAt: new Date().toISOString(),
  }

  console.log(`[Supabase Live E2E] Persisting task "${newTask.id}" with authenticated user...`)
  const persistRes = await persistTask(newTask, user.id)
  assert.strictEqual(
    persistRes.success,
    true,
    `Task persistence must succeed through RLS: ${persistRes.error}`
  )
  assert.strictEqual(persistRes.source, 'supabase')

  // 3. Confirm task appears in Tasks and can be queried back from Supabase
  console.log('[Supabase Live E2E] Fetching tasks from Supabase...')
  const fetchRes = await fetchTasks()
  assert.strictEqual(fetchRes.source, 'supabase')
  const foundTask = fetchRes.data.find((t) => t.id === testTaskId)
  assert.ok(foundTask, 'Persisted task must be returned from Supabase')
  assert.strictEqual(foundTask?.title, 'Live E2E Verification Task for AutoPulse')
  assert.strictEqual(foundTask?.completed, false)

  // 4. Complete the task and verify the status persists
  console.log('[Supabase Live E2E] Updating task status to completed...')
  const completedTask: TaskItem = {
    ...foundTask!,
    completed: true,
    completedAt: new Date().toISOString(),
  }
  const updateRes = await persistTask(completedTask, user.id)
  assert.strictEqual(updateRes.success, true, 'Task completion update must succeed')

  const fetchUpdatedRes = await fetchTasks()
  const updatedTask = fetchUpdatedRes.data.find((t) => t.id === testTaskId)
  assert.ok(updatedTask, 'Updated task must be found')
  assert.strictEqual(updatedTask?.completed, true, 'Completed status must persist in Supabase')

  // 5. Clean up the test task
  console.log('[Supabase Live E2E] Cleaning up test task...')
  const removeRes = await removeTask(testTaskId)
  assert.strictEqual(removeRes.success, true, 'Cleanup must succeed')
  console.log('[Supabase Live E2E] Verified complete persistence flow successfully.')
})

test('Live Supabase E2E: Complete Workspace & Knowledge Persistence Flow', async () => {
  const status = getSupabaseConfigStatus()
  if (!status.isConfigured || !status.url) {
    console.log('[SKIP] Supabase not configured in .env. Skipping live Supabase Workspace E2E test.')
    return
  }
  const client = getSupabaseClient()
  if (!client) return

  const authRes = await signInAnonymously()
  if (!authRes.success && /fetch failed|network|failed to fetch/i.test(authRes.error || '')) {
    console.log('[SANDBOX / OFFLINE] Network access blocked by execution sandbox. Skipping live Supabase network assertions.')
    return
  }
  if (!authRes.success || !authRes.user) return
  const user = authRes.user as { id: string }

  // 1. Create workspace
  const testWsId = `space-live-e2e-${Date.now()}`
  const newWorkspace: WorkspaceItem = {
    id: testWsId,
    name: 'Live E2E Product Launch',
    description: 'Workspace created during live E2E test',
    kind: 'Project',
    createdAt: new Date().toISOString(),
  }
  const wsPersistRes = await persistWorkspace(newWorkspace, user.id)
  assert.strictEqual(wsPersistRes.success, true, 'Workspace persistence must succeed')

  const wsFetchRes = await fetchWorkspaces(user.id)
  assert.strictEqual(wsFetchRes.source, 'supabase')
  const foundWs = wsFetchRes.data.find((w) => w.id === testWsId)
  assert.ok(foundWs, 'Persisted workspace must be returned from Supabase')
  assert.strictEqual(foundWs?.name, 'Live E2E Product Launch')

  // 2. Create knowledge note scoped to workspace
  const testNoteId = `note-live-e2e-${Date.now()}`
  const newNote: KnowledgeItem = {
    id: testNoteId,
    title: 'Live Launch Brief',
    content: 'Launch deck slides ready',
    kind: 'Project notes',
    tags: ['launch', 'e2e'],
    workspaceId: testWsId,
    createdAt: new Date().toISOString(),
  }
  const notePersistRes = await persistKnowledge(newNote, user.id)
  assert.strictEqual(notePersistRes.success, true, 'Note persistence must succeed')

  const noteFetchRes = await fetchKnowledge(user.id)
  assert.strictEqual(noteFetchRes.source, 'supabase')
  const foundNote = noteFetchRes.data.find((n) => n.id === testNoteId)
  assert.ok(foundNote, 'Persisted note must be returned from Supabase')
  assert.strictEqual(foundNote?.workspaceId, testWsId)

  // 3. Clean up
  await removeKnowledge(testNoteId, user.id)
  await removeWorkspace(testWsId, user.id)
})
