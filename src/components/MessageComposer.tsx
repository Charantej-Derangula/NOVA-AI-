import React, { useState, useRef, useEffect } from 'react'
import {
  ArrowUp,
  Mic,
  Paperclip,
  X,
  FileText,
  LayoutGrid,
  Radio,
  Plus,
  Image,
  FolderKanban,
  File,
  Presentation,
} from 'lucide-react'
import type { AttachmentItem } from '../types'

interface MessageComposerProps {
  value: string
  onChange: (value: string) => void
  onSendMessage: (content: string, attachment?: AttachmentItem) => void
  onOpenSettings?: () => void
  onSelectVoiceMode?: (mode: 'stt' | 'sts') => void
  onSelectTool?: (tool: 'image' | 'presentation' | 'developer') => void
  onOpenLibrary?: () => void
  disabled?: boolean
  isHomeLanding?: boolean
}

const promptOptions = [
  { label: 'Make a plan', prompt: 'Help me make a clear, realistic plan for: ' },
  { label: 'Explore an idea', prompt: 'Help me explore this idea, test its assumptions, and find useful next questions: ' },
  { label: 'Set priorities', prompt: 'Help me choose the three most important next steps for: ' },
]

const isImageAttachment = (att: AttachmentItem): boolean => {
  if (att.type?.startsWith('image/')) return true
  if (att.url && /\.(png|jpe?g|webp|gif|svg|bmp|avif)(\?.*)?$/i.test(att.url)) return true
  return /\.(png|jpe?g|webp|gif|svg|bmp|avif)$/i.test(att.name)
}

