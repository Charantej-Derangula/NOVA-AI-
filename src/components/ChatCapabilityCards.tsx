import React from 'react'
import {
  ArrowRight,
  Code2,
  FileText,
  Image,
  BookOpen,
} from 'lucide-react'
import mountainImg from '../assets/cards/mountain.jpg'
import sunsetImg from '../assets/cards/sunset.jpg'

interface ChatCapabilityCardsProps {
  onSelectTool: (tool: 'image' | 'presentation' | 'developer') => void
  onOpenKnowledge?: () => void
  onQuickAction?: (prompt: string) => void
}

interface CapabilityItem {
  id: 'image' | 'presentation' | 'developer' | 'knowledge'
  title: string
  description: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  tone: 'violet' | 'amber' | 'teal' | 'purple'
  tags: string[]
}

const capabilities: CapabilityItem[] = [
  {
    id: 'image',
    title: 'Image Search',
    description: 'Find authentic Creative Commons and public domain images on Wikimedia Commons.',
    icon: Image,
    tone: 'violet',
    tags: ['Wikimedia Commons', 'Public Domain', 'CC Media'],
  },
  {
    id: 'presentation',
    title: 'AI Presentation',
    description: 'Shape a clear story and outline for your next presentation.',
    icon: FileText,
    tone: 'amber',
    tags: ['Pitch Deck', 'Reports', 'Study Notes'],
  },
  {
    id: 'developer',
    title: 'Dev Assistant',
    description: 'Think through a technical problem, design, or code change.',
    icon: Code2,
    tone: 'teal',
    tags: ['React', 'Python', 'System Design'],
  },
  {
    id: 'knowledge',
    title: 'Knowledge Base',
    description: 'Save long-form notes, research, architectural decisions, and references.',
    icon: BookOpen,
    tone: 'purple',
    tags: ['Notes', 'Research', 'Documentation'],
  },
]

// Custom Quick Action Icons tailored to match target reference Image 2
const WriteIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 15, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
)

const SummarizeIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 15, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={style}>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" strokeWidth={3} />
    <line x1="3" y1="12" x2="3.01" y2="12" strokeWidth={3} />
    <line x1="3" y1="18" x2="3.01" y2="18" strokeWidth={3} />
  </svg>
)

const AnalyzeIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 15, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={style}>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
    <circle cx="12" cy="4" r="1.5" fill="currentColor" />
  </svg>
)

const PlanIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 15, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="3" />
    <path d="M3 10h18" />
    <circle cx="12" cy="15" r="2.5" />
    <path d="M12 14v1l1 .5" />
  </svg>
)

const CreateImageIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 15, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={style}>
    <rect width="18" height="18" x="3" y="3" rx="3" />
    <circle cx="8.5" cy="8.5" r="2" />
    <path d="m21 15-3.5-3.5a2 2 0 0 0-2.8 0L6 21" />
    <path d="m14 16 1.5-1.5a1.5 1.5 0 0 1 2.1 0L21 18" />
  </svg>
)

const SearchWebIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 15, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={style}>
    <circle cx="11" cy="11" r="7.5" />
    <path d="m21 21-4.3-4.3" />
    <ellipse cx="11" cy="11" rx="3.2" ry="7.5" opacity="0.6" />
  </svg>
)

const MoreIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 15, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={style}>
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="19" cy="12" r="1.5" fill="currentColor" />
    <circle cx="5" cy="12" r="1.5" fill="currentColor" />
  </svg>
)

const quickActions = [
  {
    id: 'write',
    label: 'Write',
    icon: WriteIcon,
    color: '#c084fc',
    prompt: 'Help me write a well-structured: ',
  },
  {
    id: 'summarize',
    label: 'Summarize',
    icon: SummarizeIcon,
    color: '#38bdf8',
    prompt: 'Summarize the key takeaways and core arguments from: ',
  },
  {
    id: 'analyze',
    label: 'Analyze',
    icon: AnalyzeIcon,
    color: '#f43f5e',
    prompt: 'Analyze this problem, tradeoffs, and key factors: ',
  },
  {
    id: 'plan',
    label: 'Plan',
    icon: PlanIcon,
    color: '#fbbf24',
    prompt: 'Help me make a realistic step-by-step plan for: ',
  },
  {
    id: 'create-image',
    label: 'Create Image',
    icon: CreateImageIcon,
    color: '#2dd4bf',
    action: 'image' as const,
  },
  {
    id: 'search-web',
    label: 'Search Web',
    icon: SearchWebIcon,
    color: '#60a5fa',
    prompt: 'Search Wikimedia Commons and find authentic media for: ',
  },
  {
    id: 'more',
    label: 'More',
    icon: MoreIcon,
    color: '#c084fc',
    prompt: 'Give me suggestions and creative ideas for: ',
  },
]

