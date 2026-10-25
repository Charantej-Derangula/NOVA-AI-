import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  ArrowDownToLine,
  Check,
  Code2,
  Copy,
  FileCode,
  Info,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react'
import {
  generateDevStarter,
  downloadTextFile,
  safeFileSlug,
  detectLanguageFromBrief,
  type DevAssistantResult,
} from '../services/aiStudioService'

interface DevAssistantStudioProps {
  onClose: () => void
}

const STACK_OPTIONS = [
  'Auto-detect',
  'Java',
  'Python',
  'C',
  'C++',
  'JavaScript',
  'TypeScript',
  'React + TypeScript',
  'Node.js',
  'SQL',
  'HTML/CSS',
  'Go',
  'Rust',
  'C#',
] as const
type StackOption = (typeof STACK_OPTIONS)[number]

/**
 * Lightweight, safe syntax highlighter for code snippets
 */
function highlightCodeLine(line: string, language?: string): React.ReactNode {
  const trimmed = line.trim()
  const lang = language?.toLowerCase()

  // Check for preprocessor directives (#include, #define)
  if (lang !== 'python' && lang !== 'py' && (trimmed.startsWith('#include') || trimmed.startsWith('#define'))) {
    return <span className="tok-kw font-semibold">{line}</span>
  }

  // Check for whole line comments
  if (
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('--')
  ) {
    return <span className="tok-cmt">{line}</span>
  }

  // Tokenization regex
  // 1: Comments (//, #, --)
  // 2: Strings ("...", '...', `...`)
  // 3: Words (keywords, types, identifiers)
  // 4: Numbers
  const tokenRegex = /(\/\/.*|#.*|--.*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[\s\S]*?`|\b[a-zA-Z_$][a-zA-Z0-9_$]*\b|\b\d+(?:_\d+)*(?:\.\d+)?\b)/g

  const kwSet = new Set([
    // JS/TS
    'import', 'export', 'from', 'default', 'const', 'let', 'var', 'function', 'return',
    'if', 'else', 'switch', 'case', 'try', 'catch', 'finally', 'throw', 'async', 'await',
    'class', 'extends', 'interface', 'type', 'new', 'typeof', 'instanceof', 'true', 'false', 'null', 'undefined',
    // Java & C#
    'public', 'private', 'protected', 'static', 'final', 'void', 'package', 'implements', 'throws',
    'this', 'super', 'synchronized', 'volatile', 'transient', 'native', 'enum', 'assert',
    'internal', 'override', 'virtual', 'abstract', 'sealed', 'get', 'set',
    // C & C++
    'struct', 'typedef', 'sizeof', 'namespace', 'using', 'template', 'typename', 'nullptr', 'constexpr', 'auto',
    // Go
    'func', 'chan', 'go', 'select', 'defer', 'fallthrough', 'range',
    // Rust
    'fn', 'mut', 'pub', 'impl', 'trait', 'match', 'where', 'crate',
    // Python
    'def', 'elif', 'except', 'raise', 'with', 'as', 'for', 'while', 'in', 'not', 'and', 'or', 'is', 'lambda', 'None', 'True', 'False', 'self', 'pass', 'yield', 'global',
    // SQL
    'SELECT', 'select', 'FROM', 'from', 'WHERE', 'where', 'INSERT', 'insert', 'INTO', 'into',
    'UPDATE', 'update', 'DELETE', 'delete', 'JOIN', 'join', 'LEFT', 'left', 'RIGHT', 'right',
    'INNER', 'inner', 'OUTER', 'outer', 'ON', 'on', 'GROUP', 'group', 'BY', 'by', 'ORDER', 'order',
    'HAVING', 'having', 'LIMIT', 'limit', 'OFFSET', 'offset', 'AS', 'as', 'AND', 'and', 'OR', 'or',
    'NOT', 'not', 'IN', 'in', 'IS', 'is', 'NULL', 'null', 'CREATE', 'create', 'TABLE', 'table',
    'ALTER', 'alter', 'DROP', 'drop', 'PRIMARY', 'primary', 'KEY', 'key', 'FOREIGN', 'foreign',
    'REFERENCES', 'references', 'DEFAULT', 'default', 'CONSTRAINT', 'constraint', 'UNION', 'union',
  ])

  const typeSet = new Set([
    'string', 'number', 'boolean', 'any', 'void', 'unknown', 'never', 'object', 'Record',
    'Promise', 'React', 'FC', 'Props', 'Request', 'Response', 'NextFunction', 'Array', 'Map', 'Set',
    // Java types
    'int', 'float', 'double', 'long', 'short', 'byte', 'char', 'bool', 'String', 'Integer', 'Double',
    'Float', 'Long', 'Boolean', 'Scanner', 'System', 'List', 'ArrayList', 'HashMap', 'HashSet', 'Arrays',
    'Collections', 'Object', 'Math', 'Exception',
    // C/C++ types
    'size_t', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t',
    'vector', 'cout', 'cin', 'endl', 'printf', 'scanf',
    // Python types
    'str', 'dict', 'list', 'Optional', 'Union', 'Any',
    // Rust types
    'i8', 'i16', 'i32', 'i64', 'u8', 'u16', 'u32', 'u64', 'f32', 'f64', 'usize', 'isize', 'Vec', 'Option', 'Result',
    // SQL types
    'VARCHAR', 'INT', 'BIGINT', 'BOOLEAN', 'TIMESTAMP', 'UUID', 'TEXT', 'SERIAL', 'DATE',
  ])

  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index))
    }

    const token = match[0]
    if (token.startsWith('//') || token.startsWith('#') || token.startsWith('--')) {
      parts.push(<span key={match.index} className="tok-cmt">{token}</span>)
    } else if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'")) ||
      (token.startsWith('`') && token.endsWith('`'))
    ) {
      parts.push(<span key={match.index} className="tok-str">{token}</span>)
    } else if (kwSet.has(token)) {
      parts.push(<span key={match.index} className="tok-kw">{token}</span>)
    } else if (typeSet.has(token) || /^[A-Z][a-zA-Z0-9_]*$/.test(token)) {
      parts.push(<span key={match.index} className="tok-type">{token}</span>)
    } else if (/^\d+/.test(token)) {
      parts.push(<span key={match.index} className="tok-num">{token}</span>)
    } else {
      parts.push(token)
    }

    lastIndex = tokenRegex.lastIndex
  }

  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex))
  }

  return parts
}

