import React, { useState, useRef, useEffect } from 'react'
import {
  ArrowDownToLine,
  Check,
  Copy,
  Edit3,
  FileCode,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Sparkles,
  X,
} from 'lucide-react'
import {
  generatePresentationOutline,
  buildOutlineMarkdown,
  buildInteractiveDeckHtml,
  downloadTextFile,
  safeFileSlug,
  type PresentationOutlineResult,
  type SlideItem,
} from '../services/aiStudioService'

interface AiPresentationStudioProps {
  onClose: () => void
}

const SLIDE_COUNT_OPTIONS = [4, 6, 8, 10, 12]

export const AiPresentationStudio: React.FC<AiPresentationStudioProps> = ({ onClose }) => {
  const [topic, setTopic] = useState('')
  const [audience, setAudience] = useState('Leadership team')
  const [slideCount, setSlideCount] = useState<number>(6)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outline, setOutline] = useState<PresentationOutlineResult | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const topicRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    topicRef.current?.focus()
  }, [])

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanTopic = topic.trim()
    if (!cleanTopic) {
      setError('Please enter a presentation topic or goals before building the outline.')
      topicRef.current?.focus()
      return
    }

    setIsLoading(true)
    setError(null)
    setIsEditing(false)

    try {
      const result = await generatePresentationOutline(cleanTopic, audience.trim() || 'Leadership team', slideCount)
      setOutline(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || 'Failed to generate presentation outline with AI. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyOutline = async () => {
    if (!outline) return
    const md = buildOutlineMarkdown(outline)
    try {
      await navigator.clipboard.writeText(md)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = md
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownloadMarkdown = () => {
    if (!outline) return
    const slug = safeFileSlug(outline.topic, 'presentation-outline')
    downloadTextFile(`${slug}.md`, buildOutlineMarkdown(outline), 'text/markdown')
  }

  const handleDownloadHtmlDeck = () => {
    if (!outline) return
    const slug = safeFileSlug(outline.topic, 'presentation-deck')
    downloadTextFile(`${slug}-deck.html`, buildInteractiveDeckHtml(outline), 'text/html')
  }

  const handleUpdateSlide = (index: number, updatedFields: Partial<SlideItem>) => {
    if (!outline) return
    const nextSlides = [...outline.slides]
    nextSlides[index] = { ...nextSlides[index], ...updatedFields }
    setOutline({ ...outline, slides: nextSlides })
  }

  return (
    <div className="tool-studio tool-studio--presentation select-text">
      {/* Polished Header */}
      <header className="tool-studio-header">
        <span className="tool-studio-mark" aria-hidden="true">
          <FileText size={20} />
        </span>
        <div>
          <p>AI PRESENTATION STUDIO</p>
          <h2 id="tool-studio-title">AI Presentation</h2>
        </div>
        <button className="tool-studio-close" type="button" onClick={onClose} aria-label="Close studio">
          <X size={19} />
        </button>
      </header>

      {/* Concise description */}
      <p className="tool-studio-description" id="tool-studio-description">
        Shape your topic into a structured slide outline, visual ideas, speaker notes, and downloadable presentation deck.
      </p>

      {/* Subtle capability/status pill */}
      <div className="tool-studio-status">
        {isLoading ? (
          <>
            <Loader2 size={14} className="shrink-0 animate-spin text-amber-400" />
            <span className="text-amber-300">Generating {slideCount}-slide outline with AI...</span>
          </>
        ) : error ? (
          <>
            <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
            <span className="text-rose-300">AI generation issue encountered</span>
          </>
        ) : outline ? (
          <>
            <Check size={14} className="shrink-0 text-emerald-400" />
            <span className="text-neutral-300">AI Outline Ready · {outline.slides.length} Slides</span>
          </>
        ) : (
          <>
            <Sparkles size={14} className="shrink-0 text-amber-400" />
            <span>Connected to NOVA AI Provider · Llama 3.3 70B · Markdown & HTML Export</span>
          </>
        )}
      </div>

      {/* Two-Column Split Workspace */}
      <div className="tool-studio-split-body">
        {/* Left Configuration Panel */}
        <form className="studio-split-config" onSubmit={handleGenerate} noValidate>
          <label className="tool-studio-field">
            <span className="flex items-center justify-between">
              <span>Presentation Topic & Goals</span>
              <span className="text-[11px] font-normal text-neutral-400">Required</span>
            </span>
            <textarea
              ref={topicRef}
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value)
                if (error) setError(null)
              }}
              rows={4}
              placeholder="What is the presentation about and what are the primary takeaways? (e.g. Launching NOVA Workspace, Q3 Growth Review, AI Strategy)"
              disabled={isLoading}
              className="resize-none"
              aria-invalid={Boolean(error)}
            />
          </label>

          <label className="tool-studio-field">
            <span>Target Audience</span>
            <input
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. Executive leadership, engineering team, investors"
              disabled={isLoading}
            />
          </label>

          <div className="tool-studio-field">
            <span className="flex items-center justify-between">
              <span>Slide Count</span>
              <span className="text-[11px] font-normal text-amber-300/80">{slideCount} slides</span>
            </span>
            <div className="tool-style-options">
              {SLIDE_COUNT_OPTIONS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setSlideCount(count)}
                  disabled={isLoading}
                  className={`tool-style-chip ${slideCount === count ? 'is-selected' : ''}`}
                >
                  <span>{count} slides</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-200 text-xs flex items-start gap-2.5" role="alert">
              <span className="leading-relaxed flex-1">{error}</span>
            </div>
          )}

          <button className="tool-studio-generate" type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Building Slide Outline...</span>
              </>
            ) : (
              <>
                <span>Build Slide Outline</span>
                <Sparkles size={16} />
              </>
            )}
          </button>
        </form>

        {/* Right Output Panel */}
        <section className={`studio-split-output ${outline ? 'has-output' : ''}`} aria-live="polite">
          {isLoading && (
            <div className="studio-loading-state">
              <div className="flex items-center gap-2.5 text-xs text-amber-300/90 mb-4 font-medium">
                <Loader2 size={15} className="animate-spin" />
                <span>Drafting slide-by-slide structure, visuals, and speaker notes...</span>
              </div>
              <div className="studio-skeleton-list">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="studio-skeleton-slide">
                    <div className="h-3 w-20 bg-white/10 rounded mb-2.5 animate-pulse" />
                    <div className="h-4 w-3/4 bg-white/10 rounded mb-3 animate-pulse" />
                    <div className="space-y-1.5">
                      <div className="h-2.5 w-full bg-white/5 rounded animate-pulse" />
                      <div className="h-2.5 w-5/6 bg-white/5 rounded animate-pulse" />
                      <div className="h-2.5 w-2/3 bg-white/5 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isLoading && !outline && (
            <div className="tool-studio-empty">
              <span>
                <FileText size={24} />
              </span>
              <strong>Your slide outline will appear here</strong>
              <p>
                Enter your presentation topic, target audience, and slide count on the left, then click{' '}
                <strong>Build Slide Outline</strong> to generate an editable outline with talking points, visual concepts,
                and speaker notes.
              </p>
            </div>
          )}

          {!isLoading && outline && (
            <div className="presentation-outline-view">
              {/* Output Toolbar */}
              <div className="outline-view-toolbar">
                <div className="flex items-center gap-2">
                  <span className="outline-badge">{outline.slides.length} Slides</span>
                  <span className="outline-meta-text">Audience: {outline.audience}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(!isEditing)}
                    className={`outline-toolbar-btn ${isEditing ? 'is-active' : ''}`}
                    aria-label={isEditing ? 'Save and preview outline' : 'Edit slide outline'}
                  >
                    {isEditing ? <Check size={13} className="text-emerald-400" /> : <Edit3 size={13} />}
                    <span>{isEditing ? 'Done Editing' : 'Edit Outline'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyOutline}
                    className="outline-toolbar-btn"
                    aria-label="Copy markdown outline"
                  >
                    {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Slide Cards List */}
              <div className="outline-cards-scroll">
                {outline.slides.map((slide, idx) => (
                  <article className="outline-slide-card" key={`slide-${idx}`}>
                    <div className="outline-slide-card-header">
                      {isEditing ? (
                        <div className="flex items-center gap-2 w-full">
                          <span className="outline-slide-num">Slide {idx + 1}</span>
                          <input
                            type="text"
                            value={slide.kicker}
                            onChange={(e) => handleUpdateSlide(idx, { kicker: e.target.value.toUpperCase() })}
                            className="outline-edit-kicker"
                            placeholder="CATEGORY / THEME"
                          />
                        </div>
                      ) : (
                        <>
                          <span className="outline-slide-kicker">{slide.kicker}</span>
                          <span className="outline-slide-num">
                            {String(idx + 1).padStart(2, '0')} / {String(outline.slides.length).padStart(2, '0')}
                          </span>
                        </>
                      )}
                    </div>

                    {isEditing ? (
                      <input
                        type="text"
                        value={slide.title}
                        onChange={(e) => handleUpdateSlide(idx, { title: e.target.value })}
                        className="outline-edit-title"
                        placeholder="Slide Title"
                      />
                    ) : (
                      <h3 className="outline-slide-title">{slide.title}</h3>
                    )}

                    {/* Talking Points */}
                    <div className="outline-section">
                      <span className="outline-section-label">Key Talking Points</span>
                      {isEditing ? (
                        <textarea
                          rows={3}
                          value={slide.talkingPoints.join('\n')}
                          onChange={(e) =>
                            handleUpdateSlide(idx, {
                              talkingPoints: e.target.value.split('\n').filter((l) => l.trim().length > 0),
                            })
                          }
                          className="outline-edit-textarea"
                          placeholder="One key talking point per line"
                        />
                      ) : (
                        <ul className="outline-bullet-list">
                          {slide.talkingPoints.map((point, pIdx) => (
                            <li key={pIdx}>{point}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Suggested Visual */}
                    <div className="outline-section outline-visual-box">
                      <div className="flex items-center gap-2 text-amber-300/90 text-xs font-medium mb-1">
                        <ImageIcon size={13} />
                        <span>Suggested Visual</span>
                      </div>
                      {isEditing ? (
                        <input
                          type="text"
                          value={slide.visual}
                          onChange={(e) => handleUpdateSlide(idx, { visual: e.target.value })}
                          className="outline-edit-input"
                          placeholder="Suggested chart, illustration, or visual layout"
                        />
                      ) : (
                        <p className="outline-visual-desc">{slide.visual}</p>
                      )}
                    </div>

                    {/* Speaker Notes */}
                    {(slide.speakerNotes || isEditing) && (
                      <div className="outline-section outline-notes-box">
                        <div className="flex items-center gap-1.5 text-neutral-400 text-xs font-medium mb-1">
                          <MessageSquare size={13} />
                          <span>Speaker Notes</span>
                        </div>
                        {isEditing ? (
                          <textarea
                            rows={2}
                            value={slide.speakerNotes}
                            onChange={(e) => handleUpdateSlide(idx, { speakerNotes: e.target.value })}
                            className="outline-edit-textarea"
                            placeholder="Speaker delivery notes and reminders"
                          />
                        ) : (
                          <p className="outline-notes-desc">{slide.speakerNotes}</p>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>

              {/* Action Bar */}
              <div className="outline-action-bar">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button className="tool-studio-download" type="button" onClick={handleDownloadHtmlDeck}>
                    <ArrowDownToLine size={15} />
                    <span>Download HTML Deck</span>
                  </button>
                  <button className="outline-secondary-btn" type="button" onClick={handleDownloadMarkdown}>
                    <FileCode size={15} />
                    <span>Download Markdown (.md)</span>
                  </button>
                </div>
                <p className="outline-export-note">
                  Interactive HTML deck with keyboard navigation & Markdown outline. PowerPoint export (.pptx) not connected.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
