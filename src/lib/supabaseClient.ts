import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let clientInstance: SupabaseClient | null = null
let currentConfigKey = ''

/**
 * Safely retrieve an environment variable in both browser (Vite) and Node.js environments.
 */
function getEnvVar(name: string): string | undefined {
  try {
    // 1. Check Vite import.meta.env
    if (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env[name] === 'string') {
      return import.meta.env[name]
    }
  } catch {
    // Ignore in non-Vite environments
  }

  try {
    // 2. Check Node.js process.env
    if (typeof process !== 'undefined' && process.env && typeof process.env[name] === 'string') {
      return process.env[name]
    }
  } catch {
    // Ignore
  }

  return undefined
}

export type SupabaseConnectionState =
  | 'unconfigured'
  | 'connecting'
  | 'connected'
  | 'tables_missing'
  | 'auth_error'
  | 'unreachable'

export const REQUIRED_TABLES = [
  'workspaces',
  'tasks',
  'knowledge',
  'memories',
  'chat_sessions',
  'chat_messages',
  'user_preferences',
] as const

export interface AuthStateResult {
  isAuthenticated: boolean
  userId: string | null
  userEmail?: string
  displayName?: string
  isAnonymous: boolean
  anonymousDisabled?: boolean
  error?: string
}

export interface SupabaseConfigStatus {
  isConfigured: boolean
  configured: boolean
  url: string | null
  hasAnonKey: boolean
  connectionState: SupabaseConnectionState
  statusMessage?: string
  error?: string
  missingTables?: string[]
  authStatus?: 'authenticated' | 'anonymous' | 'anonymous_disabled' | 'unauthenticated'
  userEmail?: string
  userId?: string
}

/**
 * Safely retrieve the Supabase Project URL from available environment variables.
 */
export function getSupabaseUrl(): string | undefined {
  return getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_URL')
}

/**
 * Safely retrieve the Supabase Public / Anon / Publishable key from available environment variables.
 * Supports both modern Supabase publishable keys (VITE_SUPABASE_PUBLISHABLE_KEY / sb_publishable_...)
 * and legacy anon keys (VITE_SUPABASE_ANON_KEY / eyJ...).
 */
export function getSupabaseKey(): string | undefined {
  return (
    getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY') ||
    getEnvVar('VITE_SUPABASE_ANON_KEY') ||
    getEnvVar('VITE_SUPABASE_KEY') ||
    getEnvVar('SUPABASE_PUBLISHABLE_KEY') ||
    getEnvVar('SUPABASE_ANON_KEY') ||
    getEnvVar('SUPABASE_KEY')
  )
}

/**
 * Validate that a URL is well-formed and not an example placeholder.
 */
export function isValidSupabaseUrl(url?: string): boolean {
  if (!url) return false
  const trimmed = url.trim()
  if (
    trimmed === 'your_supabase_url_here' ||
    trimmed === 'https://your-project.supabase.co' ||
    trimmed === 'https://your-project-ref.supabase.co' ||
    trimmed.includes('your-project') ||
    trimmed.length < 10
  ) {
    return false
  }
  return /^https?:\/\//i.test(trimmed)
}

/**
 * Validate that a Supabase anon/publishable key is not an example placeholder.
 * Supports modern Supabase publishable keys (sb_publishable_...) and legacy JWTs (eyJ...).
 */
export function isValidSupabaseKey(key?: string): boolean {
  if (!key) return false
  const trimmed = key.trim()
  if (
    trimmed === 'your_supabase_anon_key_here' ||
    trimmed === 'your_supabase_anon_public_key_here' ||
    trimmed === 'your_publishable_key_here' ||
    trimmed.includes('your_supabase') ||
    trimmed.includes('your_publishable') ||
    trimmed.length < 20
  ) {
    return false
  }
  return true
}

export const isValidAnonKey = isValidSupabaseKey

/**
 * Inspect the current configuration status of Supabase based on environment variables.
 */
