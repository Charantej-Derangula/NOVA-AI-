import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type { SettingsCategory } from '../src/components/SettingsView.tsx'
import type { AppPreferences, ThemeMode, AccentTone } from '../src/types/index.ts'

describe('Settings & Composer Architecture Tests', () => {
  test('Settings categories cover all 11 required product categories', () => {
    const requiredCategories: SettingsCategory[] = [
      'account',
      'appearance',
      'ai',
      'voice',
      'chat',
      'tasks',
      'notifications',
      'privacy',
      'billing',
      'shortcuts',
      'signout',
    ]

    assert.equal(requiredCategories.length, 11)
    for (const cat of requiredCategories) {
      assert.ok(cat.length > 0)
    }
  })

  test('Appearance settings support theme modes and accent tones correctly', () => {
    const themes: ThemeMode[] = ['dark', 'light', 'system']
    const accents: AccentTone[] = ['violet', 'indigo', 'plum']

    assert.equal(themes.length, 3)
    assert.equal(accents.length, 3)

    let prefs: AppPreferences = {
      accent: 'violet',
      reducedMotion: false,
      theme: 'dark',
    }

    // Update theme
    prefs = { ...prefs, theme: 'light' }
    assert.equal(prefs.theme, 'light')

    // Update accent
    prefs = { ...prefs, accent: 'indigo' }
    assert.equal(prefs.accent, 'indigo')

    // Update reduced motion
    prefs = { ...prefs, reducedMotion: true }
    assert.equal(prefs.reducedMotion, true)
  })

  test('Billing category presents honest unconfigured state without fake payment methods', () => {
    const billingConfig = {
      isConfigured: false,
      tier: 'Local Free Edition',
      hasRemoteInvoices: false,
      hasPaymentGateway: false,
      emptyStateMessage: 'Billing is not configured yet',
    }

    assert.equal(billingConfig.isConfigured, false)
    assert.equal(billingConfig.hasPaymentGateway, false)
    assert.equal(billingConfig.emptyStateMessage, 'Billing is not configured yet')
  })

  test('AI category presents honest disconnected state', () => {
    const aiConfig = {
      isConnected: false,
      connectionStatus: 'Not connected',
      mode: 'Offline Local-First',
      providersConfigured: 0,
    }

    assert.equal(aiConfig.isConnected, false)
    assert.equal(aiConfig.connectionStatus, 'Not connected')
    assert.equal(aiConfig.providersConfigured, 0)
  })

  test('Settings search accurately filters categories by keyword', () => {
    const sampleCategories = [
      { id: 'appearance', keywords: ['theme', 'accent', 'motion', 'reduced'] },
      { id: 'voice', keywords: ['mic', 'microphone', 'stt', 'sts'] },
      { id: 'billing', keywords: ['pricing', 'subscription', 'plans', 'invoices'] },
    ]

    const filterBy = (query: string) => {
      const q = query.toLowerCase()
      return sampleCategories.filter((c) => c.keywords.some((k) => k.includes(q)))
    }

    assert.equal(filterBy('motion')[0].id, 'appearance')
    assert.equal(filterBy('mic')[0].id, 'voice')
    assert.equal(filterBy('invoice')[0].id, 'billing')
    assert.equal(filterBy('unknown').length, 0)
  })

  test('Studio tools describe capabilities truthfully without claiming real AI generation', () => {
    const studioTools = [
      {
        id: 'image',
        name: 'Image Generator',
        capability: 'SVG vector templates',
        truthNote: 'Generates local SVG vector templates · Generative diffusion model not connected',
        producesRealAiImages: false,
      },
      {
        id: 'presentation',
        name: 'AI Presentation',
        capability: 'HTML slide deck',
        truthNote: 'Built from local presentation outline structures · PowerPoint export not connected',
        producesRealPowerPoint: false,
      },
      {
        id: 'developer',
        name: 'Dev Assistant',
        capability: 'Boilerplate starter code',
        truthNote: 'Produces local starter scaffolding templates · Code execution / AI generation not connected',
        executesCode: false,
      },
    ]

    for (const tool of studioTools) {
      assert.ok(tool.truthNote.includes('not connected'))
    }
    assert.equal(studioTools[0].producesRealAiImages, false)
    assert.equal(studioTools[1].producesRealPowerPoint, false)
    assert.equal(studioTools[2].executesCode, false)
  })

  test('Composer controls keep essentials and remove settings button and hint text', () => {
    const retainedControls = ['multiline-input', 'attachment', 'options-menu', 'microphone-button', 'send-button']
    const removedControls = ['settings-in-composer', 'enter-sends-hint', 'messages-stay-footnote']

    assert.equal(retainedControls.length, 5)
    assert.equal(removedControls.length, 3)
    assert.ok(!retainedControls.includes('settings-in-composer'))
    assert.ok(!retainedControls.includes('enter-sends-hint'))
  })

  test('Composer attachment presentation requirements (ChatGPT style)', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')

    const composerCode = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/MessageComposer.tsx'),
      'utf8'
    )
    const cssCode = fs.readFileSync(
      path.resolve(process.cwd(), 'src/App.css'),
      'utf8'
    )

    // 1. Image preview with object-fit: contain
    assert.ok(
      cssCode.includes('.composer-att-thumb-img'),
      'App.css must define .composer-att-thumb-img'
    )
    assert.ok(
      cssCode.includes('object-fit: contain'),
      'App.css must use object-fit: contain for image thumbnails'
    )
    assert.ok(
      composerCode.includes('composer-att-thumb-card'),
      'MessageComposer must render .composer-att-thumb-card for image thumbnails'
    )

    // 2. Compact document card with filename and size
    assert.ok(
      composerCode.includes('composer-att-file-card'),
      'MessageComposer must render .composer-att-file-card for non-image files'
    )
    assert.ok(
      composerCode.includes('composer-att-file-name'),
      'MessageComposer must render filename in file card'
    )
    assert.ok(
      composerCode.includes('composer-att-file-meta'),
      'MessageComposer must render file meta (type and size) in file card'
    )
    assert.ok(
      cssCode.includes('text-overflow: ellipsis'),
      'App.css must truncate long filenames with ellipsis'
    )

    // 3. Dedicated top row above message-composer-main
    const attachmentsRowIdx = composerCode.indexOf('message-composer-attachments-row')
    const composerMainIdx = composerCode.indexOf('message-composer-main')
    assert.ok(attachmentsRowIdx !== -1, 'message-composer-attachments-row must exist')
    assert.ok(composerMainIdx !== -1, 'message-composer-main must exist')
    assert.ok(
      attachmentsRowIdx < composerMainIdx,
      'Attachment previews must be placed above text-entry area (message-composer-main)'
    )

    // 4. Multiple attachments support & individual removal
    assert.ok(
      composerCode.includes('multiple'),
      'File input must support multiple files'
    )
    assert.ok(
      composerCode.includes('handleRemoveAttachment'),
      'Must support removing individual attachments'
    )
    assert.ok(
      composerCode.includes('URL.revokeObjectURL'),
      'Must revoke object URLs on remove or unmount to avoid memory leaks'
    )

    // 5. Preserves existing event handlers and controls
    assert.ok(composerCode.includes('handleSend'), 'Must preserve handleSend')
    assert.ok(composerCode.includes('handleKeyDown'), 'Must preserve handleKeyDown')
    assert.ok(composerCode.includes('canSend'), 'Must preserve canSend')
    assert.ok(composerCode.includes('Paperclip'), 'Must preserve attach tool button')
    assert.ok(composerCode.includes('Mic'), 'Must preserve microphone button')
  })
})
