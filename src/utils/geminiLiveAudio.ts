/**
 * Audio processing utilities for Google Gemini Live API.
 * Handles PCM 16kHz conversion for input, PCM 24kHz decoding for output,
 * gapless scheduling, resampling, and audio analysis.
 */

/**
 * Resamples a Float32Array from inputRate to outputRate using linear interpolation.
 */
export function resampleAudioBuffer(
  input: Float32Array,
  inputRate: number,
  outputRate: number = 16000
): Float32Array {
  if (inputRate === outputRate || input.length === 0) {
    return input
  }
  const ratio = inputRate / outputRate
  const newLength = Math.round(input.length / ratio)
  const result = new Float32Array(newLength)

  for (let i = 0; i < newLength; i++) {
    const originalPos = i * ratio
    const index = Math.floor(originalPos)
    const nextIndex = Math.min(index + 1, input.length - 1)
    const frac = originalPos - index
    result[i] = input[index] * (1 - frac) + input[nextIndex] * frac
  }

  return result
}

/**
 * Converts Float32 audio samples (-1.0 to 1.0) into 16-bit signed integer linear PCM (little-endian).
 */
export function float32ToInt16PCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return output
}

/**
 * Encodes an ArrayBuffer or TypedArray into a base64 string.
 * Compatible with both Browser and Node.js environments.
 */
export function pcmToBase64(buffer: ArrayBuffer | Int16Array): string {
  const bytes = buffer instanceof Int16Array
    ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    : new Uint8Array(buffer)

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }

  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

/**
 * Decodes a base64 string containing raw 16-bit signed PCM samples (typically 24kHz from Gemini Live)
 * into a Float32Array normalized between -1.0 and 1.0 for Web Audio API playback.
 */
export function base64ToFloat32PCM(base64: string): Float32Array {
  let binaryString: string
  if (typeof Buffer !== 'undefined') {
    binaryString = Buffer.from(base64, 'base64').toString('binary')
  } else {
    binaryString = window.atob(base64)
  }

  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  const int16Array = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2))
  const float32Array = new Float32Array(int16Array.length)
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768.0
  }

  return float32Array
}

/**
 * Computes root-mean-square (RMS) energy from time-domain audio samples.
 */
export function calculateRMS(samples: Uint8Array | Float32Array): number {
  if (samples.length === 0) return 0
  let sumSquared = 0

  if (samples instanceof Uint8Array) {
    for (let i = 0; i < samples.length; i++) {
      const normalized = (samples[i] - 128) / 128
      sumSquared += normalized * normalized
    }
  } else {
    for (let i = 0; i < samples.length; i++) {
      sumSquared += samples[i] * samples[i]
    }
  }

  return Math.sqrt(sumSquared / samples.length)
}