export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const url = getSupabaseUrl()
  const key = getSupabaseKey()

  const validUrl = isValidSupabaseUrl(url)
  const validKey = isValidSupabaseKey(key)
  const isConfigured = Boolean(validUrl && validKey)

  let error: string | undefined
  if (!url || !key) {
    error = 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY in environment'
  } else if (!validUrl) {
    error = 'VITE_SUPABASE_URL contains placeholder or invalid format'
  } else if (!validKey) {
    error = 'Supabase API key contains placeholder or invalid format'
  }

  const connectionState: SupabaseConnectionState = isConfigured ? 'connecting' : 'unconfigured'

  return {
    isConfigured,
    configured: isConfigured,
    url: validUrl && url ? url.trim() : null,
    hasAnonKey: Boolean(validKey),
    connectionState,
    statusMessage: isConfigured
      ? 'Configured. Verifying live connection...'
      : error || 'Configure VITE_SUPABASE_URL and key in .env',
    error,
  }
}

/**
 * Returns true if real, valid Supabase credentials are configured.
 */
export function isSupabaseConfigured(): boolean {
  return getSupabaseConfigStatus().isConfigured
}

/**
 * Get or create the shared Supabase client singleton.
 * Returns null if Supabase environment variables are missing or invalid.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const status = getSupabaseConfigStatus()
  if (!status.isConfigured || !status.url) {
    return null
  }

  const key = (getSupabaseKey() || '').trim()
  const cacheKey = `${status.url}::${key}`

  if (clientInstance && currentConfigKey === cacheKey) {
    return clientInstance
  }

  try {
    clientInstance = createClient(status.url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'nova:supabase-auth:v1',
      },
    })
    currentConfigKey = cacheKey
    return clientInstance
  } catch (err) {
    console.warn('[NOVA Supabase] Failed to initialize Supabase client:', err)
    return null
  }
}

/**
 * Test live connection to Supabase and accurately distinguish between:
 * - unconfigured: missing environment variables or using placeholder
 * - unreachable: network offline, DNS error, or Supabase project paused
 * - auth_error: API key rejected (401 Unauthorized / invalid key)
 * - tables_missing: project connected & key valid, but PostgreSQL migration has not been run
 * - connected: fully connected, key authorized, and database tables verified
 *
 * Never logs or exposes credentials.
 */