export const DevAssistantStudio: React.FC<DevAssistantStudioProps> = ({ onClose }) => {
  const [brief, setBrief] = useState('')
  const [stack, setStack] = useState<StackOption>('Auto-detect')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DevAssistantResult | null>(null)
  const [copied, setCopied] = useState(false)
  const briefRef = useRef<HTMLTextAreaElement>(null)

  const detectedLanguage = useMemo(() => detectLanguageFromBrief(brief), [brief])
  const activeLanguage = stack === 'Auto-detect' ? (detectedLanguage || 'Auto-detect') : stack

  useEffect(() => {
    briefRef.current?.focus()
  }, [])

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanBrief = brief.trim()
    if (!cleanBrief) {
      setError('Please add a technical brief or task description before generating starter code.')
      briefRef.current?.focus()
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const data = await generateDevStarter(cleanBrief, stack)
      setResult(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || 'Failed to generate code starter with AI. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyCode = async () => {
    if (!result?.code) return
    try {
      await navigator.clipboard.writeText(result.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = result.code
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownloadCode = () => {
    if (!result?.code) return
    const filename = result.filename || `${safeFileSlug(result.brief, 'starter')}.txt`
    downloadTextFile(filename, result.code, 'text/plain')
  }

  const resultCode = result?.code
  const codeLines = useMemo(() => {
    if (!resultCode) return []
    return resultCode.split('\n')
  }, [resultCode])

  return (
    <div className="tool-studio tool-studio--developer select-text">
      {/* Polished Header */}
      <header className="tool-studio-header">
        <span className="tool-studio-mark" aria-hidden="true">
          <Code2 size={20} />
        </span>
        <div>
          <p>DEVELOPER STUDIO</p>
          <h2 id="tool-studio-title">Dev Assistant</h2>
        </div>
        <button className="tool-studio-close" type="button" onClick={onClose} aria-label="Close studio">
          <X size={19} />
        </button>
      </header>

      {/* Concise description */}
      <p className="tool-studio-description" id="tool-studio-description">
        Generate typed starter code, architecture scaffolding, and implementation notes from a technical brief.
      </p>

      {/* Subtle capability/status pill */}
      <div className="tool-studio-status">
        {isLoading ? (
          <>
            <Loader2 size={14} className="shrink-0 animate-spin text-teal-400" />
            <span className="text-teal-300">
              Generating {activeLanguage === 'Auto-detect' ? (detectedLanguage || 'code') : activeLanguage} starter code with AI...
            </span>
          </>
        ) : error ? (
          <>
            <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
            <span className="text-rose-300">AI generation issue encountered</span>
          </>
        ) : result ? (
          <>
            <Check size={14} className="shrink-0 text-emerald-400" />
            <span className="text-neutral-300">Code Starter Ready · {result.filename}</span>
          </>
        ) : (
          <>
            <Sparkles size={14} className="shrink-0 text-teal-400" />
            <span>Connected to NOVA AI Provider · Multi-language Code Generation · Scaffolding Only</span>
          </>
        )}
      </div>

      {/* Two-Column Split Workspace */}
      <div className="tool-studio-split-body">
        {/* Left Configuration Panel */}
        <form className="studio-split-config" onSubmit={handleGenerate} noValidate>
          <label className="tool-studio-field">
            <span className="flex items-center justify-between">
              <span>Technical Brief & Task</span>
              <span className="text-[11px] font-normal text-neutral-400">Required</span>
            </span>
            <textarea
              ref={briefRef}
              value={brief}
              onChange={(e) => {
                setBrief(e.target.value)
                if (error) setError(null)
              }}
              rows={5}
              placeholder="Describe the component, function, schema, or API route you want to build (e.g. Need a simple Java code of adding 2 numbers, Write a Python program to reverse a string)"
              disabled={isLoading}
              className="resize-none"
              aria-invalid={Boolean(error)}
            />
          </label>

          <div className="tool-studio-field">
            <span className="flex items-center justify-between">
              <span>Framework / Language</span>
              <span className="text-[11px] font-normal text-teal-300/80">
                {stack === 'Auto-detect'
                  ? detectedLanguage
                    ? `Auto-detect · Detected ${detectedLanguage}`
                    : 'Auto-detect'
                  : stack}
              </span>
            </span>
            <div className="tool-style-options">
              {STACK_OPTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setStack(item)}
                  disabled={isLoading}
                  className={`tool-style-chip ${stack === item ? 'is-selected' : ''}`}
                >
                  <span className="tool-style-chip-dot bg-teal-400" />
                  <span>{item}</span>
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
                <span>Generating Code Starter...</span>
              </>
            ) : (
              <>
                <span>Generate Code Starter</span>
                <Sparkles size={16} />
              </>
            )}
          </button>
        </form>

        {/* Right Output Panel */}
        <section className={`studio-split-output ${result ? 'has-output' : ''}`} aria-live="polite">
          {isLoading && (
            <div className="studio-loading-state">
              <div className="flex items-center gap-2.5 text-xs text-teal-300/90 mb-4 font-medium">
                <Loader2 size={15} className="animate-spin" />
                <span>Synthesizing typed starter code and architecture notes with AI...</span>
              </div>
              <div className="dev-skeleton-editor">
                <div className="dev-skeleton-header">
                  <div className="h-3.5 w-28 bg-white/10 rounded animate-pulse" />
                  <div className="h-3.5 w-16 bg-white/10 rounded animate-pulse" />
                </div>
                <div className="dev-skeleton-code space-y-2 p-4">
                  <div className="h-3 w-3/4 bg-white/10 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-white/5 rounded animate-pulse" />
                  <div className="h-3 w-5/6 bg-white/10 rounded animate-pulse" />
                  <div className="h-3 w-2/3 bg-white/5 rounded animate-pulse" />
                  <div className="h-3 w-4/5 bg-white/10 rounded animate-pulse" />
                  <div className="h-3 w-1/3 bg-white/5 rounded animate-pulse" />
                </div>
              </div>
            </div>
          )}

          {!isLoading && !result && (
            <div className="tool-studio-empty">
              <span>
                <Code2 size={24} />
              </span>
              <strong>Your code output will appear here</strong>
              <p>
                Enter your technical brief and select a language or framework on the left, then click{' '}
                <strong>Generate Code Starter</strong> to create typed starter code and architecture notes.
              </p>
            </div>
          )}

          {!isLoading && result && (
            <div className="dev-code-view">
              {/* File Header Bar */}
              <div className="dev-file-header">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileCode size={16} className="text-teal-400 shrink-0" />
                  <span className="dev-file-name truncate">{result.filename}</span>
                  <span className="dev-lang-badge">{result.language}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="dev-toolbar-btn"
                    aria-label="Copy code to clipboard"
                  >
                    {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCode}
                    className="dev-toolbar-btn"
                    aria-label="Download code file"
                  >
                    <ArrowDownToLine size={13} />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              {/* Code Editor Container */}
              <div className="dev-editor-container">
                <pre className="dev-code-pre">
                  <code>
                    {codeLines.map((line, idx) => (
                      <div className="dev-code-line" key={idx}>
                        <span className="dev-line-num">{idx + 1}</span>
                        <span className="dev-line-content">{highlightCodeLine(line, result.language)}</span>
                      </div>
                    ))}
                  </code>
                </pre>
              </div>

              {/* Implementation Notes Callout */}
              {result.notes && (
                <div className="dev-notes-card">
                  <div className="flex items-center gap-2 text-teal-300 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    <Info size={14} className="shrink-0" />
                    <span>Implementation Notes & Architecture</span>
                  </div>
                  <p className="dev-notes-text">{result.notes}</p>
                </div>
              )}

              {/* Action Bar / Safety Note */}
              <div className="outline-action-bar">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button className="tool-studio-download" type="button" onClick={handleDownloadCode}>
                    <ArrowDownToLine size={15} />
                    <span>Download {result.filename}</span>
                  </button>
                  <span className="dev-stat-badge">
                    {codeLines.length} lines · {Math.round(result.code.length / 10.24) / 100} KB
                  </span>
                </div>
                <p className="outline-export-note">
                  Generated code scaffolding for inspection and review. Does not auto-execute or modify local project files.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
