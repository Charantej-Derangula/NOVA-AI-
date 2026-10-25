import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRoute, getPathForTab, VALID_NAV_TABS } from '../src/router/index.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

describe('Complete Critical Fix — URL Routing Architecture', () => {
  test('parseRoute maps all canonical routes correctly', () => {
    // Root redirects to /home
    assert.deepEqual(parseRoute('/'), { pathname: '/home', search: '', tab: 'home' })
    assert.deepEqual(parseRoute(''), { pathname: '/home', search: '', tab: 'home' })
    assert.deepEqual(parseRoute('/home'), { pathname: '/home', search: '', tab: 'home' })

    // Chat landing vs specific conversation
    assert.deepEqual(parseRoute('/chat'), { pathname: '/chat', search: '', tab: 'chat' })
    const chatConvo = parseRoute('/chat/session-xyz-123')
    assert.equal(chatConvo.tab, 'chat')
    assert.equal(chatConvo.conversationId, 'session-xyz-123')
    assert.equal(chatConvo.pathname, '/chat/session-xyz-123')

    // Standard application routes
    assert.deepEqual(parseRoute('/tasks'), { pathname: '/tasks', search: '', tab: 'tasks' })
    assert.deepEqual(parseRoute('/my-day'), { pathname: '/my-day', search: '', tab: 'my-day' })
    assert.deepEqual(parseRoute('/overview'), { pathname: '/overview', search: '', tab: 'dashboard' })
    assert.deepEqual(parseRoute('/dashboard'), { pathname: '/dashboard', search: '', tab: 'dashboard' })
    assert.deepEqual(parseRoute('/memory'), { pathname: '/memory', search: '', tab: 'memory' })
    assert.deepEqual(parseRoute('/knowledge'), { pathname: '/knowledge', search: '', tab: 'knowledge' })
    assert.deepEqual(parseRoute('/workspaces'), { pathname: '/workspaces', search: '', tab: 'workspaces' })
    assert.deepEqual(parseRoute('/settings'), { pathname: '/settings', search: '', tab: 'settings' })
    assert.deepEqual(parseRoute('/history'), { pathname: '/history', search: '', tab: 'history' })
    assert.deepEqual(parseRoute('/login'), { pathname: '/login', search: '', tab: 'login' })

    // Voice route with originating context
    const voiceRoute = parseRoute('/voice', '?from=%2Fchat%2Fsession-123&sessionId=session-123&mode=sts')
    assert.equal(voiceRoute.tab, 'voice')
    assert.equal(voiceRoute.voiceFrom, '/chat/session-123')
    assert.equal(voiceRoute.voiceMode, 'sts')

    // Unknown routes return not-found state
    const unknownRoute = parseRoute('/non-existent-page')
    assert.equal(unknownRoute.tab, 'not-found')
    assert.equal(unknownRoute.isNotFound, true)
  })

  test('getPathForTab outputs exact canonical paths', () => {
    assert.equal(getPathForTab('home'), '/home')
    assert.equal(getPathForTab('chat'), '/chat')
    assert.equal(getPathForTab('chat', 'session-abc'), '/chat/session-abc')
    assert.equal(getPathForTab('tasks'), '/tasks')
    assert.equal(getPathForTab('my-day'), '/my-day')
    assert.equal(getPathForTab('dashboard'), '/overview')
    assert.equal(getPathForTab('memory'), '/memory')
    assert.equal(getPathForTab('knowledge'), '/knowledge')
    assert.equal(getPathForTab('workspaces'), '/workspaces')
    assert.equal(getPathForTab('settings'), '/settings')
  })

  test('VALID_NAV_TABS defines all standard routes and maps overview to dashboard', () => {
    assert.equal(VALID_NAV_TABS.home, 'home')
    assert.equal(VALID_NAV_TABS.chat, 'chat')
    assert.equal(VALID_NAV_TABS.tasks, 'tasks')
    assert.equal(VALID_NAV_TABS['my-day'], 'my-day')
    assert.equal(VALID_NAV_TABS.overview, 'dashboard')
    assert.equal(VALID_NAV_TABS.memory, 'memory')
    assert.equal(VALID_NAV_TABS.knowledge, 'knowledge')
    assert.equal(VALID_NAV_TABS.workspaces, 'workspaces')
    assert.equal(VALID_NAV_TABS.settings, 'settings')
  })

  test('NotFoundView component exists with return to home action', () => {
    const notFoundSrc = fs.readFileSync(path.join(rootDir, 'src/components/NotFoundView.tsx'), 'utf-8')
    assert.match(notFoundSrc, /Page Not Found/)
    assert.match(notFoundSrc, /onReturnHome/)
    assert.match(notFoundSrc, /Return to Home/)
  })
})

