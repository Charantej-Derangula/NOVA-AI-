import React, { useState } from 'react'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Compass,
} from 'lucide-react'
import { NovaLogo } from './NovaLogo'
import {
  signInWithEmail,
  signUpWithEmail,
  resetPasswordForEmail,
} from '../services/dataService'
import './LoginPage.css'

export interface LoginPageProps {
  onSuccess: (userId: string, email?: string) => void
  onContinueAsGuest: () => void
  initialEmail?: string
}

type AuthMode = 'signin' | 'signup' | 'forgot'

export const LoginPage: React.FC<LoginPageProps> = ({
  onSuccess,
  onContinueAsGuest,
  initialEmail = '',
}) => {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState(() => {
    if (initialEmail) return initialEmail
    try {
      return localStorage.getItem('nova:remembered-email:v1') || ''
    } catch {
      return ''
    }
  })
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [navModal, setNavModal] = useState<'about' | 'features' | 'contact' | null>(null)

  // Clear messages when mode changes
  const switchMode = (newMode: AuthMode) => {
    setMode(newMode)
    setErrorMessage(null)
    setSuccessMessage(null)
    setPassword('')
    setConfirmPassword('')
  }

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setErrorMessage('Please enter a valid email address.')
      return
    }

    // Save or clear remembered email
    try {
      if (rememberMe && trimmedEmail) {
        localStorage.setItem('nova:remembered-email:v1', trimmedEmail)
      } else {
        localStorage.removeItem('nova:remembered-email:v1')
      }
    } catch {
      // Storage unavailable
    }

    // 1. Password Reset Flow
    if (mode === 'forgot') {
      setIsLoading(true)
      try {
        const res = await resetPasswordForEmail(trimmedEmail)
        if (res.success) {
          setSuccessMessage(
            `Password reset link sent to ${trimmedEmail}. Check your inbox to proceed.`
          )
        } else {
          setErrorMessage(res.error || 'Failed to send password reset email. Please try again.')
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.')
      } finally {
        setIsLoading(false)
      }
      return
    }

    // 2. Sign In or Sign Up validation
    if (!password) {
      setErrorMessage('Please enter your password.')
      return
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setErrorMessage('Password must be at least 6 characters.')
        return
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.')
        return
      }
    }

    setIsLoading(true)

    try {
      if (mode === 'signin') {
        const res = await signInWithEmail(trimmedEmail, password)
        if (res.success && res.user) {
          const userObj = res.user as { id: string; email?: string }
          onSuccess(userObj.id, userObj.email || trimmedEmail)
        } else {
          setErrorMessage(
            res.error || 'Invalid email or password. Please verify your credentials and try again.'
          )
        }
      } else if (mode === 'signup') {
        const res = await signUpWithEmail(trimmedEmail, password)
        if (res.success) {
          if (res.confirmationRequired) {
            setSuccessMessage(
              `Account created! A confirmation link has been sent to ${trimmedEmail}. Please check your inbox.`
            )
          } else if (res.user) {
            const userObj = res.user as { id: string; email?: string }
            onSuccess(userObj.id, userObj.email || trimmedEmail)
          } else {
            setSuccessMessage('Account created successfully. You may now sign in.')
            switchMode('signin')
          }
        } else {
          setErrorMessage(res.error || 'Failed to create account. Please try again.')
        }
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Unable to connect to authentication server. Please check your connection.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="nova-login-scene select-text" role="main">
      {/* Layer 1: Architectural surfaces & ambient depth */}
      <div className="nova-arch-backdrop" aria-hidden="true" />

      {/* Left concrete architectural column with directional light falloff */}
      <div className="nova-arch-pillar hidden md:block" aria-hidden="true">
        <div className="nova-arch-pillar-face" />
      </div>

      {/* Layer 2: Tyndall Effect Light Rays descending from top edge */}
      <div className="nova-tyndall-system" aria-hidden="true">
        <div className="nova-light-cone" />
        <div className="nova-ray-shafts" />
        <div className="nova-ray-secondary" />
      </div>

      {/* Layer 3: Reflective Architectural Floor Plane */}
      <div className="nova-arch-floor" aria-hidden="true">
        <div className="nova-floor-sheen" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-20 w-full px-4 sm:px-8 lg:px-20 py-4 sm:py-7 flex items-center justify-between">
        {/* Brand indicator (top-left as in reference: "N O V A —") */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <span className="font-sans font-light tracking-[0.45em] text-white/90 text-xs sm:text-base pl-1">
            N O V A
          </span>
          <span className="w-6 sm:w-8 h-[1px] bg-white/20 inline-block" aria-hidden="true" />
        </div>

        {/* Top-right navigation: About, Features, Contact */}
        <nav className="flex items-center gap-3.5 sm:gap-7 lg:gap-9 text-xs sm:text-sm font-normal text-neutral-400">
          <button
            type="button"
            onClick={() => setNavModal('about')}
            className="hover:text-white transition-colors duration-150"
          >
            About
          </button>
          <button
            type="button"
            onClick={() => setNavModal('features')}
            className="hover:text-white transition-colors duration-150"
          >
            Features
          </button>
          <button
            type="button"
            onClick={() => setNavModal('contact')}
            className="hover:text-white transition-colors duration-150"
          >
            Contact
          </button>
        </nav>
      </header>

      {/* Main Split Layout */}
      <div className="relative z-20 max-w-[1360px] mx-auto w-full px-5 sm:px-10 lg:px-20 flex-1 grid grid-cols-1 lg:grid-cols-12 items-center gap-8 lg:gap-12 py-6 lg:py-12 min-h-[calc(100vh-140px)]">
        {/* LEFT BRANDING PANEL - Responsive: Hidden on small mobile to prioritize login card, shown on desktop */}
        <div className="hidden lg:flex lg:col-span-6 flex-col justify-center items-start max-w-xl pr-4">
          {/* Logo & Descriptor */}
          <div className="mb-2">
            <NovaLogo size={68} variant="full" className="!items-start text-left" />
          </div>

          {/* Subtle lavender horizontal line divider */}
          <div className="w-12 h-[1px] bg-violet-400/35 my-7" aria-hidden="true" />

          {/* Headline in editorial serif font */}
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-[44px] font-normal leading-[1.18] tracking-tight text-white/95">
            A clearer mind
            <br />
            for a brighter{' '}
            <span className="text-[#a78bfa] drop-shadow-[0_0_25px_rgba(167,139,250,0.4)]">
              you.
            </span>
          </h1>

          {/* Supporting editorial copy */}
          <p className="text-neutral-400 text-sm sm:text-[15px] font-normal leading-relaxed mt-5 max-w-md">
            Your personal AI workspace to think deeper, organize better, and create a more
            intentional you.
          </p>
        </div>

        {/* RIGHT LOGIN CARD */}
        <div className="col-span-1 lg:col-span-6 flex justify-center lg:justify-end items-center w-full">
          <div className="nova-login-card">
            {/* Card Header with centered mini NOVA logo */}
            <div className="flex flex-col items-center text-center mb-7">
              <NovaLogo size={36} variant="mark" />
              <span className="font-sans font-medium tracking-[0.4em] text-white/80 text-[11px] uppercase mt-2.5 pl-1">
                NOVA
              </span>

              <h2 className="font-serif text-2xl sm:text-[28px] font-normal text-white mt-4 tracking-tight leading-tight">
                {mode === 'signin' && 'Welcome back'}
                {mode === 'signup' && 'Create your account'}
                {mode === 'forgot' && 'Reset your password'}
              </h2>

              <p className="text-xs sm:text-[13px] text-neutral-400 mt-1.5 font-normal">
                {mode === 'signin' && 'Sign in to continue to NOVA'}
                {mode === 'signup' && 'Begin your intentional workspace'}
                {mode === 'forgot' && 'Enter your email to receive recovery instructions'}
              </p>
            </div>

            {/* Error & Success Feedback Alerts */}
            {errorMessage && (
              <div
                className="mb-5 p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-200 text-xs flex items-start gap-2.5"
                role="alert"
              >
                <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div
                className="mb-5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-200 text-xs flex items-start gap-2.5"
                role="status"
              >
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{successMessage}</span>
              </div>
            )}

            {/* Main Authentication Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Input */}
              <div className="space-y-1.5">
                <label htmlFor="nova-email" className="sr-only">
                  Email address
                </label>
                <div className="nova-auth-input-group">
                  <span className="pl-4 text-neutral-500" aria-hidden="true">
                    <Mail size={16} />
                  </span>
                  <input
                    id="nova-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    autoComplete="email"
                    required
                    className="nova-auth-input"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Password Input (SignIn & SignUp) */}
              {mode !== 'forgot' && (
                <div className="space-y-1.5">
                  <label htmlFor="nova-password" className="sr-only">
                    Password
                  </label>
                  <div className="nova-auth-input-group">
                    <span className="pl-4 text-neutral-500" aria-hidden="true">
                      <Lock size={16} />
                    </span>
                    <input
                      id="nova-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      required
                      className="nova-auth-input"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="pr-4 text-neutral-500 hover:text-neutral-300 transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      tabIndex={0}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm Password (SignUp mode) */}
              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <label htmlFor="nova-confirm-password" className="sr-only">
                    Confirm Password
                  </label>
                  <div className="nova-auth-input-group">
                    <span className="pl-4 text-neutral-500" aria-hidden="true">
                      <Lock size={16} />
                    </span>
                    <input
                      id="nova-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      autoComplete="new-password"
                      required
                      className="nova-auth-input"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}

              {/* Remember me & Forgot password Row (SignIn mode) */}
              {mode === 'signin' && (
                <div className="flex items-center justify-between pt-1 pb-1 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-neutral-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="nova-checkbox"
                    />
                    <span>Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-violet-400 hover:text-violet-300 transition-colors font-normal"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Primary Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="nova-submit-btn mt-3"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {mode === 'signin' && 'Sign In'}
                      {mode === 'signup' && 'Create Account'}
                      {mode === 'forgot' && 'Send Reset Link'}
                    </span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>

              {/* Divider and Google sign-in option, only if Google authentication is actually configured */}
              {typeof import.meta !== 'undefined' &&
              import.meta.env &&
              import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true' ? (
                <>
                  <div className="nova-auth-divider" aria-hidden="true">
                    <span>OR</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      // Google OAuth callback trigger when configured in Supabase
                    }}
                    className="nova-google-btn"
                  >
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </>
              ) : null}

              {/* Secondary Option: Guest / Offline Mode so local user is never stranded */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onContinueAsGuest}
                  className="nova-secondary-btn"
                  title="Open workspace locally using browser storage"
                >
                  <Compass size={15} className="text-violet-400" />
                  <span>Continue in Guest / Offline Mode</span>
                </button>
              </div>
            </form>

            {/* Mode Switch Footnotes */}
            <div className="mt-7 text-center text-xs text-neutral-400">
              {mode === 'signin' && (
                <p>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className="text-violet-400 hover:text-violet-300 font-medium underline underline-offset-4 ml-1 transition-colors"
                  >
                    Create one
                  </button>
                </p>
              )}

              {mode === 'signup' && (
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="text-violet-400 hover:text-violet-300 font-medium underline underline-offset-4 ml-1 transition-colors"
                  >
                    Sign in
                  </button>
                </p>
              )}

              {mode === 'forgot' && (
                <p>
                  Remembered your password?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="text-violet-400 hover:text-violet-300 font-medium underline underline-offset-4 ml-1 transition-colors"
                  >
                    Back to sign in
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Informational Modals for Top Navigation */}
      {navModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-md w-full bg-[#111019] border border-white/10 rounded-2xl p-6 shadow-2xl relative text-left">
            <h3 className="font-serif text-xl text-white font-normal mb-2 capitalize">
              {navModal === 'about' && 'About NOVA'}
              {navModal === 'features' && 'Workspace Features'}
              {navModal === 'contact' && 'Contact & Support'}
            </h3>

            <div className="text-xs text-neutral-300 leading-relaxed space-y-2 mb-6">
              {navModal === 'about' && (
                <p>
                  NOVA is an intentional personal AI workspace designed to synthesize deep thinking,
                  organized task execution, and continuous conversational intelligence.
                </p>
              )}
              {navModal === 'features' && (
                <ul className="space-y-1.5 list-disc pl-4 text-neutral-400">
                  <li>Natural multimodal chat powered by Groq and Gemini Live.</li>
                  <li>My Day prioritization and adaptive task scheduling.</li>
                  <li>Long-term memory vault and contextual knowledge base.</li>
                  <li>Supabase PostgreSQL cloud persistence with Row Level Security.</li>
                </ul>
              )}
              {navModal === 'contact' && (
                <p>
                  NOVA runs in your browser with private Supabase persistence. Reach our support
                  desk or review the developer documentation directly in the project repository.
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setNavModal(null)}
                className="subtle-pill text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