const getFileExtension = (filename: string): string => {
  const parts = filename.split('.')
  if (parts.length > 1) {
    const ext = parts[parts.length - 1].toUpperCase()
    return ext.length <= 4 ? ext : 'FILE'
  }
  return 'FILE'
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  value,
  onChange,
  onSendMessage,
  onSelectVoiceMode,
  onSelectTool,
  onOpenLibrary,
  disabled = false,
  isHomeLanding = false,
}) => {
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [isOptionsOpen, setIsOptionsOpen] = useState(false)
  const [isVoiceMenuOpen, setIsVoiceMenuOpen] = useState(false)
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const voiceMenuRef = useRef<HTMLDivElement>(null)
  const attachmentsRef = useRef<AttachmentItem[]>(attachments)

  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])

  // Revoke object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((att) => {
        if (att.url && att.url.startsWith('blob:')) {
          URL.revokeObjectURL(att.url)
        }
      })
    }
  }, [])

  // Auto-resize textarea height smoothly
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`
    }
  }, [value])

  // Close menus on outside click or escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (voiceMenuRef.current && !voiceMenuRef.current.contains(event.target as Node)) {
        setIsVoiceMenuOpen(false)
      }
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setIsAddMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsVoiceMenuOpen(false)
        setIsOptionsOpen(false)
        setIsAddMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed && attachments.length === 0) return

    setIsSending(true)
    setTimeout(() => setIsSending(false), 700)

    const primaryAttachment = attachments[0] || undefined
    const messageContent =
      trimmed ||
      (attachments.length === 1
        ? `Attached: ${attachments[0].name}`
        : `Attached: ${attachments.map((a) => a.name).join(', ')}`)

    onSendMessage(messageContent, primaryAttachment)
    onChange('')
    setAttachments([])
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const newItems: AttachmentItem[] = Array.from(files).map((file, idx) => {
        const sizeKB = Math.round(file.size / 1024)
        const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`
        const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp|avif)$/i.test(file.name)
        const objectUrl = isImage ? URL.createObjectURL(file) : undefined
        return {
          id: `att-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          size: sizeStr,
          type: file.type || (isImage ? 'image' : 'file'),
          url: objectUrl,
        }
      })
      setAttachments((prev) => [...prev, ...newItems])
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((att) => att.id === id)
      if (target?.url && target.url.startsWith('blob:')) {
        URL.revokeObjectURL(target.url)
      }
      return prev.filter((att) => att.id !== id)
    })
  }

  const handleSelectMode = (mode: 'stt' | 'sts') => {
    setIsVoiceMenuOpen(false)
    if (onSelectVoiceMode) {
      onSelectVoiceMode(mode)
    }
  }

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !disabled

  return (
    <div className="message-composer-wrap">
      <div className={`message-composer-panel ${isHomeLanding ? 'home-composer-glow' : ''} ${isSending ? 'is-sending' : ''}`}>
        {/* Single continuous travelling perimeter light */}
        <div className="message-composer-border-light" aria-hidden="true" />

        {/* Dedicated Attachment Previews Row (if attachments present) */}
        {attachments.length > 0 && (
          <div className="message-composer-attachments-row" aria-label="Attachments">
            {attachments.map((att) => {
              const isImage = isImageAttachment(att) && !!att.url
              if (isImage) {
                return (
                  <div
                    key={att.id}
                    className="composer-att-thumb-card"
                    title={`${att.name}${att.size ? ` (${att.size})` : ''}`}
                  >
                    <div className="composer-att-thumb-wrap">
                      <img
                        src={att.url}
                        alt={att.name}
                        className="composer-att-thumb-img"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="composer-att-remove-btn"
                      aria-label={`Remove ${att.name}`}
                    >
                      <X size={12} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                  </div>
                )
              }

              return (
                <div
                  key={att.id}
                  className="composer-att-file-card"
                  title={`${att.name}${att.size ? ` (${att.size})` : ''}`}
                >
                  <div className="composer-att-file-icon" aria-hidden="true">
                    <FileText size={17} />
                  </div>
                  <div className="composer-att-file-info">
                    <span className="composer-att-file-name">{att.name}</span>
                    <span className="composer-att-file-meta">
                      {getFileExtension(att.name)}
                      {att.size ? ` • ${att.size}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att.id)}
                    className="composer-att-file-remove"
                    aria-label={`Remove ${att.name}`}
                  >
                    <X size={14} strokeWidth={2} aria-hidden="true" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Text Input Row */}
        <div className="message-composer-main">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything, or tell NOVA what you’re working on..."
            disabled={disabled}
            aria-label="Write a message"
            className="message-composer-input resize-none"
          />

          {/* Action Bar */}
          <div className="message-composer-actions">
            {/* Left Tools */}
            <div className="message-composer-tools">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                aria-label="Upload files or photos"
              />
              <input
                ref={docInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.md,.rtf"
                className="hidden"
                onChange={handleFileChange}
                aria-label="Upload documents"
              />
              <input
                ref={pdfInputRef}
                type="file"
                multiple
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
                aria-label="Upload PDF"
              />

              <div ref={addMenuRef} className="message-composer-add-wrapper relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddMenuOpen((open) => !open)
                    setIsOptionsOpen(false)
                    setIsVoiceMenuOpen(false)
                  }}
                  className={`message-composer-tool message-composer-add-btn ${isAddMenuOpen ? 'is-active text-violet-300' : ''}`}
                  title="Add files or tools"
                  aria-label="Add files or tools"
                  aria-expanded={isAddMenuOpen}
                  aria-haspopup="menu"
                >
                  <Plus size={18} strokeWidth={2.2} aria-hidden="true" />
                </button>

                {isAddMenuOpen && (
                  <div
                    className="composer-add-menu"
                    role="menu"
                    aria-label="Composer actions"
                  >
                    <div className="composer-add-menu-header">
                      <span>Add &amp; Actions</span>
                    </div>

                    <div className="composer-add-menu-items">
                      {/* 1. Add photos & files */}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          fileInputRef.current?.click()
                          setIsAddMenuOpen(false)
                        }}
                        className="composer-add-menu-item"
                      >
                        <div className="composer-add-item-icon">
                          <Paperclip size={16} className="text-violet-400" aria-hidden="true" />
                        </div>
                        <div className="composer-add-item-content">
                          <span className="composer-add-item-title">Add photos &amp; files</span>
                          <span className="composer-add-item-desc">Upload images or files from your device</span>
                        </div>
                      </button>

                      {/* 2. Add from library */}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onOpenLibrary?.()
                          setIsAddMenuOpen(false)
                        }}
                        className="composer-add-menu-item"
                      >
                        <div className="composer-add-item-icon">
                          <FolderKanban size={16} className="text-purple-400" aria-hidden="true" />
                        </div>
                        <div className="composer-add-item-content">
                          <span className="composer-add-item-title">Add from library</span>
                          <span className="composer-add-item-desc">Reference saved Knowledge and notes</span>
                        </div>
                      </button>

                      {/* 3. Create image */}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onSelectTool?.('image')
                          setIsAddMenuOpen(false)
                        }}
                        className="composer-add-menu-item"
                      >
                        <div className="composer-add-item-icon">
                          <Image size={16} className="text-emerald-400" aria-hidden="true" />
                        </div>
                        <div className="composer-add-item-content">
                          <span className="composer-add-item-title">Create image</span>
                          <span className="composer-add-item-desc">Launch Image Studio vector generator</span>
                        </div>
                      </button>

                      {/* 4. Documents */}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          docInputRef.current?.click()
                          setIsAddMenuOpen(false)
                        }}
                        className="composer-add-menu-item"
                      >
                        <div className="composer-add-item-icon">
                          <FileText size={16} className="text-amber-400" aria-hidden="true" />
                        </div>
                        <div className="composer-add-item-content">
                          <span className="composer-add-item-title">Documents</span>
                          <span className="composer-add-item-desc">Upload text, docx, or markdown files</span>
                        </div>
                      </button>

                      {/* 5. PDF */}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          pdfInputRef.current?.click()
                          setIsAddMenuOpen(false)
                        }}
                        className="composer-add-menu-item"
                      >
                        <div className="composer-add-item-icon">
                          <File size={16} className="text-rose-400" aria-hidden="true" />
                        </div>
                        <div className="composer-add-item-content">
                          <span className="composer-add-item-title">PDF</span>
                          <span className="composer-add-item-desc">Attach PDF documents directly</span>
                        </div>
                      </button>

                      {/* 6. Presentations */}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onSelectTool?.('presentation')
                          setIsAddMenuOpen(false)
                        }}
                        className="composer-add-menu-item"
                      >
                        <div className="composer-add-item-icon">
                          <Presentation size={16} className="text-blue-400" aria-hidden="true" />
                        </div>
                        <div className="composer-add-item-content">
                          <span className="composer-add-item-title">Presentations</span>
                          <span className="composer-add-item-desc">Create slide deck outlines in Studio</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="message-composer-options">
                <button
                  type="button"
                  onClick={() => {
                    setIsOptionsOpen((open) => !open)
                    setIsAddMenuOpen(false)
                    setIsVoiceMenuOpen(false)
                  }}
                  className="message-composer-tool"
                  title="Prompt options"
                  aria-label="Prompt options"
                  aria-expanded={isOptionsOpen}
                  aria-haspopup="menu"
                >
                  <LayoutGrid size={17} aria-hidden="true" />
                  <span>Options</span>
                </button>
                {isOptionsOpen && (
                  <div className="message-composer-options-menu" role="menu" aria-label="Prompt starters">
                    {promptOptions.map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onChange(option.prompt)
                          setIsOptionsOpen(false)
                          textareaRef.current?.focus()
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Tools: Voice Mode Menu and Send Button */}
            <div className="message-composer-send-group">
              {/* Voice Mode Popover Menu with strictly 2 modes: STT and STS */}
              <div ref={voiceMenuRef} className="message-composer-voice-menu">
                <button
                  type="button"
                  onClick={() => setIsVoiceMenuOpen((prev) => !prev)}
                  className={`message-composer-tool message-composer-voice ${isVoiceMenuOpen ? 'is-active text-violet-300' : ''}`}
                  title="Voice input modes"
                  aria-label="Choose voice input mode"
                  aria-expanded={isVoiceMenuOpen}
                  aria-haspopup="menu"
                >
                  <Mic size={19} aria-hidden="true" />
                </button>

                {isVoiceMenuOpen && (
                  <div className="message-composer-voice-menu-popover" role="menu" aria-label="Voice interaction modes">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleSelectMode('stt')}
                      className="group"
                    >
                      <div className="voice-mode-icon">
                        <FileText size={18} aria-hidden="true" />
                      </div>
                      <span>
                        <strong>Speech to Text</strong>
                        <small>Convert speech to editable text for review</small>
                      </span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleSelectMode('sts')}
                      className="group"
                    >
                      <div className="voice-mode-icon">
                        <Radio size={18} aria-hidden="true" />
                      </div>
                      <span>
                        <strong>Speech to Speech</strong>
                        <small>Converse naturally with NOVA voice</small>
                      </span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className={`message-composer-send ${canSend ? 'is-ready' : ''}`}
                aria-label="Send message"
              >
                <ArrowUp size={19} strokeWidth={2.3} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>


    </div>
  )
}
