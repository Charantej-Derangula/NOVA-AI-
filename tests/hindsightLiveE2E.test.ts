import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getHindsightConfig,
  retainHindsightMemory,
  recallHindsightMemories,
} from '../server/hindsightService.ts'

test('Hindsight Cloud Live E2E: Store Harmless Fact & Recall in Separate Request', async () => {
  const { isConfigured, config } = getHindsightConfig(true)

  if (!isConfigured) {
    console.log('[SKIP] HINDSIGHT_API_KEY not configured in .env. Skipping live network test.')
    return
  }

  const bankId = config.bankId || 'Nova'
  const uniqueTimestamp = Date.now()
  const testFact = `Automated verification fact: Nova project integration confirmed at epoch ${uniqueTimestamp}`

  console.log(`[Hindsight Live E2E] Storing harmless test fact to bank "${bankId}"...`)
  const retainResult = await retainHindsightMemory({
    bankId,
    content: testFact,
    context: 'Automated E2E memory verification test',
    tags: ['nova-test', 'live-e2e'],
  })

  // Handle offline sandbox environment where external network access is blocked
  if (!retainResult.success && retainResult.error?.includes('fetch failed')) {
    console.log('[SANDBOX / OFFLINE] Network access to api.hindsight.vectorize.io blocked by execution sandbox. Skipping live cloud assertion.')
    return
  }

  // 1. Verify retention succeeded
  assert.strictEqual(
    retainResult.success,
    true,
    `Retain request should succeed: ${retainResult.error || retainResult.reason}`
  )
  assert.strictEqual(
    retainResult.retained,
    true,
    `Fact should be retained by Hindsight policy: ${retainResult.reason}`
  )

  console.log(`[Hindsight Live E2E] Recalling test fact in separate request from bank "${bankId}"...`)
  const recallResult = await recallHindsightMemories({
    bankId,
    query: `epoch ${uniqueTimestamp} verification fact`,
    limit: 5,
  })

  // 2. Verify separate recall request succeeded
  assert.strictEqual(
    recallResult.success,
    true,
    `Recall request should succeed: ${recallResult.error}`
  )
  assert.strictEqual(
    recallResult.source,
    'hindsight',
    'Recall result source should be "hindsight"'
  )
  assert.ok(
    recallResult.results.length > 0,
    'Recall should return at least one memory item'
  )

  const matchingFact = recallResult.results.find(
    (item) =>
      item.text.includes(String(uniqueTimestamp)) ||
      item.text.includes('Automated verification fact') ||
      item.text.includes('Nova project integration')
  )

  assert.ok(
    matchingFact,
    `Expected recalled results to contain stored fact with epoch ${uniqueTimestamp}. Returned: ${JSON.stringify(recallResult.results)}`
  )
  console.log(`[Hindsight Live E2E] Successfully stored and recalled fact ID: ${matchingFact?.id}`)
})