export const ChatCapabilityCards: React.FC<ChatCapabilityCardsProps> = ({
  onSelectTool,
  onOpenKnowledge,
  onQuickAction,
}) => {
  const handleCardClick = (item: CapabilityItem) => {
    if (item.id === 'knowledge') {
      onOpenKnowledge?.()
    } else {
      onSelectTool(item.id)
    }
  }

  return (
    <div className="chat-home-sections-wrap">
      {/* Four Equal-Height Feature Cards - Following Approved Reference */}
      <section className="chat-capabilities" aria-label="Feature capabilities">
        {capabilities.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={`chat-capability-card chat-capability-card--${item.tone}`}
              type="button"
              onClick={() => handleCardClick(item)}
              aria-label={`Open ${item.title}`}
            >
              <div className="chat-capability-body">
                {/* Top row: Icon + Title + Circular Arrow */}
                <div className="chat-capability-top">
                  <span className="chat-capability-icon">
                    <Icon size={18} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="chat-capability-title">{item.title}</span>
                  <span className="chat-capability-arrow" aria-hidden="true">
                    <ArrowRight size={15} strokeWidth={2.4} />
                  </span>
                </div>

                {/* Description */}
                <p className="chat-capability-description">{item.description}</p>

                {/* Tags row */}
                <div className="chat-capability-tags" aria-hidden="true">
                  {item.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>

              {/* Rich Visual Graphic Area Matching Approved Reference */}
              <div className="card-visual-artwork" aria-hidden="true">
                {item.id === 'image' && (
                  <svg viewBox="0 0 280 132" className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                      <filter id="photoShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000000" floodOpacity="0.6" />
                      </filter>
                      <clipPath id="leftMountainClip">
                        <rect x="0" y="0" width="136" height="102" rx="10" />
                      </clipPath>
                      <clipPath id="rightSunsetClip">
                        <rect x="0" y="0" width="138" height="102" rx="10" />
                      </clipPath>
                      <linearGradient id="skyGrad1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1e293b" />
                        <stop offset="100%" stopColor="#0f172a" />
                      </linearGradient>
                      <linearGradient id="skyGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#31102b" />
                        <stop offset="100%" stopColor="#78350f" />
                      </linearGradient>
                    </defs>

                    {/* Left Photo: Alpine Mountain Landscape (tilted ~ -7deg) */}
                    <g transform="translate(14, 20) rotate(-7)">
                      <g filter="url(#photoShadow)">
                        <rect x="0" y="0" width="136" height="102" rx="10" fill="#0f172a" stroke="rgba(255, 255, 255, 0.22)" strokeWidth="1.2" />
                        <g clipPath="url(#leftMountainClip)">
                          <image href={mountainImg} x="0" y="0" width="136" height="102" preserveAspectRatio="xMidYMid slice" />
                        </g>
                        <rect x="0" y="0" width="136" height="102" rx="10" fill="none" stroke="rgba(255, 255, 255, 0.24)" strokeWidth="1.2" />
                      </g>
                    </g>

                    {/* Right Photo: Warm Sunset Mountain Landscape (tilted ~ +6deg, overlapping) */}
                    <g transform="translate(120, 18) rotate(6)">
                      <g filter="url(#photoShadow)">
                        <rect x="0" y="0" width="138" height="102" rx="10" fill="#1c1008" stroke="rgba(255, 255, 255, 0.24)" strokeWidth="1.2" />
                        <g clipPath="url(#rightSunsetClip)">
                          <image href={sunsetImg} x="0" y="0" width="138" height="102" preserveAspectRatio="xMidYMid slice" />
                        </g>
                        <rect x="0" y="0" width="138" height="102" rx="10" fill="none" stroke="rgba(255, 255, 255, 0.26)" strokeWidth="1.2" />
                      </g>
                    </g>
                  </svg>
                )}

                {item.id === 'presentation' && (
                  <svg viewBox="0 0 280 132" className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                      <filter id="slideShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000000" floodOpacity="0.5" />
                      </filter>
                      <clipPath id="slideMiniPhotoClip">
                        <rect x="80" y="24" width="48" height="56" rx="5" />
                      </clipPath>
                      <linearGradient id="slideVioletGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#6d28d9" />
                      </linearGradient>
                      <linearGradient id="slideAmberGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#b45309" />
                      </linearGradient>
                    </defs>

                    {/* Right Slide (behind, tilted ~ +6deg) */}
                    <g transform="translate(122, 14) rotate(6)">
                      <g filter="url(#slideShadow)">
                        <rect x="0" y="0" width="144" height="108" rx="10" fill="#ffffff" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
                        {/* Slide placeholder lines on left */}
                        <rect x="16" y="16" width="46" height="4" rx="2" fill="#cbd5e1" />
                        <rect x="16" y="24" width="60" height="3" rx="1.5" fill="#e2e8f0" />
                        {/* Bar chart with warm amber/gold bars */}
                        <g>
                          <rect x="94" y="56" width="10" height="26" rx="2" fill="#f59e0b" />
                          <rect x="108" y="44" width="10" height="38" rx="2" fill="#d97706" />
                          <rect x="122" y="34" width="10" height="48" rx="2" fill="#b45309" />
                          <line x1="88" y1="84" x2="136" y2="84" stroke="#e2e8f0" strokeWidth="1" />
                        </g>
                        {/* More text placeholder lines */}
                        <rect x="16" y="44" width="56" height="3.5" rx="1.75" fill="#e2e8f0" />
                        <rect x="16" y="52" width="46" height="3.5" rx="1.75" fill="#e2e8f0" />
                        <rect x="16" y="60" width="52" height="3.5" rx="1.75" fill="#f1f5f9" />
                        <rect x="16" y="68" width="38" height="3.5" rx="1.75" fill="#f1f5f9" />
                      </g>
                    </g>

                    {/* Left Slide (in front, tilted ~ -6deg) */}
                    <g transform="translate(18, 18) rotate(-6)">
                      <g filter="url(#slideShadow)">
                        <rect x="0" y="0" width="144" height="108" rx="10" fill="#ffffff" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1.2" />
                        {/* Top Violet Accent Pill Badge */}
                        <rect x="16" y="15" width="28" height="5" rx="2.5" fill="#8b5cf6" />
                        {/* Presentation Outline Title */}
                        <text x="16" y="34" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="11" fontWeight="700" fill="#0f172a" letterSpacing="-0.01em">Presentation</text>
                        <text x="16" y="48" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="11" fontWeight="700" fill="#0f172a" letterSpacing="-0.01em">Outline</text>
                        {/* Text placeholder bars */}
                        <rect x="16" y="62" width="42" height="3.5" rx="1.75" fill="#cbd5e1" />
                        <rect x="16" y="70" width="30" height="3.5" rx="1.75" fill="#e2e8f0" />
                        {/* Embedded photo preview */}
                        <g clipPath="url(#slideMiniPhotoClip)">
                          <image href={sunsetImg} x="80" y="24" width="48" height="56" preserveAspectRatio="xMidYMid slice" />
                        </g>
                        <rect x="80" y="24" width="48" height="56" rx="5" fill="none" stroke="rgba(0, 0, 0, 0.08)" strokeWidth="0.8" />
                      </g>
                    </g>
                  </svg>
                )}

                {item.id === 'developer' && (
                  <svg viewBox="0 0 280 132" className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                      <filter id="devShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000000" floodOpacity="0.55" />
                      </filter>
                      <linearGradient id="editorGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0e131f" />
                        <stop offset="100%" stopColor="#090d15" />
                      </linearGradient>
                      <linearGradient id="badgeGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#0284c7" />
                        <stop offset="100%" stopColor="#0369a1" />
                      </linearGradient>
                    </defs>

                    {/* Realistic Dark Code Editor Window */}
                    <g transform="translate(12, 14)" filter="url(#devShadow)">
                      <rect x="0" y="0" width="256" height="118" rx="9" fill="url(#editorGrad)" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />

                      {/* Window Header */}
                      <rect x="0" y="0" width="256" height="22" rx="9" fill="rgba(255, 255, 255, 0.02)" />
                      <line x1="0" y1="22" x2="256" y2="22" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="0.8" />

                      {/* Window Traffic Lights */}
                      <circle cx="15" cy="11" r="3.5" fill="#ef4444" />
                      <circle cx="26" cy="11" r="3.5" fill="#f59e0b" />
                      <circle cx="37" cy="11" r="3.5" fill="#10b981" />

                      {/* Left Activity Bar / Gutter Icons */}
                      <line x1="28" y1="22" x2="28" y2="118" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="0.8" />

                      {/* File Icon */}
                      <g transform="translate(11, 33)" stroke="#64748b" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 1h5l3 3v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1Z" />
                        <path d="M7 1v3h3" />
                      </g>

                      {/* Search Icon */}
                      <g transform="translate(11, 49)" stroke="#64748b" strokeWidth="1.2" fill="none" strokeLinecap="round">
                        <circle cx="4.5" cy="4.5" r="3.5" />
                        <line x1="7" y1="7" x2="10" y2="10" />
                      </g>

                      {/* Git Branch Icon */}
                      <g transform="translate(11, 65)" stroke="#64748b" strokeWidth="1.2" fill="none" strokeLinecap="round">
                        <line x1="3" y1="2" x2="3" y2="10" />
                        <circle cx="3" cy="2" r="1.5" fill="#64748b" />
                        <circle cx="3" cy="10" r="1.5" fill="#64748b" />
                        <path d="M3 6a3 3 0 0 1 3-3h1" />
                        <circle cx="8" cy="3" r="1.5" fill="#64748b" />
                      </g>

                      {/* Play / Run Icon */}
                      <polygon points="12,83 12,93 19,88" fill="#64748b" />

                      {/* Line Numbers */}
                      <g fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, monospace" fontSize="9.5" fill="#475569" textAnchor="end">
                        <text x="44" y="38">1</text>
                        <text x="44" y="52">2</text>
                        <text x="44" y="66">3</text>
                        <text x="44" y="80">4</text>
                        <text x="44" y="94">5</text>
                      </g>

                      {/* Syntax-Highlighted Code Lines */}
                      <g fontFamily="'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, monospace" fontSize="9.8" letterSpacing="-0.01em">
                        {/* Line 1: function greet(name) { */}
                        <text x="52" y="38">
                          <tspan fill="#c084fc">function </tspan>
                          <tspan fill="#38bdf8">greet</tspan>
                          <tspan fill="#cbd5e1">(name) &#123;</tspan>
                        </text>

                        {/* Line 2: return `Hello, ${name}!`; */}
                        <text x="52" y="52">
                          <tspan fill="#c084fc">&nbsp;&nbsp;return </tspan>
                          <tspan fill="#fde047">`Hello, &#36;&#123;name&#125;!`</tspan>
                          <tspan fill="#cbd5e1">;</tspan>
                        </text>

                        {/* Line 3: } */}
                        <text x="52" y="66">
                          <tspan fill="#cbd5e1">&#125;</tspan>
                        </text>

                        {/* Line 5: console.log(greet("NOVA")); */}
                        <text x="52" y="94">
                          <tspan fill="#38bdf8">console</tspan>
                          <tspan fill="#94a3b8">.</tspan>
                          <tspan fill="#38bdf8">log</tspan>
                          <tspan fill="#cbd5e1">(</tspan>
                          <tspan fill="#38bdf8">greet</tspan>
                          <tspan fill="#cbd5e1">(</tspan>
                          <tspan fill="#fde047">"NOVA"</tspan>
                          <tspan fill="#cbd5e1">));</tspan>
                        </text>
                      </g>
                    </g>
                  </svg>
                )}

                {item.id === 'knowledge' && (
                  <svg viewBox="0 0 280 132" className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                      <filter id="docShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000000" floodOpacity="0.5" />
                      </filter>
                      <linearGradient id="docIndigoGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" />
                        <stop offset="100%" stopColor="#3730a3" />
                      </linearGradient>
                      <linearGradient id="docVioletGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#6d28d9" />
                      </linearGradient>
                    </defs>

                    {/* Right Document (behind, tilted ~ +6deg) */}
                    <g transform="translate(122, 12) rotate(6)">
                      <g filter="url(#docShadow)">
                        <rect x="0" y="0" width="144" height="112" rx="10" fill="#ffffff" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
                        {/* Document header lines */}
                        <rect x="16" y="18" width="86" height="4" rx="2" fill="#cbd5e1" />
                        <rect x="16" y="27" width="102" height="4" rx="2" fill="#e2e8f0" />
                        <rect x="16" y="36" width="76" height="4" rx="2" fill="#e2e8f0" />
                        <rect x="16" y="45" width="56" height="4" rx="2" fill="#f1f5f9" />
                        <rect x="16" y="54" width="52" height="4" rx="2" fill="#f1f5f9" />
                        <rect x="16" y="63" width="48" height="4" rx="2" fill="#f1f5f9" />

                        {/* Image preview frame at bottom right */}
                        <g transform="translate(78, 48)">
                          <rect x="0" y="0" width="48" height="38" rx="5" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1" />
                          {/* Sun dot */}
                          <circle cx="34" cy="11" r="3.5" fill="#94a3b8" />
                          {/* Mountain peaks */}
                          <polygon points="6,31 18,17 28,29 36,21 44,31" fill="#94a3b8" />
                        </g>
                      </g>
                    </g>

                    {/* Left Document (in front, tilted ~ -6deg) */}
                    <g transform="translate(18, 16) rotate(-6)">
                      <g filter="url(#docShadow)">
                        <rect x="0" y="0" width="142" height="110" rx="10" fill="#ffffff" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1.2" />

                        {/* Violet Document Icon Badge */}
                        <rect x="16" y="16" width="22" height="22" rx="5" fill="#8b5cf6" />
                        {/* 3 Document Lines inside badge */}
                        <rect x="20" y="21" width="14" height="2" rx="1" fill="#ffffff" />
                        <rect x="20" y="26" width="14" height="2" rx="1" fill="#ffffff" />
                        <rect x="20" y="31" width="10" height="2" rx="1" fill="#ffffff" />

                        {/* Header Accent Bar next to badge */}
                        <rect x="44" y="18" width="64" height="5" rx="2.5" fill="#a855f7" />

                        {/* Lavender Tinted Block below header */}
                        <rect x="16" y="44" width="108" height="18" rx="4" fill="rgba(168, 85, 247, 0.12)" />
                        <rect x="24" y="51" width="76" height="4" rx="2" fill="#c084fc" opacity="0.8" />

                        {/* Text placeholder lines */}
                        <rect x="16" y="70" width="108" height="4" rx="2" fill="#cbd5e1" />
                        <rect x="16" y="79" width="94" height="4" rx="2" fill="#e2e8f0" />
                        <rect x="16" y="88" width="80" height="4" rx="2" fill="#e2e8f0" />
                        <rect x="16" y="97" width="98" height="3.5" rx="1.75" fill="#f1f5f9" />
                      </g>
                    </g>
                  </svg>
                )}
              </div>
            </button>
          )
        })}
      </section>

      {/* Bottom quick-action row - Following Approved Reference */}
      <section className="chat-quick-actions-row" aria-label="Quick actions">
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.id}
              type="button"
              className={`chat-quick-action-pill chat-quick-action-pill--${action.id}`}
              style={{
                '--pill-accent': action.color,
                '--pill-glow': `${action.color}26`,
              } as React.CSSProperties}
              onClick={() => {
                if (action.action === 'image') {
                  onSelectTool('image')
                } else if (action.prompt) {
                  onQuickAction?.(action.prompt)
                }
              }}
            >
              <Icon size={15} style={{ color: action.color }} />
              <span>{action.label}</span>
            </button>
          )
        })}
      </section>
    </div>
  )
}
