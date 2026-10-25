import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  resampleAudioBuffer,
  float32ToInt16PCM,
  pcmToBase64,
  base64ToFloat32PCM,
  calculateRMS,
} from '../src/utils/geminiLiveAudio.ts'

describe('Gemini Live Audio Processing Tests', () => {
  test('float32ToInt16PCM clamps values within range and converts accurately', () => {
    const input = new Float32Array([-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5])
    const pcm = float32ToInt16PCM(input)

    assert.equal(pcm.length, 7)
    assert.equal(pcm[0], -32768) // Clamped to min
    assert.equal(pcm[1], -32768)
    assert.equal(pcm[2], -16384)
    assert.equal(pcm[3], 0)
    assert.equal(pcm[4], 16383)
    assert.equal(pcm[5], 32767)
    assert.equal(pcm[6], 32767) // Clamped to max
  })

  test('pcmToBase64 and base64ToFloat32PCM roundtrip matches within 16-bit precision', () => {
    const original = new Float32Array([0.0, 0.25, -0.25, 0.75, -0.75])
    const pcm = float32ToInt16PCM(original)
    const base64 = pcmToBase64(pcm)

    assert.ok(typeof base64 === 'string')
    assert.ok(base64.length > 0)

    const reconstructed = base64ToFloat32PCM(base64)
    assert.equal(reconstructed.length, original.length)

    for (let i = 0; i < original.length; i++) {
      const delta = Math.abs(reconstructed[i] - original[i])
      assert.ok(delta < 0.001, `Index ${i} delta ${delta} exceeds precision tolerance`)
    }
  })

  test('resampleAudioBuffer downsamples 48kHz to 16kHz with proportional length', () => {
    const inputRate = 48000
    const outputRate = 16000
    const input = new Float32Array(4800) // 100ms at 48kHz
    for (let i = 0; i < input.length; i++) {
      input[i] = Math.sin((i / 48000) * 2 * Math.PI * 440) // 440 Hz sine wave
    }

    const resampled = resampleAudioBuffer(input, inputRate, outputRate)
    // 4800 / 3 = 1600 samples (100ms at 16kHz)
    assert.equal(resampled.length, 1600)
    assert.ok(Math.abs(resampled[0]) < 0.01)
  })

  test('calculateRMS correctly measures energy of silence vs full amplitude wave', () => {
    const silence = new Float32Array(100).fill(0)
    assert.equal(calculateRMS(silence), 0)

    const fullWave = new Float32Array(100)
    for (let i = 0; i < 100; i++) {
      fullWave[i] = i % 2 === 0 ? 1.0 : -1.0
    }
    const rms = calculateRMS(fullWave)
    assert.equal(Math.round(rms * 100) / 100, 1.0)
  })
})
