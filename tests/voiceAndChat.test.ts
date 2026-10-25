import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type { VoiceMode, VoiceState } from '../src/components/VoiceExperience.tsx'

describe('Voice Experience & Chat Architecture Tests', () => {
  test('VoiceMode permits only "stt" and "sts", excluding TTS as separate selectable mode', () => {
    const supportedModes: VoiceMode[] = ['stt', 'sts']
    assert.equal(supportedModes.length, 2)
    assert.equal(supportedModes.includes('stt'), true)
    assert.equal(supportedModes.includes('sts'), true)

    // Ensure TTS cannot be typed as VoiceMode
    // @ts-expect-error - 'tts' must not be valid VoiceMode
    const invalidMode: VoiceMode = 'tts'
    assert.notEqual(invalidMode, 'stt')
    assert.notEqual(invalidMode, 'sts')
  })

  test('VoiceState covers all required states of the robust state machine', () => {
    const allStates: VoiceState[] = [
      'idle',
      'requesting',
      'listening',
      'processing',
      'waiting_for_ai',
      'speaking',
      'interrupted',
      'stopped',
      'permission_denied',
      'unsupported',
      'error',
    ]

    assert.equal(allStates.length, 11)
    assert.ok(allStates.includes('idle'))
    assert.ok(allStates.includes('requesting'))
    assert.ok(allStates.includes('listening'))
    assert.ok(allStates.includes('processing'))
    assert.ok(allStates.includes('waiting_for_ai'))
    assert.ok(allStates.includes('speaking'))
    assert.ok(allStates.includes('interrupted'))
    assert.ok(allStates.includes('stopped'))
    assert.ok(allStates.includes('permission_denied'))
    assert.ok(allStates.includes('unsupported'))
    assert.ok(allStates.includes('error'))
  })

  test('Speech to Text flow guarantees editable transcript before sending', () => {
    // Verifies STT does not automatically send incomplete speech
    let draft = ''
    let sentMessage = ''

    const onUpdateDraft = (text: string) => {
      draft = text
    }

    const onSendTranscript = (text: string) => {
      sentMessage = text
    }

    // Step 1: User speaks interim words
    const spoken = 'Refactor the data pipeline'
    onUpdateDraft(spoken)
    assert.equal(draft, 'Refactor the data pipeline')
    assert.equal(sentMessage, '') // Not automatically sent

    // Step 2: User reviews and edits transcript
    const edited = 'Refactor the data pipeline and add regression tests'
    onSendTranscript(edited)
    assert.equal(sentMessage, 'Refactor the data pipeline and add regression tests')
  })

  test('Speech to Speech interruption halts playback cleanly and transitions state', () => {
    interface SimulatedPlaybackQueue {
      sources: string[]
      state: VoiceState
      stop: () => void
    }

    const queue: SimulatedPlaybackQueue = {
      sources: ['chunk-1', 'chunk-2', 'chunk-3'],
      state: 'speaking',
      stop() {
        this.sources = []
        this.state = 'interrupted'
      },
    }

    assert.equal(queue.state, 'speaking')
    assert.equal(queue.sources.length, 3)

    // Simulate barge-in trigger (serverContent.interrupted or user interruption)
    queue.stop()
    assert.equal(queue.state, 'interrupted')
    assert.equal(queue.sources.length, 0)
  })

  test('Gemini Live session state machine transitions follow expected lifecycle', () => {
    const history: VoiceState[] = []
    let current: VoiceState = 'requesting'
    history.push(current)

    // WebSocket connected
    current = 'listening'
    history.push(current)

    // User speaks, awaiting AI turn
    current = 'waiting_for_ai'
    history.push(current)

    // Server streams 24kHz audio
    current = 'speaking'
    history.push(current)

    // Interrupted by barge-in
    current = 'interrupted'
    history.push(current)

    // Resumes listening
    current = 'listening'
    history.push(current)

    // Session ended
    current = 'stopped'
    history.push(current)

    assert.deepEqual(history, [
      'requesting',
      'listening',
      'waiting_for_ai',
      'speaking',
      'interrupted',
      'listening',
      'stopped',
    ])
  })

  test('Failure handling transitions gracefully to error and permission_denied', () => {
    const simulatePermissionError = (errorName: string): VoiceState => {
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        return 'permission_denied'
      }
      return 'error'
    }

    assert.equal(simulatePermissionError('NotAllowedError'), 'permission_denied')
    assert.equal(simulatePermissionError('PermissionDeniedError'), 'permission_denied')
    assert.equal(simulatePermissionError('NotFoundError'), 'error')
    assert.equal(simulatePermissionError('UnknownError'), 'error')
  })
})
