import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const rootDir = path.resolve(import.meta.dirname, '..')

describe('Global Typography System Tests', () => {
  const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8')
  const appCss = fs.readFileSync(path.join(rootDir, 'src/App.css'), 'utf-8')
  const formattedMessageTsx = fs.readFileSync(path.join(rootDir, 'src/components/FormattedMessage.tsx'), 'utf-8')
  const chatViewTsx = fs.readFileSync(path.join(rootDir, 'src/components/ChatView.tsx'), 'utf-8')
  const historyViewTsx = fs.readFileSync(path.join(rootDir, 'src/components/HistoryView.tsx'), 'utf-8')

  test('src/index.css declares modern font-family tokens and base font scale', () => {
    assert.match(indexCss, /--font-sans:\s*'Inter'/)
    assert.match(indexCss, /--nova-font-sans:\s*var\(--font-sans\)/)
    assert.match(indexCss, /--font-mono:\s*ui-monospace/)
    assert.match(indexCss, /--nova-font-mono:\s*var\(--font-mono\)/)
    assert.match(indexCss, /--nova-type-body:\s*15px/)
    assert.match(indexCss, /--nova-type-control:\s*13\.5px/)
    assert.match(indexCss, /--nova-type-caption:\s*12px/)
    assert.match(indexCss, /-webkit-font-smoothing:\s*antialiased/)
    assert.match(indexCss, /text-rendering:\s*optimizeLegibility/)
    assert.match(indexCss, /font-size:\s*15px/)
    assert.match(indexCss, /line-height:\s*1\.6/)
  })

  test('src/App.css enforces restrained page heading scale (clamp max <= 28px)', () => {
    // Check that primary view headings use clamp(22px, 2.5vw, 26px) or similar restrained ranges
    assert.match(appCss, /\.page-content h1\s*\{[^}]*font-size:\s*clamp\(22px,\s*2\.5vw,\s*26px\)/)
    assert.match(appCss, /\.day-heading h1\s*\{[^}]*font-size:\s*clamp\(22px,\s*2\.5vw,\s*26px\)/)
    assert.match(appCss, /\.tasks-heading h1\s*\{[^}]*font-size:\s*clamp\(22px,\s*2\.5vw,\s*26px\)/)
    assert.match(appCss, /\.library-heading h1\s*\{[^}]*font-size:\s*clamp\(22px,\s*2\.5vw,\s*26px\)/)
    assert.match(appCss, /\.history-page h1,\s*\.settings-page h1\s*\{[^}]*font-size:\s*clamp\(22px,\s*2\.5vw,\s*26px\)/)

    // Ensure oversized 49px - 60px heading clamps have been eliminated
    assert.doesNotMatch(appCss, /clamp\(34px,\s*4vw,\s*49px\)/)
    assert.doesNotMatch(appCss, /clamp\(36px,\s*4vw,\s*49px\)/)
    assert.doesNotMatch(appCss, /clamp\(46px,\s*3\.6vw,\s*60px\)/)
  })

  test('src/App.css sets chat message bubble to natural reading size and full width within message row', () => {
    // Bubble font size 15px with line-height ~1.62
    assert.match(appCss, /\.chat-message-bubble\s*\{[^}]*font-size:\s*15px/)
    assert.match(appCss, /\.chat-message-bubble\s*\{[^}]*line-height:\s*1\.62/)

    // Bubble does not have the artificial double-constraining max-width: min(76%, 700px)
    assert.doesNotMatch(appCss, /\.chat-message-bubble\s*\{[^}]*max-width:\s*min\(76%/)
    assert.match(appCss, /\.chat-message-bubble\s*\{[^}]*max-width:\s*100%/)

    // Metadata is 12px secondary
    assert.match(appCss, /\.chat-message-meta\s*\{[^}]*font-size:\s*12px/)
  })

  test('FormattedMessage.tsx defines structured list parsing for bullet characters (-, *, +, and •)', () => {
    // Matches unicode bullet and standard Markdown bullets
    assert.match(formattedMessageTsx, /isBulletItem\(line:\s*string\)/)
    assert.match(formattedMessageTsx, /\[-\*\+•\]/)
    // Renders list items with structured ul/li elements and bullet points
    assert.match(formattedMessageTsx, /className="chat-list chat-list--bullet/)
    assert.match(formattedMessageTsx, /<li key=\{`li-\$\{itIdx\}`\} className="text-\[15px\] leading-\[1\.58\]/)
    assert.match(formattedMessageTsx, /className="chat-formatted-message text-\[15px\] leading-\[1\.62\]/)
  })

  test('FormattedMessage.tsx contains restrained heading scales (text-[20px] down to text-[14.5px])', () => {
    assert.match(formattedMessageTsx, /text-\[20px\] font-semibold text-white leading-snug/)
    assert.match(formattedMessageTsx, /text-\[17px\] font-semibold text-violet-100 leading-snug/)
    assert.match(formattedMessageTsx, /text-\[15\.5px\] font-semibold text-violet-100 leading-snug/)
    assert.match(formattedMessageTsx, /text-\[14\.5px\] font-semibold text-violet-200 leading-snug/)
  })

  test('ChatView.tsx uses 15px font-size and comfortable reading width for messages', () => {
    // User bubble has natural reading size
    assert.match(chatViewTsx, /text-\[15px\] leading-\[1\.62\]/)
    // Assistant message row has comfortable reading container max-width
    assert.match(chatViewTsx, /max-w-\[92%\] sm:max-w-\[840px\]/)
  })

  test('HistoryView.tsx uses clean sans-serif typography instead of serif italics', () => {
    assert.doesNotMatch(historyViewTsx, /font-serif italic/)
    assert.match(historyViewTsx, /text-2xl sm:text-\[26px\] font-semibold/)
  })
})
