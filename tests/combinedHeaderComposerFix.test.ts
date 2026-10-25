import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const headerSrc = fs.readFileSync(path.join(rootDir, 'src/components/Header.tsx'), 'utf-8')
const composerSrc = fs.readFileSync(path.join(rootDir, 'src/components/MessageComposer.tsx'), 'utf-8')
const appCss = fs.readFileSync(path.join(rootDir, 'src/App.css'), 'utf-8')

describe('Combined Header + Composer Menu UI Fix', () => {
  describe('1. Global Header Search Bar Complete Removal', () => {
    test('Header component has no search input or search form', () => {
      assert.doesNotMatch(headerSrc, /<input[^>]*type="search"/)
      assert.doesNotMatch(headerSrc, /topbar-search-form/)
      assert.doesNotMatch(headerSrc, /topbar-search-input/)
      assert.doesNotMatch(headerSrc, /topbar-search-icon/)
    })

    test('Header component has no Cmd+K shortcut badge or keyboard listener', () => {
      assert.doesNotMatch(headerSrc, /topbar-search-kbd/)
      assert.doesNotMatch(headerSrc, /⌘ K/)
      assert.doesNotMatch(headerSrc, /handleShortcut/)
    })

    test('Header component has no mobile search toggle or mobile search popover', () => {
      assert.doesNotMatch(headerSrc, /topbar-search-toggle-mobile/)
      assert.doesNotMatch(headerSrc, /mobile-search-popover/)
      assert.doesNotMatch(headerSrc, /isMobileSearchOpen/)
    })

    test('Header preserves sidebar toggles, NOVA branding, breadcrumb, and New Chat button', () => {
      assert.match(headerSrc, /desktop-sidebar-toggle/)
      assert.match(headerSrc, /mobile-menu-button/)
      assert.match(headerSrc, /mobile-brand/)
      assert.match(headerSrc, /breadcrumb-root/)
      assert.match(headerSrc, /topbar-current-page/)
      assert.match(headerSrc, /topbar-new-chat/)
    })
  })

  describe('2. Top-Right "C" Avatar Removal', () => {
    test('Header component has no avatar button or initial letter avatar', () => {
      assert.doesNotMatch(headerSrc, /rounded-full\s+bg-violet-600\/30/)
      assert.doesNotMatch(headerSrc, /\{initial\}/)
      assert.doesNotMatch(headerSrc, /const initial =/)
    })

    test('Header component has no user account menu popover or sign-in click handler', () => {
      assert.doesNotMatch(headerSrc, /isMenuOpen/)
      assert.doesNotMatch(headerSrc, /menuRef/)
      assert.doesNotMatch(headerSrc, /onClick=\{onOpenLogin\}/)
      assert.doesNotMatch(headerSrc, /Sign In \/ Account/)
      assert.doesNotMatch(headerSrc, /Authenticated & Active/)
    })

    test('Header layout has no reserved spacing or placeholder for removed avatar', () => {
      assert.doesNotMatch(headerSrc, /ml-1.*initial/)
    })
  })

  describe('3. Composer "+" Menu Position & Anchoring', () => {
    test('Add button resides inside message-composer-add-wrapper with position relative', () => {
      assert.match(composerSrc, /className="message-composer-add-wrapper relative"/)
      assert.match(appCss, /\.message-composer-add-wrapper\s*\{\s*position:\s*relative;\s*\}/)
    })

    test('composer-add-menu is positioned absolute with upward anchor (bottom: calc(100% + 8px)) and left: 0', () => {
      assert.match(appCss, /\.composer-add-menu\s*\{[^}]*position:\s*absolute/s)
      assert.match(appCss, /\.composer-add-menu\s*\{[^}]*left:\s*0/s)
      assert.match(appCss, /\.composer-add-menu\s*\{[^}]*bottom:\s*calc\(100%\s*\+\s*8px\)/s)
      assert.match(appCss, /\.composer-add-menu\s*\{[^}]*z-index:\s*80/s)
    })

    test('composer-add-menu has compact dimensions and enter animation', () => {
      assert.match(appCss, /\.composer-add-menu\s*\{[^}]*width:\s*272px/s)
      assert.match(appCss, /\.composer-add-menu\s*\{[^}]*max-width:\s*min\(272px,\s*calc\(100vw\s*-\s*32px\)\)/s)
      assert.match(appCss, /@keyframes composer-menu-in/)
    })

    test('mobile media query constrains composer-add-menu within viewport', () => {
      assert.match(appCss, /\.composer-add-menu\s*\{[^}]*width:\s*min\(265px,\s*calc\(100vw\s*-\s*32px\)\)\s*!important/s)
    })

    test('Preserves all 6 action items in composer-add-menu with functional triggers', () => {
      // 1. Add photos & files
      assert.match(composerSrc, /Add photos &amp; files/)
      assert.match(composerSrc, /fileInputRef\.current\?\.click\(\)/)

      // 2. Add from library
      assert.match(composerSrc, /Add from library/)
      assert.match(composerSrc, /onOpenLibrary\?\.?\(\)/)

      // 3. Create image
      assert.match(composerSrc, /Create image/)
      assert.match(composerSrc, /onSelectTool\?\.?\('image'\)/)

      // 4. Documents
      assert.match(composerSrc, /Documents/)
      assert.match(composerSrc, /docInputRef\.current\?\.click\(\)/)

      // 5. PDF
      assert.match(composerSrc, /PDF/)
      assert.match(composerSrc, /pdfInputRef\.current\?\.click\(\)/)

      // 6. Presentations
      assert.match(composerSrc, /Presentations/)
      assert.match(composerSrc, /onSelectTool\?\.?\('presentation'\)/)
    })

    test('MessageComposer closes add menu on outside click and Escape key', () => {
      assert.match(composerSrc, /if\s*\(addMenuRef\.current\s*&&\s*!addMenuRef\.current\.contains\(event\.target as Node\)\)\s*\{\s*setIsAddMenuOpen\(false\)/)
      assert.match(composerSrc, /if\s*\(event\.key\s*===\s*'Escape'\)\s*\{[^}]*setIsAddMenuOpen\(false\)/s)
    })

    test('Clicking + button coordinates with other menus to prevent overlapping overlays', () => {
      assert.match(composerSrc, /setIsAddMenuOpen\(\(open\)\s*=>\s*!open\)/)
      assert.match(composerSrc, /setIsOptionsOpen\(false\)/)
    })
  })
})
