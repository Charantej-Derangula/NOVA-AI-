import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const rootDir = path.resolve(import.meta.dirname, '..')

describe('Production Voice Experience (Screen A & Screen B) Tests', () => {
  const voiceSrc = fs.readFileSync(path.join(rootDir, 'src/components/VoiceExperience.tsx'), 'utf-8')
  const orbSrc = fs.readFileSync(path.join(rootDir, 'src/components/SiriVoiceOrb.tsx'), 'utf-8')
  const appSrc = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf-8')
  const headerSrc = fs.readFileSync(path.join(rootDir, 'src/components/Header.tsx'), 'utf-8')
  const appCss = fs.readFileSync(path.join(rootDir, 'src/App.css'), 'utf-8')

  test('VoiceExperience enforces stationary one-viewport layout without outer scrolling', () => {
    // Top-level container must be fixed full-screen without outer scroll
    assert.match(voiceSrc, /fixed inset-0/)
    assert.match(voiceSrc, /overflow-hidden/)
    assert.match(voiceSrc, /h-\[100dvh\]/)
    assert.match(voiceSrc, /max-h-\[100dvh\]/)

    // Body overflow is locked on mount
    assert.match(voiceSrc, /document\.body\.style\.overflow\s*=\s*'hidden'/)

    // Content cards handle long transcripts via internal overflow scrolling
    assert.match(voiceSrc, /overflow-y-auto/)
  })

  test('Screen A (Listening state) contains all reference elements', () => {
    // Eyebrow, prominent heading, and subtitle matching reference
    assert.match(voiceSrc, /A quiet space to think out loud/i)
    assert.match(voiceSrc, /I’m listening/)
    assert.match(voiceSrc, /Speak naturally\. NOVA is listening\./)

    // Center microphone control with "Tap to speak" label
    assert.match(voiceSrc, /Tap to speak/)

    // Top toolbar elements: back button, model pill with session status indicator, speaker control
    assert.match(voiceSrc, /ChevronLeft/)
    assert.match(voiceSrc, /NOVA 3\.0/)
    assert.match(voiceSrc, /toggleSpeakerMute/)

    // Left transcript icon and right end session X control
    assert.match(voiceSrc, /TranscriptBubbleIcon/)
    assert.match(voiceSrc, /aria-label="End session"/)
  })

  test('Screen B (Assistant-Speaking state) contains all reference elements', () => {
    // Status label and dynamic audio waveform
    assert.match(voiceSrc, /NOVA is responding\.\.\./)
    assert.match(voiceSrc, /WaveformBars/)

    // Compact response card with NOVA label and real assistant text
    assert.match(voiceSrc, /assistantSpokenText/)
    assert.match(voiceSrc, /<span className="text-xs font-semibold tracking-wider text-white">NOVA<\/span>/)

    // Center pause/stop control with "Tap to stop" label
    assert.match(voiceSrc, /PausePillIcon/)
    assert.match(voiceSrc, /Tap to stop/)
    assert.match(voiceSrc, /handleInterrupt/)
  })

  test('Persistent animated Siri voice orb remains mounted across state transitions', () => {
    // SiriVoiceOrb receives responsive size and state without conditional unmounting
    assert.match(voiceSrc, /<SiriVoiceOrb/)
    assert.match(voiceSrc, /size=\{isSpeakingScreen \? compactOrbSize : largeOrbSize\}/)

    // SiriVoiceOrb implementation guarantees scale transform safety and render lifecycle
    assert.match(orbSrc, /ctx\.setTransform\(dpr,\s*0,\s*0,\s*dpr,\s*0,\s*0\)/)
    assert.match(orbSrc, /animFrameRef/)
  })

  test('Conversation transcript drawer provides accessible dialogue inspection and copying', () => {
    assert.match(voiceSrc, /showTranscriptDrawer/)
    assert.match(voiceSrc, /Conversation Transcript/)
    assert.match(voiceSrc, /conversationTurns/)
    assert.match(voiceSrc, /handleCopyText/)
  })

  test('Mobile navigation and shared header are completely removed during voice mode', () => {
    // mobile-tabbar is only rendered when activeVoiceMode is null
    assert.match(appSrc, /activeVoiceMode\s*===\s*null\s*&&\s*\(\s*<nav className="mobile-tabbar"/)
    // Header is only rendered when activeVoiceMode is null
    assert.match(appSrc, /activeVoiceMode\s*===\s*null\s*&&\s*\(\s*<Header/)
  })

  test('Header provides clean layout with mobile-brand and removes global search and avatar', () => {
    assert.doesNotMatch(headerSrc, /topbar-search-toggle-mobile/)
    assert.doesNotMatch(headerSrc, /topbar-search-form/)
    assert.match(headerSrc, /mobile-brand/)
  })

  test('Mobile quick-actions row wraps in a clean 2-row ribbon without horizontal scroll', () => {
    assert.match(appCss, /\.chat-quick-actions-row\s*\{[^}]*flex-wrap:\s*wrap/s)
  })
})
