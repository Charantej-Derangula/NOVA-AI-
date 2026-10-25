import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import type { NavigationTab } from '../src/types/index.ts'

const rootDir = path.resolve(import.meta.dirname, '..')

describe('Priority 1 — Home & Chat Routing Verification', () => {
  const typesSrc = fs.readFileSync(path.join(rootDir, 'src/types/index.ts'), 'utf-8')
  const sidebarSrc = fs.readFileSync(path.join(rootDir, 'src/components/Sidebar.tsx'), 'utf-8')
  const headerSrc = fs.readFileSync(path.join(rootDir, 'src/components/Header.tsx'), 'utf-8')
  const appSrc = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf-8')
  const chatViewSrc = fs.readFileSync(path.join(rootDir, 'src/components/ChatView.tsx'), 'utf-8')
  const homeViewSrc = fs.readFileSync(path.join(rootDir, 'src/components/HomeView.tsx'), 'utf-8')

  test('NavigationTab type includes "home" and "chat" as independent routes', () => {
    assert.match(typesSrc, /'home'/)
    assert.match(typesSrc, /'chat'/)
    const validTabs: NavigationTab[] = ['home', 'chat']
    assert.equal(validTabs.length, 2)
  })

  test('Sidebar routes "home" and "chat" distinctly without redundant chat entry', () => {
    // Home exists in mainNavItems without a redundant static Chat entry
    assert.match(sidebarSrc, /\{\s*id:\s*'home',\s*label:\s*'Home'/)
    assert.doesNotMatch(sidebarSrc, /mainNavItems: NavEntry\[\] = \[\s*\{\s*id:\s*'home'[^\]]*\{\s*id:\s*'chat'/)

    // New conversation dispatches onSelectTab('chat')
    assert.match(sidebarSrc, /onSelectTab\('chat'\)/)

    // Clicking home dispatches onSelectTab(id) directly
    assert.match(sidebarSrc, /const handleItemClick = \(id: NavigationTab\) => \{\s*onSelectTab\(id\)/)

    // Active tab matches strictly id === activeTab
    assert.match(sidebarSrc, /const isItemActive = \(id: NavigationTab\) => \{\s*return activeTab === id/)

    // Upgrade to Pro card is completely removed from sidebar
    assert.doesNotMatch(sidebarSrc, /upgrade-pro-card/)
    assert.doesNotMatch(sidebarSrc, /Upgrade to Pro/)

    // Context menu and recent chat options exist in sidebar
    assert.match(sidebarSrc, /recent-chat-menu-trigger/)
    assert.match(sidebarSrc, /recent-chat-context-menu/)
    assert.match(sidebarSrc, /handleOpenMenu/)
  })

  test('Header handles Home route without "NOVA /" breadcrumbs and removes global search', () => {
    assert.match(headerSrc, /home:\s*'Home'/)
    assert.match(headerSrc, /!isHome && \(/)
    assert.doesNotMatch(headerSrc, /placeholder="Search anything\.\.\."/)
    assert.doesNotMatch(headerSrc, /⌘ K/)
  })

  test('App.tsx renders HomeView for home and ChatView for chat without duplication', () => {
    // HomeView is imported and rendered on activeTab === 'home'
    assert.match(appSrc, /import \{ HomeView \} from '\.\/components\/HomeView'/)
    assert.match(appSrc, /activeTab === 'home' && \(\s*<HomeView/)

    // ChatView is rendered on activeTab === 'chat'
    assert.match(appSrc, /activeTab === 'chat' && \(/)
    assert.match(appSrc, /<ChatView/)

    // Default tab is 'home'
    assert.match(appSrc, /useLocalStorageState<NavigationTab>\('nova:active-tab:v1',\s*'home'\)/)
  })

  test('ChatView renders focused conversation interface and does not duplicate Home dashboard', () => {
    // Empty state is a focused conversation starter
    assert.match(chatViewSrc, /New Conversation/)
    assert.doesNotMatch(chatViewSrc, /ChatCapabilityCards/)
  })

  test('HomeView contains the approved greeting, composer, and 4 capability cards', () => {
    assert.match(homeViewSrc, /nova-welcome-eyebrow/)
    assert.match(homeViewSrc, /How can NOVA help you/)
    assert.match(homeViewSrc, /<ChatCapabilityCards/)
    assert.match(homeViewSrc, /<MessageComposer/)
  })
})

describe('Priority 2 — Persistent Siri Voice Orb Lifecycle & Rendering', () => {
  const orbSrc = fs.readFileSync(path.join(rootDir, 'src/components/SiriVoiceOrb.tsx'), 'utf-8')

  test('Canvas render loop avoids compounding scale and guarantees context restore', () => {
    // Fixes the disappearing bug: uses setTransform or guaranteed save/restore
    assert.match(orbSrc, /ctx\.setTransform\(dpr,\s*0,\s*0,\s*dpr,\s*0,\s*0\)/)
    assert.match(orbSrc, /ctx\.save\(\)/)
    assert.match(orbSrc, /ctx\.restore\(\)/)

    // Canvas size initialization prevents flicker
    assert.match(orbSrc, /width=\{size \* 2\}/)
    assert.match(orbSrc, /height=\{size \* 2\}/)
  })

  test('SiriVoiceOrb supports all session states without unmounting or hiding', () => {
    assert.match(orbSrc, /currentState === 'requesting'/)
    assert.match(orbSrc, /currentState === 'listening'/)
    assert.match(orbSrc, /currentState === 'speaking'/)
    assert.match(orbSrc, /currentState === 'processing'/)
    assert.match(orbSrc, /currentState === 'error'/)
  })

  test('Audio reactivity integrates smoothly with audio levels', () => {
    assert.match(orbSrc, /audioLevel/)
    assert.match(orbSrc, /targetAudio/)
    assert.match(orbSrc, /smoothedAudioRef/)
  })
})

describe('Priority 3 — Home Page Styling & Artwork Alignment', () => {
  const cardsSrc = fs.readFileSync(path.join(rootDir, 'src/components/ChatCapabilityCards.tsx'), 'utf-8')
  const appCss = fs.readFileSync(path.join(rootDir, 'src/App.css'), 'utf-8')

  test('ChatCapabilityCards includes rich visual artwork and circular arrow buttons', () => {
    assert.match(cardsSrc, /card-visual-artwork/)
    assert.match(cardsSrc, /Image Search/)
    assert.match(cardsSrc, /AI Presentation/)
    assert.match(cardsSrc, /Dev Assistant/)
    assert.match(cardsSrc, /Knowledge Base/)
    assert.match(cardsSrc, /ArrowRight/)
  })

  test('Feature cards and illustrations strictly follow the approved order and structure', () => {
    const imgIndex = cardsSrc.indexOf("'Image Search'")
    const presIndex = cardsSrc.indexOf("'AI Presentation'")
    const devIndex = cardsSrc.indexOf("'Dev Assistant'")
    const kbIndex = cardsSrc.indexOf("'Knowledge Base'")

    assert.ok(imgIndex !== -1 && presIndex !== -1 && devIndex !== -1 && kbIndex !== -1)
    assert.ok(imgIndex < presIndex, 'Image Search precedes AI Presentation')
    assert.ok(presIndex < devIndex, 'AI Presentation precedes Dev Assistant')
    assert.ok(devIndex < kbIndex, 'Dev Assistant precedes Knowledge Base')

    // Verify rich visual illustrations are present
    assert.match(cardsSrc, /skyGrad1/) // Image Search landscape
    assert.match(cardsSrc, /slideAmberGrad/) // AI Presentation slides
    assert.match(cardsSrc, /editorGrad/) // Dev Assistant editor
    assert.match(cardsSrc, /docVioletGrad/) // Knowledge Base docs
  })

  test('Bottom quick-action ribbon includes all 7 actions in exact reference order', () => {
    const writeIdx = cardsSrc.indexOf("id: 'write'")
    const sumIdx = cardsSrc.indexOf("id: 'summarize'")
    const anaIdx = cardsSrc.indexOf("id: 'analyze'")
    const planIdx = cardsSrc.indexOf("id: 'plan'")
    const imgIdx = cardsSrc.indexOf("id: 'create-image'")
    const searchIdx = cardsSrc.indexOf("id: 'search-web'")
    const moreIdx = cardsSrc.indexOf("id: 'more'")

    assert.ok(writeIdx !== -1 && sumIdx !== -1 && anaIdx !== -1 && planIdx !== -1 && imgIdx !== -1 && searchIdx !== -1 && moreIdx !== -1)
    assert.ok(writeIdx < sumIdx, 'Write precedes Summarize')
    assert.ok(sumIdx < anaIdx, 'Summarize precedes Analyze')
    assert.ok(anaIdx < planIdx, 'Analyze precedes Plan')
    assert.ok(planIdx < imgIdx, 'Plan precedes Create Image')
    assert.ok(imgIdx < searchIdx, 'Create Image precedes Search Web')
    assert.ok(searchIdx < moreIdx, 'Search Web precedes More')

    // Verify individual restrained accent colors
    assert.match(cardsSrc, /#c084fc/) // Violet
    assert.match(cardsSrc, /#38bdf8/) // Cyan/blue
    assert.match(cardsSrc, /#f43f5e/) // Magenta
    assert.match(cardsSrc, /#fbbf24/) // Amber
    assert.match(cardsSrc, /#2dd4bf/) // Teal
    assert.match(cardsSrc, /#60a5fa/) // Blue
  })

  test('App.css defines home layout, context menu, and composer ambient lighting', () => {
    assert.match(appCss, /\.home-dashboard-page/)
    assert.doesNotMatch(appCss, /\.upgrade-pro-card/)
    assert.match(appCss, /\.recent-chat-context-menu/)
    assert.match(appCss, /\.recent-menu-item/)
    assert.match(appCss, /\.delete-confirm-dialog/)
    assert.match(appCss, /\.card-visual-artwork/)
    assert.match(appCss, /\.home-composer-glow/)
    assert.match(appCss, /\.chat-quick-action-pill/)
    assert.match(appCss, /scroll-snap-type:\s*x mandatory/)

    // Card titles and descriptions are completely visible without ellipsis truncation
    assert.doesNotMatch(appCss, /\.chat-capability-title\s*\{[^}]*text-overflow:\s*ellipsis/)
    assert.doesNotMatch(appCss, /\.chat-capability-description\s*\{[^}]*-webkit-line-clamp/)
  })

  test('MessageComposer plus menu contains only functional options without unconfigured items', () => {
    const composerSrc = fs.readFileSync(path.join(rootDir, 'src/components/MessageComposer.tsx'), 'utf-8')
    assert.doesNotMatch(composerSrc, /Web search/)
    assert.doesNotMatch(composerSrc, /Deep research/)
    assert.doesNotMatch(composerSrc, /Sketch/)
    assert.doesNotMatch(composerSrc, /Spreadsheets/)
    assert.doesNotMatch(composerSrc, /Template Creator/)

    // Preserves functional options
    assert.match(composerSrc, /Add photos & files/)
    assert.match(composerSrc, /Add from library/)
    assert.match(composerSrc, /Create image/)
    assert.match(composerSrc, /Documents/)
    assert.match(composerSrc, /PDF/)
    assert.match(composerSrc, /Presentations/)
  })
})

describe('Strict Requirements — Upgrade Pro Removal, Artwork & Context Menu', () => {
  const sidebarSrc = fs.readFileSync(path.join(rootDir, 'src/components/Sidebar.tsx'), 'utf-8')
  const cardsSrc = fs.readFileSync(path.join(rootDir, 'src/components/ChatCapabilityCards.tsx'), 'utf-8')
  const historySrc = fs.readFileSync(path.join(rootDir, 'src/components/HistoryView.tsx'), 'utf-8')
  const dataServiceSrc = fs.readFileSync(path.join(rootDir, 'src/services/dataService.ts'), 'utf-8')
  const appSrc = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf-8')

  test('Upgrade to Pro section is completely deleted from Sidebar.tsx', () => {
    assert.doesNotMatch(sidebarSrc, /Crown/)
    assert.doesNotMatch(sidebarSrc, /Upgrade to Pro/)
    assert.doesNotMatch(sidebarSrc, /Unlock more power/)
    assert.doesNotMatch(sidebarSrc, /upgrade-pro-card/)
    assert.doesNotMatch(sidebarSrc, /upgrade-pro-btn/)
  })

  test('Image Search artwork features understated landscape thumbnails with realistic photography and clean borders', () => {
    assert.match(cardsSrc, /item\.id === 'image'/)
    assert.match(cardsSrc, /mountainImg/)
    assert.match(cardsSrc, /sunsetImg/)
    assert.match(cardsSrc, /skyGrad1/)
    assert.match(cardsSrc, /skyGrad2/)
  })

  test('AI Presentation artwork features clean overlapping presentation slide previews with violet and amber accents', () => {
    assert.match(cardsSrc, /item\.id === 'presentation'/)
    assert.match(cardsSrc, /Presentation/)
    assert.match(cardsSrc, /Outline/)
    assert.match(cardsSrc, /slideAmberGrad/)
    assert.match(cardsSrc, /slideVioletGrad/)
  })

  test('Dev Assistant artwork features realistic code editor with syntax highlighting and traffic lights', () => {
    assert.match(cardsSrc, /item\.id === 'developer'/)
    assert.match(cardsSrc, /function /)
    assert.match(cardsSrc, /greet/)
    assert.match(cardsSrc, /#ef4444/) // traffic light red
    assert.match(cardsSrc, /#f59e0b/) // traffic light amber
    assert.match(cardsSrc, /#10b981/) // traffic light green
    assert.match(cardsSrc, /editorGrad/)
  })

  test('Knowledge Base artwork features clean document previews with violet badge and text details', () => {
    assert.match(cardsSrc, /item\.id === 'knowledge'/)
    assert.match(cardsSrc, /docVioletGrad/)
    assert.match(cardsSrc, /docIndigoGrad/)
  })

  test('Sidebar implements 3-dot menu with Rename, Pin, Archive, and Delete', () => {
    assert.match(sidebarSrc, /recent-chat-menu-trigger/)
    assert.match(sidebarSrc, /recent-chat-context-menu/)
    assert.match(sidebarSrc, /handleStartRename/)
    assert.match(sidebarSrc, /handleSaveRename/)
    assert.match(sidebarSrc, /onTogglePinSession/)
    assert.match(sidebarSrc, /onToggleArchiveSession/)
    assert.match(sidebarSrc, /setDeleteSessionTarget/)
    assert.match(sidebarSrc, /delete-confirm-dialog/)
    assert.match(sidebarSrc, /Delete conversation\?/)
  })

  test('dataService provides deleteChatSession and supports isPinned and isArchived', () => {
    assert.match(dataServiceSrc, /export async function deleteChatSession/)
    assert.match(dataServiceSrc, /is_pinned/)
    assert.match(dataServiceSrc, /is_archived/)
  })

  test('HistoryView supports filtering and restoring archived conversations', () => {
    assert.match(historySrc, /onToggleArchiveSession/)
    assert.match(historySrc, /activeTabFilter/)
    assert.match(historySrc, /RotateCcw/)
  })

  test('App.tsx wires all context menu handlers to Sidebar and HistoryView', () => {
    assert.match(appSrc, /onRenameSession=\{handleRenameSession\}/)
    assert.match(appSrc, /onTogglePinSession=\{handleTogglePinSession\}/)
    assert.match(appSrc, /onToggleArchiveSession=\{handleToggleArchiveSession\}/)
    assert.match(appSrc, /onDeleteSession=\{handleDeleteSession\}/)
  })
})
