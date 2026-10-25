import { useState, useEffect, useCallback } from 'react'
import type { NavigationTab } from '../types'

export interface ParsedRoute {
  pathname: string
  search: string
  tab: NavigationTab | 'voice' | 'login' | 'not-found'
  conversationId?: string
  voiceFrom?: string
  voiceMode?: 'stt' | 'sts'
  isNotFound?: boolean
}

/**
 * Known tabs matching the application's primary navigation entries.
 */
export const VALID_NAV_TABS: Record<string, NavigationTab> = {
  home: 'home',
  chat: 'chat',
  tasks: 'tasks',
  'my-day': 'my-day',
  overview: 'dashboard',
  dashboard: 'dashboard',
  history: 'history',
  memory: 'memory',
  knowledge: 'knowledge',
  workspaces: 'workspaces',
  settings: 'settings',
}

/**
 * Parses a URL pathname and search string into a structured route.
 */
export function parseRoute(pathname: string, search: string = ''): ParsedRoute {
  // Normalize pathname: strip trailing slash (except root)
  let cleanPath = pathname.trim()
  if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1)
  }

  const searchParams = new URLSearchParams(search)

  // Root redirects to /home
  if (cleanPath === '' || cleanPath === '/') {
    return {
      pathname: '/home',
      search,
      tab: 'home',
    }
  }

  // /home
  if (cleanPath === '/home') {
    return {
      pathname: '/home',
      search,
      tab: 'home',
    }
  }

  // /voice (Voice interface with originating context)
  if (cleanPath === '/voice') {
    const from = searchParams.get('from') || '/chat'
    const modeParam = searchParams.get('mode')
    const voiceMode = modeParam === 'stt' ? 'stt' : 'sts'
    return {
      pathname: '/voice',
      search,
      tab: 'voice',
      voiceFrom: from,
      voiceMode,
    }
  }

  // /login
  if (cleanPath === '/login') {
    return {
      pathname: '/login',
      search,
      tab: 'login',
    }
  }

  // /chat or /chat/:conversationId
  if (cleanPath === '/chat') {
    return {
      pathname: '/chat',
      search,
      tab: 'chat',
    }
  }

  if (cleanPath.startsWith('/chat/')) {
    const rawId = cleanPath.slice('/chat/'.length).trim()
    let conversationId: string | undefined = rawId || undefined
    if (rawId) {
      try {
        conversationId = decodeURIComponent(rawId)
      } catch {
        conversationId = rawId
      }
    }
    return {
      pathname: cleanPath,
      search,
      tab: 'chat',
      conversationId: conversationId || undefined,
    }
  }

  // Standard tab routes: /tasks, /my-day, /overview, /memory, /knowledge, /workspaces, /settings
  const segment = cleanPath.slice(1) // e.g. "tasks", "my-day"
  if (segment in VALID_NAV_TABS) {
    return {
      pathname: cleanPath,
      search,
      tab: VALID_NAV_TABS[segment],
    }
  }

  // Unknown route
  return {
    pathname: cleanPath,
    search,
    tab: 'not-found',
    isNotFound: true,
  }
}

/**
 * Converts a navigation tab and optional conversation ID to its canonical URL path.
 */
export function getPathForTab(tab: NavigationTab, conversationId?: string | null): string {
  if (tab === 'chat') {
    return conversationId ? `/chat/${encodeURIComponent(conversationId)}` : '/chat'
  }
  if (tab === 'dashboard') {
    return '/overview'
  }
  return `/${tab}`
}

/**
 * Custom event name used to synchronize route state in same-window SPAs.
 */
const ROUTE_CHANGE_EVENT = 'nova:routechange'

/**
 * Programmatic client-side navigation without full-page reloads.
 */
export function navigateTo(to: string, options: { replace?: boolean } = {}): void {
  if (typeof window === 'undefined') return

  const currentHref = window.location.pathname + window.location.search

  if (currentHref === to) {
    // Avoid duplicate history entries if destination is identical
    return
  }

  if (options.replace) {
    window.history.replaceState(null, '', to)
  } else {
    window.history.pushState(null, '', to)
  }

  window.dispatchEvent(new CustomEvent(ROUTE_CHANGE_EVENT, { detail: { to } }))
}

/**
 * Hook providing current route and navigation functions with browser back/forward and refresh support.
 */
export function useAppRouter() {
  const [route, setRoute] = useState<ParsedRoute>(() => {
    if (typeof window === 'undefined') {
      return { pathname: '/home', search: '', tab: 'home' }
    }
    const initial = parseRoute(window.location.pathname, window.location.search)
    // Synchronize root "/" to "/home" in URL history without reload
    if (window.location.pathname === '/' || window.location.pathname === '') {
      try {
        window.history.replaceState(null, '', '/home' + window.location.search)
      } catch {
        // Ignore
      }
    }
    return initial
  })

  useEffect(() => {
    const handleLocationChange = () => {
      const updated = parseRoute(window.location.pathname, window.location.search)
      setRoute(updated)
    }

    window.addEventListener('popstate', handleLocationChange)
    window.addEventListener(ROUTE_CHANGE_EVENT, handleLocationChange)

    return () => {
      window.removeEventListener('popstate', handleLocationChange)
      window.removeEventListener(ROUTE_CHANGE_EVENT, handleLocationChange)
    }
  }, [])

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    navigateTo(to, options)
  }, [])

  return {
    route,
    navigate,
    pathname: route.pathname,
    search: route.search,
    tab: route.tab,
    conversationId: route.conversationId,
    voiceFrom: route.voiceFrom,
    voiceMode: route.voiceMode,
    isNotFound: route.isNotFound,
  }
}
