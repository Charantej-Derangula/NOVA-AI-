import React from 'react'
import {
  Lightbulb,
  Code2,
  Calendar,
  Search,
  MoreHorizontal,
  BriefcaseBusiness,
} from 'lucide-react'
import { MessageComposer } from './MessageComposer'
import { ChatCapabilityCards } from './ChatCapabilityCards'
import type { AttachmentItem, NavigationTab } from '../types'

interface HomeViewProps {
  displayName?: string
  workspaceName?: string
  composerPrompt: string
  onComposerChange: (val: string) => void
  onSendMessage: (content: string, attachment?: AttachmentItem) => void
  onSelectTool: (tool: 'image' | 'presentation' | 'developer') => void
  onSelectVoiceMode: (mode: 'stt' | 'sts') => void
  onSelectTab: (tab: NavigationTab) => void
  isGenerating?: boolean
  storageAvailable?: boolean
  hasApiKey?: boolean
}

export const HomeView: React.FC<HomeViewProps> = ({
  displayName,
  workspaceName,
  composerPrompt,
  onComposerChange,
  onSendMessage,
  onSelectTool,
  onSelectVoiceMode,
  onSelectTab,
  isGenerating = false,
  storageAvailable = true,
  hasApiKey = true,
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'GOOD MORNING,'
    if (hour < 17) return 'GOOD AFTERNOON,'
    return 'GOOD EVENING,'
  }

  const effectiveName = displayName || 'User'

  const suggestions = [
    {
      id: 'summarize',
      label: 'Summarize a document',
      icon: Lightbulb,
      onClick: () => {
        onComposerChange('Summarize the key takeaways and core arguments from: ')
        focusInput()
      },
    },
    {
      id: 'code',
      label: 'Help me code',
      icon: Code2,
      onClick: () => onSelectTool('developer'),
    },
    {
      id: 'plan',
      label: 'Plan my day',
      icon: Calendar,
      onClick: () => onSelectTab('my-day'),
    },
    {
      id: 'research',
      label: 'Research a topic',
      icon: Search,
      onClick: () => {
        onComposerChange('Research and provide an in-depth breakdown of: ')
        focusInput()
      },
    },
    {
      id: 'more',
      label: 'More ideas',
      icon: MoreHorizontal,
      onClick: () => {
        onComposerChange('Give me creative ideas and unexplored angles for: ')
        focusInput()
      },
    },
  ]

  const focusInput = () => {
    setTimeout(() => {
      document.querySelector<HTMLTextAreaElement>('.message-composer-input')?.focus()
    }, 50)
  }

  return (
    <div className="home-dashboard-page flex-1 min-h-0 overflow-y-auto select-text px-4 sm:px-8 py-6">
      <div className="home-dashboard-inner max-w-[1200px] mx-auto w-full">
        {/* Workspace Context Badge if active */}
        {workspaceName && (
          <div className="mb-3">
            <span className="workspace-chat-context inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-white/[0.04] text-neutral-300 border border-white/[0.08]">
              <BriefcaseBusiness size={12} className="text-violet-400" />
              <span>Workspace · {workspaceName}</span>
            </span>
          </div>
        )}

        {/* Welcome Section - Following Approved Reference */}
        <section className="nova-home-welcome" aria-labelledby="home-welcome-name">
          <div className="nova-welcome-eyebrow">{getGreeting()}</div>
          <h1 id="home-welcome-name" className="nova-welcome-name">
            {effectiveName}.
          </h1>
          <h2 className="nova-welcome-title">
            How can NOVA help you <span>today?</span>
          </h2>
          <p className="nova-welcome-description">
            Ask a question, outline a plan, create something, or think through a problem. Your personal AI assistant for a more productive you.
          </p>

          {/* Quick Suggestions Row */}
          <div className="nova-suggestions-row" aria-label="Quick suggestions">
            {suggestions.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  className="nova-suggestion-chip"
                  onClick={item.onClick}
                >
                  <Icon size={14} className="text-violet-400/90" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Main Chat Composer with Soft Violet Ambient Glow */}
        <div className="home-composer-container my-6">
          <MessageComposer
            value={composerPrompt}
            onChange={onComposerChange}
            onSendMessage={onSendMessage}
            onOpenSettings={() => onSelectTab('settings')}
            onSelectVoiceMode={onSelectVoiceMode}
            onSelectTool={onSelectTool}
            onOpenLibrary={() => onSelectTab('knowledge')}
            disabled={isGenerating}
            isHomeLanding={true}
          />
        </div>

        {/* Four Feature Cards and Bottom Quick Actions */}
        <ChatCapabilityCards
          onSelectTool={onSelectTool}
          onOpenKnowledge={() => onSelectTab('knowledge')}
          onQuickAction={(prompt) => {
            onComposerChange(prompt)
            focusInput()
          }}
        />

        {/* Storage / Engine Footnote */}
        <p className="chat-entry-note">
          {storageAvailable ? 'Your chats are saved in this browser.' : 'Browser storage is unavailable; this chat may not be saved.'}{' '}
          {hasApiKey ? 'Powered by Groq (GPT-OSS 120B).' : 'Server GROQ_API_KEY is not configured.'}
        </p>
      </div>
    </div>
  )
}
