import React, { useRef, useEffect, useState, useCallback } from 'react'
import { BriefcaseBusiness, FileText, Copy, Check, Sparkles, User, Square, AlertCircle } from 'lucide-react'
import type { ChatSession } from '../types'
import { FormattedMessage } from './FormattedMessage'
import { NovaLogo } from './NovaLogo'

interface ChatViewProps {
  session: ChatSession
  workspaceName?: string
  isGenerating?: boolean
  activityStatus?: string | null
  onStopGeneration?: () => void
  hasApiKey?: boolean
  onSuggestionClick?: (prompt: string) => void
  isLoadingSession?: boolean
  sessionLoadError?: string | null
  onRetryLoadSession?: () => void
}

export const ChatView: React.FC<ChatViewProps> = ({
  session,
  workspaceName,
  isGenerating = false,
  activityStatus,
  onStopGeneration,
  hasApiKey = true,
  onSuggestionClick,
  isLoadingSession = false,
  sessionLoadError = null,
  onRetryLoadSession,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollEndRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const hasMessages = session.messages.length > 0

  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    isNearBottomRef.current = distanceFromBottom < 160
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const lastMessage = session.messages[session.messages.length - 1]
    const isUserMessage = lastMessage?.role === 'user'

    // Auto-scroll if user just sent a message or if they were already reading at the bottom
    if (isUserMessage || isNearBottomRef.current || isGenerating) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      scrollEndRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' })
    }
  }, [session.messages, isGenerating])

  const copyMessageText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
      } catch {
        // Ignore fallback
      }
      document.body.removeChild(textarea)
    }
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`chat-view flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6 select-text ${hasMessages ? 'chat-view--thread' : 'chat-view--landing'}`}
    >
      <div className={`chat-view-inner ${hasMessages ? 'chat-view-inner--thread' : 'chat-view-inner--welcome'}`}>
        {isLoadingSession ? (
          <section className="nova-chat-loading-state py-20 text-center max-w-md mx-auto" aria-live="polite">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-4 text-violet-300">
              <Sparkles size={20} className="animate-spin" />
            </div>
            <p className="text-sm text-neutral-300 font-medium mb-1">Loading conversation…</p>
            <p className="text-xs text-neutral-500">Retrieving stored messages safely</p>
          </section>
        ) : sessionLoadError && !hasMessages ? (
          <section className="nova-chat-error-state py-20 text-center max-w-md mx-auto" role="alert">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-4 text-rose-400">
              <AlertCircle size={20} />
            </div>
            <p className="text-sm text-neutral-200 font-medium mb-1">Could not load conversation</p>
            <p className="text-xs text-neutral-400 mb-5">{sessionLoadError}</p>
            {onRetryLoadSession && (
              <button
                type="button"
                onClick={onRetryLoadSession}
                className="px-4 py-1.5 rounded-full text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white transition-all cursor-pointer"
              >
                Retry
              </button>
            )}
          </section>
        ) : !hasMessages ? (
          <section className="nova-empty-chat-welcome py-14 text-center max-w-lg mx-auto" aria-labelledby="empty-chat-title">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600/30 to-purple-500/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-4 text-violet-300 shadow-[0_0_24px_rgba(139,92,246,0.2)]">
              <Sparkles size={22} />
            </div>
            {workspaceName && (
              <div className="mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-white/[0.04] text-neutral-300 border border-white/[0.08]">
                  <BriefcaseBusiness size={12} className="text-violet-400" />
                  <span>Workspace: {workspaceName}</span>
                </span>
              </div>
            )}
            <h1 id="empty-chat-title" className="text-xl font-semibold text-neutral-100 mb-2">
              New Conversation
            </h1>
            <p className="text-sm text-neutral-400 leading-relaxed mb-6">
              Ask anything, outline a plan, draft technical designs, or explore an idea with NOVA.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-full text-xs bg-white/[0.04] hover:bg-violet-500/10 border border-white/[0.08] hover:border-violet-500/30 text-neutral-300 hover:text-white transition-all cursor-pointer"
                onClick={() => onSuggestionClick?.('Brainstorm ideas and create an outline for: ')}
              >
                💡 Brainstorm an outline
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-full text-xs bg-white/[0.04] hover:bg-violet-500/10 border border-white/[0.08] hover:border-violet-500/30 text-neutral-300 hover:text-white transition-all cursor-pointer"
                onClick={() => onSuggestionClick?.('Help me review and debug this issue: ')}
              >
                &lt;/&gt; Help me debug
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-full text-xs bg-white/[0.04] hover:bg-violet-500/10 border border-white/[0.08] hover:border-violet-500/30 text-neutral-300 hover:text-white transition-all cursor-pointer"
                onClick={() => onSuggestionClick?.('Explain this technical concept simply: ')}
              >
                🔍 Explain a concept
              </button>
            </div>
          </section>
        ) : (
          <div className="chat-thread max-w-[860px] mx-auto space-y-7 pb-10">
            <div className="chat-thread-header flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="chat-thread-title-group flex items-center gap-2.5">
                <span className="chat-thread-title text-sm font-medium text-white/90">Conversation</span>
                {workspaceName && (
                  <span className="workspace-chat-context inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-white/[0.04] text-neutral-300 border border-white/[0.08]">
                    <BriefcaseBusiness size={12} />
                    {workspaceName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {isGenerating && onStopGeneration && (
                  <button
                    type="button"
                    onClick={onStopGeneration}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-rose-300 bg-rose-950/40 border border-rose-500/30 hover:bg-rose-900/50 transition-colors"
                    aria-label="Stop generating response"
                  >
                    <Square size={10} fill="currentColor" />
                    <span>Stop generating</span>
                  </button>
                )}
                <span className="chat-thread-updated text-xs text-neutral-400 flex items-center gap-1.5">
                  <i
                    className={`w-1.5 h-1.5 rounded-full ${
                      isGenerating
                        ? 'bg-violet-400 animate-pulse'
                        : hasApiKey
                        ? 'bg-emerald-400'
                        : 'bg-amber-400/80'
                    }`}
                    aria-hidden="true"
                  />
                  <span>
                    {isGenerating
                      ? (activityStatus || 'Generating response...')
                      : hasApiKey
                      ? 'Groq · GPT-OSS 120B'
                      : 'Add GROQ_API_KEY to .env'}
                  </span>
                </span>
              </div>
            </div>

            <div className="chat-messages-stream space-y-6">
              {session.messages.map((message) => {
                const isUser = message.role === 'user'

                if (isUser) {
                  return (
                    <div key={message.id} className="chat-message chat-message--user flex flex-col items-end group">
                      <div className="chat-message-meta flex items-center gap-2 mb-1.5 px-2 text-xs text-neutral-400">
                        <span className="font-medium text-violet-300/90">You</span>
                        <span aria-hidden="true">·</span>
                        <span>{message.timestamp}</span>
                      </div>

                      <div className="chat-user-row flex items-end justify-end gap-2.5 max-w-[88%] sm:max-w-[76%]">
                        <div className="chat-message-bubble chat-message-bubble--user relative overflow-hidden rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gradient-to-br from-[#26173a]/90 to-[#191326]/95 border border-violet-500/25 text-[#f6f2fc] text-[15px] leading-[1.62] shadow-lg shadow-black/20">
                          {message.attachment && (
                            <div className="mb-2.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.1] text-xs text-violet-200">
                              <FileText size={14} className="shrink-0" aria-hidden="true" />
                              <span className="font-medium truncate max-w-xs">{message.attachment.name}</span>
                              <span className="text-neutral-400">{message.attachment.size}</span>
                            </div>
                          )}
                          <div className="whitespace-pre-wrap overflow-wrap-anywhere">{message.content}</div>
                        </div>

                        <div className="chat-avatar chat-avatar--user shrink-0 w-7 h-7 rounded-full bg-violet-900/40 border border-violet-400/20 flex items-center justify-center text-violet-300">
                          <User size={14} aria-hidden="true" />
                        </div>
                      </div>

                      <div className="chat-message-actions mt-1 px-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => copyMessageText(message.id, message.content)}
                          className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white px-2 py-0.5 rounded transition-colors"
                          aria-label="Copy message text"
                        >
                          {copiedId === message.id ? (
                            <>
                              <Check size={11} className="text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )
                }

                // Assistant response - Stable, readable content column
                return (
                  <div key={message.id} className="chat-message chat-message--assistant flex flex-col items-start group">
                    <div className="chat-message-meta flex items-center gap-2 mb-1.5 px-2 text-xs text-neutral-400">
                      <span className="font-medium text-violet-200 flex items-center gap-1">
                        <Sparkles size={12} className="text-violet-400" aria-hidden="true" />
                        NOVA
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{message.timestamp}</span>
                    </div>

                    <div className="chat-assistant-row flex items-start gap-3 w-full max-w-[92%] sm:max-w-[840px]">
                      <div className="chat-avatar chat-avatar--assistant shrink-0 w-7 h-7 rounded-full bg-gradient-to-tr from-violet-950 to-violet-900/90 border border-violet-400/30 flex items-center justify-center text-violet-200 mt-0.5 shadow-sm shadow-violet-950/40 p-0.5 overflow-hidden" title="NOVA" aria-label="NOVA">
                        <NovaLogo size={18} variant="mark" markClassName="pointer-events-none" />
                      </div>

                      <div className="chat-message-bubble chat-message-bubble--assistant w-fit max-w-full rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 bg-[#120f18]/90 border border-white/[0.08] text-[#ede8f5] shadow-md shadow-black/25">
                        {message.attachment && (
                          <div className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-violet-200">
                            <FileText size={14} className="shrink-0" aria-hidden="true" />
                            <span className="font-medium truncate max-w-xs">{message.attachment.name}</span>
                            <span className="text-neutral-400">{message.attachment.size}</span>
                          </div>
                        )}
                        {message.content ? (
                          <FormattedMessage content={message.content} />
                        ) : (
                          <div className="chat-activity-indicator flex items-center gap-2.5 py-1 text-xs text-violet-300/90 select-none">
                            <span className="chat-activity-dots flex items-center gap-1" aria-hidden="true">
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse [animation-delay:200ms]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse [animation-delay:400ms]" />
                            </span>
                            <span className="chat-activity-label font-medium tracking-tight">
                              {activityStatus || 'Thinking…'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="chat-message-actions mt-1.5 pl-10 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => copyMessageText(message.id, message.content)}
                        className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white px-2 py-0.5 rounded transition-colors"
                        aria-label="Copy response text"
                      >
                        {copiedId === message.id ? (
                          <>
                            <Check size={11} className="text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div ref={scrollEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}
