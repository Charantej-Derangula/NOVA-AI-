import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const rootDir = path.resolve(import.meta.dirname, '..')

describe('NOVA — Collapsed Sidebar Branding Requirements', () => {
  const sidebarSrc = fs.readFileSync(path.join(rootDir, 'src/components/Sidebar.tsx'), 'utf-8')
  const logoSrc = fs.readFileSync(path.join(rootDir, 'src/components/NovaLogo.tsx'), 'utf-8')
  const appCss = fs.readFileSync(path.join(rootDir, 'src/App.css'), 'utf-8')
  const headerSrc = fs.readFileSync(path.join(rootDir, 'src/components/Header.tsx'), 'utf-8')

  test('1. NOVA logo component is reused directly and never conditionally unmounted or replaced', () => {
    // Uses official NovaLogo component
    assert.match(sidebarSrc, /<NovaLogo\s+size=\{isCollapsed \? 38 : 28\}/)
    // No conditional rendering that unmounts NovaLogo when collapsed
    assert.doesNotMatch(sidebarSrc, /\{!isCollapsed && <NovaLogo/)
    assert.doesNotMatch(sidebarSrc, /\{isCollapsed \? null : <NovaLogo/)
    // Reuses the official brand assets
    assert.match(logoSrc, /import novaMarkPng from '\.\.\/assets\/nova-logo-mark\.png'/)
  })

  test('2. Expanded state preserves full branding (logo mark, NOVA wordmark, Personal AI subtitle)', () => {
    // Contains NovaLogo
    assert.match(sidebarSrc, /<NovaLogo/)
    // Contains wordmark and subtitle
    assert.match(sidebarSrc, /<strong>NOVA<\/strong>/)
    assert.match(sidebarSrc, /<span>Personal AI<\/span>/)
    // Enclosed in brand-text container
    assert.match(sidebarSrc, /<div className="brand-text">\s*<strong>NOVA<\/strong>\s*<span>Personal AI<\/span>\s*<\/div>/)
  })

  test('3. Collapsed state hides wordmark/subtitle and centers logo mark sized comfortably between 36–44px', () => {
    // NovaLogo receives size 38 when isCollapsed is true (strictly within 36-44px range)
    assert.match(sidebarSrc, /size=\{isCollapsed \? 38 : 28\}/)

    // brand-text is hidden when sidebar is collapsed
    assert.match(appCss, /\.sidebar-collapsed\s+\.brand-lockup\s+\.brand-text/)

    // The previous bug (.sidebar-collapsed .brand-lockup>div { display: none }) is NOT present
    assert.doesNotMatch(appCss, /\.sidebar-collapsed\s+\.brand-lockup>div\s*,/)
    assert.doesNotMatch(appCss, /\.sidebar-collapsed\s+\.brand-lockup>div\s*\{/)

    // brand-lockup is centered horizontally and given suitable height/margin
    assert.match(appCss, /\.sidebar-collapsed\s+\.brand-lockup\s*\{[^}]*justify-content:\s*center/)
    assert.match(appCss, /\.sidebar-collapsed\s+\.brand-lockup\s*\{[^}]*height:\s*44px/)
    assert.match(appCss, /\.sidebar-collapsed\s+\.brand-lockup\s*\{[^}]*margin-bottom:\s*25px/)

    // Logo mark retains 38px height and auto width without distortion (object-contain)
    assert.match(appCss, /\.sidebar-collapsed\s+\.brand-lockup\s+\.brand-logo-mark\s*\{[^}]*height:\s*38px\s*!important/)
    assert.match(logoSrc, /className="shrink-0 object-contain/)
  })

  test('4. Desktop sidebar toggle button remains functional and accessible in Header without overlapping the logo', () => {
    assert.match(headerSrc, /className="desktop-sidebar-toggle hidden sm:grid"/)
    assert.match(headerSrc, /onClick=\{onToggleSidebar\}/)
    assert.match(headerSrc, /aria-label=\{sidebarCollapsed \? 'Expand sidebar' : 'Collapse sidebar'\}/)
    assert.match(headerSrc, /aria-expanded=\{!sidebarCollapsed\}/)
    assert.match(headerSrc, /aria-controls="main-navigation"/)
    assert.match(headerSrc, /\{sidebarCollapsed \? <PanelLeftOpen size=\{18\} \/> : <PanelLeftClose size=\{18\} \/>\}/)
  })

  test('5. Sidebar dimensions, collapse animation, and styling integrity are preserved', () => {
    // 276px expanded, 72px collapsed
    assert.match(appCss, /\.nova-sidebar\{width:276px;flex:0 0 276px;/)
    assert.match(appCss, /\.nova-sidebar\.sidebar-collapsed\s*\{\s*width:\s*72px;\s*flex-basis:\s*72px;/)
    // Transition on width and flex-basis
    assert.match(appCss, /\.nova-sidebar\s*\{\s*transition:\s*width\s*\.22s\s*ease,\s*flex-basis\s*\.22s\s*ease/)
  })

  test('6. Mobile drawer behavior is preserved on compact screens', () => {
    // Mobile breakpoint ensures brand-text is visible in drawer
    assert.match(appCss, /\.brand-lockup\s+\.brand-text\s*\{\s*display:\s*flex\s*!important;/)
    // Mobile close button exists in Sidebar
    assert.match(sidebarSrc, /className="sidebar-close"/)
    // Mobile menu toggle exists in Header
    assert.match(headerSrc, /className="mobile-menu-button sm:hidden shrink-0"/)
  })
})