describe('Complete Critical Fix — Voice Lifecycle & Exit Behavior', () => {
  const appSrc = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf-8')
  const voiceSrc = fs.readFileSync(path.join(rootDir, 'src/components/VoiceExperience.tsx'), 'utf-8')

  test('VoiceExperience provides handleClose with complete audio & live session cleanup', () => {
    assert.match(voiceSrc, /const handleClose = useCallback\(\(\) => \{/)
    assert.match(voiceSrc, /sessionTokenRef\.current \+= 1/)
    assert.match(voiceSrc, /releaseAudioResources\(\)/)
    assert.match(voiceSrc, /onClose\(\)/)
  })

  test('VoiceExperience X button and ChevronLeft both trigger handleClose', () => {
    // ChevronLeft close
    assert.match(voiceSrc, /onClick=\{handleClose\}[^>]*aria-label="Return to chat"/)
    // X button close
    assert.match(voiceSrc, /onClick=\{handleClose\}[^>]*aria-label="End session"/)
  })

  test('App.tsx stores originating conversation ID and navigation context when voice opens', () => {
    assert.match(appSrc, /voiceOriginRef/)
    assert.match(appSrc, /handleOpenVoice/)
    assert.match(appSrc, /const voiceUrl = `\/voice\?from=\${encodeURIComponent\(originUrl\)}&sessionId=\${encodeURIComponent\(activeId\)}&mode=\${mode}`/)
  })

  test('App.tsx returns to exact originating conversation upon voice exit without guessing', () => {
    assert.match(appSrc, /const handleCloseVoice = useCallback\(\(\) => \{/)
    assert.match(appSrc, /paramSessionId/)
    assert.match(appSrc, /paramFrom/)
    assert.match(appSrc, /setCurrentSessionId\(originSessionId\)/)
    assert.match(appSrc, /navigate\(originUrl\)/)
  })

  test('App.tsx preserves empty new-chat drafts rather than replacing with an older conversation', () => {
    assert.match(appSrc, /if \(!prev\.some\(\(s\) => s\.id === originSessionId\)\) \{/)
    assert.match(appSrc, /title: 'New Conversation'/)
  })

  test('Full viewport voice screen omits Header, Sidebar, and mobile-tabbar completely', () => {
    assert.match(appSrc, /const isVoiceActive = route\.tab === 'voice' \|\| activeVoiceMode !== null/)
    assert.match(appSrc, /if \(isVoiceActive\) \{/)
    assert.match(appSrc, /className="nova-voice-fullscreen-host fixed inset-0 w-full h-\[100dvh\] overflow-hidden bg-\[#07060a\] z-\[100\]"/)
  })
})

describe('Complete Critical Fix — Desktop & Mobile Layout', () => {
  const appCss = fs.readFileSync(path.join(rootDir, 'src/App.css'), 'utf-8')
  const cardsSrc = fs.readFileSync(path.join(rootDir, 'src/components/ChatCapabilityCards.tsx'), 'utf-8')
  const homeSrc = fs.readFileSync(path.join(rootDir, 'src/components/HomeView.tsx'), 'utf-8')

  test('Desktop viewports display all 4 feature cards in 1 row', () => {
    assert.match(appCss, /\.chat-capabilities\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s)
  })

  test('Quick actions ribbon contains all 7 actions with distinct category colors', () => {
    assert.match(cardsSrc, /id: 'write'[^}]*color: '#c084fc'/s)
    assert.match(cardsSrc, /id: 'summarize'[^}]*color: '#38bdf8'/s)
    assert.match(cardsSrc, /id: 'analyze'[^}]*color: '#f43f5e'/s)
    assert.match(cardsSrc, /id: 'plan'[^}]*color: '#fbbf24'/s)
    assert.match(cardsSrc, /id: 'create-image'[^}]*color: '#2dd4bf'/s)
    assert.match(cardsSrc, /id: 'search-web'[^}]*color: '#60a5fa'/s)
    assert.match(cardsSrc, /id: 'more'[^}]*color: '#c084fc'/s)
  })

  test('Desktop quick actions row displays pills in a single horizontal row without wrapping', () => {
    assert.match(appCss, /\.chat-quick-actions-row\s*\{[^}]*flex-wrap:\s*nowrap/s)
  })

  test('Consistent 1200px max content width across desktop containers', () => {
    assert.match(homeSrc, /home-dashboard-inner max-w-\[1200px\]/)
    assert.match(appCss, /\.chat-entry-page \.message-composer-wrap\s*\{\s*width:\s*min\(100% - 48px,\s*1200px\);/s)
    assert.match(appCss, /\.chat-home-sections-wrap,\s*\.chat-capabilities\s*\{\s*width:\s*min\(calc\(100% - 48px\),\s*1200px\);/s)
  })

  test('Collapsed sidebar preserves centered NOVA logo mark', () => {
    const sidebarSrc = fs.readFileSync(path.join(rootDir, 'src/components/Sidebar.tsx'), 'utf-8')
    assert.match(sidebarSrc, /<NovaLogo\s+size=\{isCollapsed \? 38 : 28\}/)
    assert.match(appCss, /\.sidebar-collapsed \.brand-lockup \.brand-logo-mark/s)
  })
})
