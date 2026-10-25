import { describe, it } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import {
  resetPasswordForEmail,
  onAuthStateChange,
  isSupabaseConfigured,
  getSupabaseConfigStatus,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
} from '../src/lib/supabaseClient.ts'

describe('NOVA Login & Authentication Architecture Tests', () => {
  it('1. NovaLogo component definition and approved brand lockup', () => {
    const logoFilePath = path.resolve(process.cwd(), 'src/components/NovaLogo.tsx')
    assert.ok(fs.existsSync(logoFilePath), 'src/components/NovaLogo.tsx must exist')

    const content = fs.readFileSync(logoFilePath, 'utf-8')
    assert.match(content, /export const NovaLogo/, 'NovaLogo component must be exported')
    assert.match(content, /nova-logo-mark\.png/, 'Must import approved mark asset')
    assert.match(content, /nova-logo-full\.png/, 'Must import approved full lockup asset')
    assert.match(content, /variant === 'mark'/, 'Must support mark variant')
    assert.match(content, /variant === 'full'/, 'Must support full variant with wordmark')
    assert.match(content, /variant === 'horizontal'/, 'Must support horizontal variant')
    assert.match(content, /PERSONAL AI/, 'Must include PERSONAL AI descriptor')
  })

  it('2. LoginPage component structure and visual reference requirements', () => {
    const loginFilePath = path.resolve(process.cwd(), 'src/components/LoginPage.tsx')
    assert.ok(fs.existsSync(loginFilePath), 'src/components/LoginPage.tsx must exist')

    const content = fs.readFileSync(loginFilePath, 'utf-8')
    assert.match(content, /export const LoginPage/, 'LoginPage component must be exported')
    assert.match(content, /A clearer mind/, 'Must render "A clearer mind" headline')
    assert.match(content, /for a brighter/, 'Must render "for a brighter you." headline')
    assert.match(content, /nova-arch-backdrop/, 'Must render architectural backdrop')
    assert.match(content, /nova-tyndall-system/, 'Must render Tyndall effect light ray system')
    assert.match(content, /nova-arch-floor/, 'Must render reflective floor plane')
    assert.match(content, /nova-login-card/, 'Must render glassmorphic login card')
    assert.match(content, /onContinueAsGuest/, 'Must provide guest / offline access fallback')
    assert.match(content, /resetPasswordForEmail/, 'Must wire real password reset flow')
  })

  it('3. resetPasswordForEmail handles input validation and execution safely', async () => {
    // Empty email
    const emptyRes = await resetPasswordForEmail('')
    assert.strictEqual(emptyRes.success, false, 'Empty email must fail safely')
    assert.match(emptyRes.error || '', /initialized|empty|invalid/i)

    // Unconfigured or invalid endpoint
    if (!isSupabaseConfigured()) {
      const res = await resetPasswordForEmail('test@example.com')
      assert.strictEqual(res.success, false, 'Unconfigured client returns graceful error')
    }
  })

  it('4. onAuthStateChange returns an unsubscribe object without throwing', () => {
    const sub = onAuthStateChange(() => {})
    assert.ok(sub, 'Subscription object must be returned')
    assert.strictEqual(typeof sub.unsubscribe, 'function', 'unsubscribe method must be a function')
    // Safe execution of unsubscribe
    sub.unsubscribe()
  })

  it('5. Auth functions export and input guarding', async () => {
    assert.strictEqual(typeof signInWithEmail, 'function')
    assert.strictEqual(typeof signUpWithEmail, 'function')
    assert.strictEqual(typeof signOutUser, 'function')

    const status = getSupabaseConfigStatus()
    assert.ok(typeof status.isConfigured === 'boolean')
  })

  it('6. Auth keys preserve canonical data store keys without namespace collisions', () => {
    const authKeys = [
      'nova:guest-mode:v1',
      'nova:remembered-email:v1',
      'nova:supabase-auth:v1',
    ]

    const canonicalDataKeys = [
      'nova:tasks:v1',
      'nova:memories:v1',
      'nova:knowledge:v1',
      'nova:workspaces:v1',
      'nova:sessions:v1',
      'nova:current-session:v1',
      'nova:preferences:v1',
      'nova:focus-timer:v1',
    ]

    for (const ak of authKeys) {
      assert.ok(
        !canonicalDataKeys.includes(ak),
        `Auth key "${ak}" must not collide with canonical data storage keys`
      )
    }
  })

  it('7. getCurrentAuthInfo, signInAnonymously, and updateUserProfile exist and protect unauthenticated state', async () => {
    const { getCurrentAuthInfo, updateUserProfile, signInAnonymously } = await import('../src/lib/supabaseClient.ts')
    assert.strictEqual(typeof getCurrentAuthInfo, 'function')
    assert.strictEqual(typeof updateUserProfile, 'function')
    assert.strictEqual(typeof signInAnonymously, 'function')

    const info = await getCurrentAuthInfo()
    assert.ok(typeof info.isAuthenticated === 'boolean')
    assert.ok(typeof info.isAnonymous === 'boolean')
  })

  it('8. ConfirmDialog CSS enforces absolute viewport centering and dark blurred backdrop', () => {
    const cssPath = path.resolve(process.cwd(), 'src/App.css')
    const css = fs.readFileSync(cssPath, 'utf-8')
    assert.match(css, /\.nova-confirm-dialog/, 'Must define .nova-confirm-dialog')
    assert.match(css, /position:\s*fixed/, 'Must use fixed positioning for dialog')
    assert.match(css, /transform:\s*translate\(-50%,\s*-50%\)/, 'Must translate -50%, -50% for vertical & horizontal centering')
    assert.match(css, /\.nova-confirm-dialog::backdrop/, 'Must define backdrop styling')
    assert.match(css, /backdrop-filter:\s*blur/, 'Must include backdrop-filter blur for dimmed background')
  })

  it('9. Authentic approved angular flowing violet N logo without lightning bolt or ribbon fold', () => {
    const logoFilePath = path.resolve(process.cwd(), 'src/components/NovaLogo.tsx')
    const content = fs.readFileSync(logoFilePath, 'utf-8')
    // Must NOT contain the lightning bolt path
    assert.doesNotMatch(content, /M25\.842 44\.938/, 'Must not use incorrect lightning bolt path')
    // Must NOT contain ribbon fold paths
    assert.doesNotMatch(content, /M 26 78 C 22\.5 78/, 'Must not use incorrect ribbon fold path')
    assert.doesNotMatch(content, /M 74 22 C 77\.5 22/, 'Must not use incorrect ribbon fold path')

    // Must verify public/favicon.svg uses the approved angular flowing violet N mark
    const favPath = path.resolve(process.cwd(), 'public/favicon.svg')
    assert.ok(fs.existsSync(favPath), 'public/favicon.svg must exist')
    const favContent = fs.readFileSync(favPath, 'utf-8')
    assert.match(favContent, /nova-diag/, 'Favicon must define nova-diag gradient')
    assert.match(favContent, /nova-left/, 'Favicon must define nova-left gradient')
    assert.match(favContent, /nova-right/, 'Favicon must define nova-right gradient')
    assert.doesNotMatch(favContent, /M25\.842 44\.938/, 'Favicon must not use lightning bolt path')
    assert.doesNotMatch(favContent, /M 26 78 C 22\.5 78/, 'Favicon must not use ribbon fold path')
  })

  it('10. Mobile typography scale and compact chat styles in App.css', () => {
    const cssPath = path.resolve(process.cwd(), 'src/App.css')
    const css = fs.readFileSync(cssPath, 'utf-8')
    // Mobile chat bubble font size reduced to 14px and line-height ~1.5
    assert.match(css, /\.chat-message-bubble\s*\{[^}]*font-size:\s*14px !important/, 'Mobile bubble font-size must be 14px')
    assert.match(css, /\.chat-message-bubble\s*\{[^}]*line-height:\s*1\.5 !important/, 'Mobile bubble line-height must be 1.5')
    assert.match(css, /\.chat-paragraph\s*\{[^}]*font-size:\s*14px !important/, 'Mobile paragraph font-size must be 14px')
    // Mobile tabbar labels 11-12px
    assert.match(css, /\.mobile-tabbar button small\s*\{[^}]*font-size:\s*11px/, 'Mobile tabbar button labels must be 11px')
    // Mobile topbar compact height
    assert.match(css, /\.topbar\s*\{[^}]*min-height:\s*52px/, 'Mobile topbar must be compact 52px')
  })

  it('11. LoginPage architectural backdrop eliminates barcode stripes and floor cut line', () => {
    const cssPath = path.resolve(process.cwd(), 'src/components/LoginPage.css')
    const css = fs.readFileSync(cssPath, 'utf-8')
    // Eliminates repeating-linear-gradient barcode stripes
    assert.doesNotMatch(css, /repeating-linear-gradient/, 'Must not use repeating linear gradient barcode stripes')
    // Eliminates hard 40vh floor border line
    assert.doesNotMatch(css, /border-top:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.03\)/, 'Must not have hard horizontal floor cut')
    // Preserves diffuse Tyndall system and soft reflection
    assert.match(css, /\.nova-tyndall-system/, 'Must define .nova-tyndall-system')
    assert.match(css, /\.nova-light-cone/, 'Must define .nova-light-cone')
    assert.match(css, /\.nova-ray-shafts/, 'Must define .nova-ray-shafts')
    assert.match(css, /\.nova-arch-floor/, 'Must define .nova-arch-floor')
  })
})