export async function checkSupabaseConnection(): Promise<SupabaseConfigStatus> {
  const baseStatus = getSupabaseConfigStatus()
  if (!baseStatus.isConfigured || !baseStatus.url) {
    return {
      ...baseStatus,
      connectionState: 'unconfigured',
      statusMessage:
        baseStatus.error ||
        'Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) in .env',
    }
  }

  const client = getSupabaseClient()
  if (!client) {
    return {
      ...baseStatus,
      connectionState: 'unconfigured',
      statusMessage: 'Unable to initialize Supabase client.',
    }
  }

  try {
    // 1. Initial probe on workspaces to check connectivity & credentials
    const { error: probeError, status: probeStatus } = await client
      .from('workspaces')
      .select('id')
      .limit(1)

    if (probeError) {
      const msg = probeError.message || ''

      // 1a. Authentication failure (invalid API key or unauthorized)
      if (probeStatus === 401 || /invalid.*api.*key|unauthorized|jwt/i.test(msg)) {
        return {
          ...baseStatus,
          connectionState: 'auth_error',
          statusMessage:
            'Authentication failed: Supabase rejected the provided API key (401 Unauthorized). Check VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY in .env.',
          error: 'Authentication failed (401)',
        }
      }

      // 1b. Project unreachable or network offline
      if (probeStatus === 0 || /fetch failed|network|failed to fetch|econnrefused/i.test(msg)) {
        return {
          ...baseStatus,
          connectionState: 'unreachable',
          statusMessage: `Unable to reach Supabase project at ${baseStatus.url}. Check network connection or verify project is active.`,
          error: 'Project unreachable',
        }
      }
    }

    // 2. Comprehensive schema verification across all 7 required tables
    const missingTables: string[] = []
    for (const tableName of REQUIRED_TABLES) {
      try {
        const { error: tableError, status: tableStatus } = await client
          .from(tableName)
          .select('id')
          .limit(1)

        if (tableError) {
          const msg = tableError.message || ''
          const code = tableError.code || ''

          if (
            tableStatus === 404 ||
            code === '42P01' ||
            code === 'PGRST205' ||
            code === 'PGRST204' ||
            code === 'PGRST200' ||
            /relation.*does not exist|could not find the table/i.test(msg)
          ) {
            missingTables.push(tableName)
          } else if (tableStatus === 401 || /invalid.*api.*key|unauthorized/i.test(msg)) {
            return {
              ...baseStatus,
              connectionState: 'auth_error',
              statusMessage: 'Authentication failed: Supabase rejected the provided API key (401 Unauthorized).',
              error: 'Authentication failed (401)',
            }
          }
        }
      } catch {
        missingTables.push(tableName)
      }
    }

    // 3. Check Authentication & Session State
    const authInfo = await getCurrentAuthInfo()

    const authStatus = authInfo.isAuthenticated
      ? authInfo.isAnonymous
        ? 'anonymous'
        : 'authenticated'
      : authInfo.anonymousDisabled
        ? 'anonymous_disabled'
        : 'unauthenticated'

    // 4. If any tables are missing, report tables_missing
    if (missingTables.length > 0) {
      return {
        ...baseStatus,
        connectionState: 'tables_missing',
        missingTables,
        authStatus,
        userId: authInfo.userId || undefined,
        userEmail: authInfo.userEmail || undefined,
        statusMessage: `Connected to Supabase project, but database tables are missing (${missingTables.join(', ')}). Run supabase/migrations/20261024000000_nova_schema.sql in your Supabase SQL Editor.`,
        error: 'Database tables missing (run SQL migration)',
      }
    }

    // 5. All tables verified
    let statusMessage = `Connected to Supabase PostgreSQL at ${baseStatus.url}. RLS active & all 7 database tables verified.`
    if (authStatus === 'anonymous_disabled') {
      statusMessage = `Connected to Supabase PostgreSQL at ${baseStatus.url}. Database tables verified. Anonymous sign-in is disabled in your Supabase project (enable under Authentication -> Providers -> Anonymous or sign in with email).`
    } else if (authStatus === 'unauthenticated') {
      statusMessage = `Connected to Supabase PostgreSQL at ${baseStatus.url}. Database tables verified. Active user session required for cloud sync.`
    }

    return {
      ...baseStatus,
      connectionState: 'connected',
      missingTables: [],
      authStatus,
      userId: authInfo.userId || undefined,
      userEmail: authInfo.userEmail || undefined,
      statusMessage,
      error: undefined,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/fetch failed|network|failed to fetch/i.test(msg)) {
      return {
        ...baseStatus,
        connectionState: 'unreachable',
        statusMessage: `Unable to reach Supabase project at ${baseStatus.url}. Check network connection or verify project is active.`,
        error: 'Network error',
      }
    }
    return {
      ...baseStatus,
      connectionState: 'unreachable',
      statusMessage: `Connection check failed: ${msg}`,
      error: msg,
    }
  }
}

/**
 * Retrieve current user session and authentication information.
 * Reads the authenticated identity from the active Supabase Auth session.
 * Does NOT silently auto-sign in anonymously, preventing sign-out redirect loops.
 */
export async function getCurrentAuthInfo(): Promise<AuthStateResult> {
  const client = getSupabaseClient()
  if (!client) {
    return {
      isAuthenticated: false,
      userId: null,
      isAnonymous: false,
      error: 'Supabase client not initialized.',
    }
  }

  try {
    // 1. Recover/refresh session from persistent storage
    const { data: { session }, error: sessionError } = await client.auth.getSession()

    // 2. Query user identity
    const { data: { user }, error: userError } = await client.auth.getUser()
    const activeUser = user || session?.user

    if (activeUser && (!userError || session?.user)) {
      const meta = (activeUser.user_metadata || {}) as Record<string, unknown>
      const displayName =
        (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
        (typeof meta.name === 'string' && meta.name.trim()) ||
        (typeof meta.display_name === 'string' && meta.display_name.trim()) ||
        (activeUser.email ? activeUser.email.split('@')[0] : (activeUser.is_anonymous ? 'Guest User' : undefined))

      return {
        isAuthenticated: true,
        userId: activeUser.id,
        userEmail: activeUser.email,
        displayName,
        isAnonymous: Boolean(activeUser.is_anonymous),
      }
    }

    return {
      isAuthenticated: false,
      userId: null,
      isAnonymous: false,
      anonymousDisabled: false,
      error: userError?.message || sessionError?.message || 'Authentication required.',
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      isAuthenticated: false,
      userId: null,
      isAnonymous: false,
      anonymousDisabled: false,
      error: msg,
    }
  }
}

/**
 * Sign in anonymously using Supabase Auth.
 * Enables authorized access to RLS-protected tables for guest users without requiring email credentials.
 */
export async function signInAnonymously(): Promise<{
  success: boolean
  user?: unknown
  error?: string
  anonymousDisabled?: boolean
}> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, error: 'Supabase client not initialized.' }
  }

  try {
    const { data, error } = await client.auth.signInAnonymously()
    if (error) {
      const isAnonDisabled =
        /anonymous.*disabled|provider.*disabled|not allowed|enable anonymous/i.test(error.message)
      return {
        success: false,
        error: error.message,
        anonymousDisabled: isAnonDisabled,
      }
    }

    return {
      success: true,
      user: data.user,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: msg,
    }
  }
}

/**
 * Retrieve the current authenticated user ID, or null if unauthenticated.
 * If the application is in guest mode and unauthenticated, ensures an anonymous Supabase
 * Auth session is established so mutations are authorized under PostgreSQL RLS policies.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const auth = await getCurrentAuthInfo()
  if (auth.userId) {
    return auth.userId
  }

  // If in guest mode, attempt to restore or establish anonymous Supabase session
  if (typeof window !== 'undefined') {
    try {
      const isGuest = localStorage.getItem('nova:guest-mode:v1') === 'true'
      if (isGuest) {
        const anonRes = await signInAnonymously()
        if (anonRes.success && anonRes.user) {
          const u = anonRes.user as { id: string }
          return u.id
        }
      }
    } catch {
      // Storage unavailable
    }
  }

  return null
}

/**
 * Sign in with standard email and password.
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; user?: unknown; error?: string }> {
  const client = getSupabaseClient()
  if (!client) return { success: false, error: 'Supabase client not initialized.' }
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) return { success: false, error: error.message }
    return { success: true, user: data.user }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Sign up a new user with email and password.
 */
export async function signUpWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; user?: unknown; confirmationRequired?: boolean; error?: string }> {
  const client = getSupabaseClient()
  if (!client) return { success: false, error: 'Supabase client not initialized.' }
  try {
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
    })
    if (error) return { success: false, error: error.message }
    const confirmationRequired = !data.session && Boolean(data.user)
    return { success: true, user: data.user, confirmationRequired }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Sign out the currently active user and clear the local auth session.
 */
export async function signOutUser(): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient()
  if (!client) return { success: true }
  try {
    const { error } = await client.auth.signOut()
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Send password reset email using Supabase Auth.
 */
export async function resetPasswordForEmail(
  email: string,
  redirectTo?: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient()
  if (!client) return { success: false, error: 'Supabase client not initialized.' }
  try {
    const destination =
      redirectTo ||
      (typeof window !== 'undefined' ? `${window.location.origin}` : undefined)
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: destination,
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Update authenticated user profile metadata (e.g. full display name).
 */
export async function updateUserProfile(data: {
  fullName?: string
}): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient()
  if (!client) return { success: false, error: 'Supabase client not initialized.' }
  try {
    const trimmed = data.fullName?.trim()
    const { error } = await client.auth.updateUser({
      data: {
        full_name: trimmed,
        name: trimmed,
      },
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Subscribe to Supabase Auth state changes (sign in, sign out, token refresh).
 */
export function onAuthStateChange(
  callback: (event: string, session: unknown) => void
): { unsubscribe: () => void } {
  const client = getSupabaseClient()
  if (!client) {
    return { unsubscribe: () => {} }
  }
  try {
    const { data } = client.auth.onAuthStateChange(callback)
    return { unsubscribe: () => data?.subscription?.unsubscribe() }
  } catch {
    return { unsubscribe: () => {} }
  }
}

/**
 * Reset client singleton (used primarily in tests).
 */
export function resetSupabaseClientInstance(): void {
  clientInstance = null
  currentConfigKey = ''
}
