import React, { useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface FormattedMessageProps {
  content: string
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = code
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        // Fallback ignore
      }
      document.body.removeChild(textarea)
    }
  }

  return (
    <div className="chat-code-block my-3 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0a12]">
      <div className="chat-code-block-header flex items-center justify-between border-b border-white/[0.06] bg-white/[0.025] px-3.5 py-1.5 text-xs text-neutral-400">
        <span className="font-mono text-[11px] font-medium text-violet-300/80 uppercase tracking-wider">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          aria-label={copied ? 'Copied code to clipboard' : 'Copy code to clipboard'}
        >
          {copied ? (
            <>
              <Check size={12} className="text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-[13.5px] leading-[1.55] text-[#ded5e8]">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function formatInlineText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  // Matches inline code `code`, bold **text** or __text__, italic *text* or _text_, and links [text](url)
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[([^\]]+)\]\(([^)]+)\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const matchedStr = match[0]
    if (matchedStr.startsWith('`') && matchedStr.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          className="rounded bg-white/[0.08] border border-white/[0.06] px-1.5 py-0.5 font-mono text-[13px] text-violet-200"
        >
          {matchedStr.slice(1, -1)}
        </code>
      )
    } else if (
      (matchedStr.startsWith('**') && matchedStr.endsWith('**')) ||
      (matchedStr.startsWith('__') && matchedStr.endsWith('__'))
    ) {
      parts.push(
        <strong key={match.index} className="font-semibold text-white">
          {matchedStr.slice(2, -2)}
        </strong>
      )
    } else if (
      (matchedStr.startsWith('*') && matchedStr.endsWith('*')) ||
      (matchedStr.startsWith('_') && matchedStr.endsWith('_'))
    ) {
      parts.push(
        <em key={match.index} className="italic text-neutral-200">
          {matchedStr.slice(1, -1)}
        </em>
      )
    } else if (matchedStr.startsWith('[') && match[2] && match[3]) {
      parts.push(
        <a
          key={match.index}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-300 underline underline-offset-2 hover:text-white transition-colors"
        >
          {match[2]}
        </a>
      )
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

function parseTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  if (lines.length < 2) return null
  const headerLine = lines[0].trim()
  const sepLine = lines[1].trim()

  if (!headerLine.includes('|') || !sepLine.includes('-')) return null
  if (!/^\|?\s*:?-+:?\s*(\|?\s*:?-+:?\s*)*\|?$/.test(sepLine)) return null

  const splitRow = (line: string): string[] => {
    let clean = line.trim()
    if (clean.startsWith('|')) clean = clean.slice(1)
    if (clean.endsWith('|')) clean = clean.slice(0, -1)
    return clean.split('|').map((c) => c.trim())
  }

  const headers = splitRow(headerLine)
  const rows: string[][] = []
  for (let i = 2; i < lines.length; i++) {
    const rowLine = lines[i].trim()
    if (rowLine) {
      rows.push(splitRow(rowLine))
    }
  }

  return { headers, rows }
}

function isBulletItem(line: string): boolean {
  return /^\s*(?:[-*+•]|\u2022)\s+/.test(line)
}

function stripBullet(line: string): string {
  return line.trim().replace(/^(?:[-*+•]|\u2022)\s+/, '')
}

function isNumberedItem(line: string): boolean {
  return /^\s*\d+[.)]\s+/.test(line)
}

function stripNumber(line: string): string {
  return line.trim().replace(/^\d+[.)]\s+/, '')
}

function isBlockquote(line: string): boolean {
  return /^\s*>\s*/.test(line)
}

function isTableStart(lines: string[], idx: number): boolean {
  if (idx + 1 >= lines.length) return false
  const line = lines[idx].trim()
  const nextLine = lines[idx + 1].trim()
  return line.includes('|') && /^\|?\s*:?-+:?\s*(\|?\s*:?-+:?\s*)*\|?$/.test(nextLine)
}

function renderTextChunk(chunk: string, baseIndex: number): React.ReactNode {
  const rawLines = chunk.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0
  let blockIdx = 0

  while (i < rawLines.length) {
    const line = rawLines[i]
    const trimmed = line.trim()

    // 1. Skip completely blank lines
    if (!trimmed) {
      i++
      continue
    }

    // 2. Horizontal Rule
    if (/^(?:---+|\*\*\*+|___+)$/.test(trimmed)) {
      elements.push(<hr key={`hr-${baseIndex}-${blockIdx++}`} className="my-3.5 border-white/[0.08]" />)
      i++
      continue
    }

    // 3. Headings (Restrained sizes for chat context)
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${baseIndex}-${blockIdx++}`} className="mt-4 mb-2 text-[20px] font-semibold text-white leading-snug">
          {formatInlineText(trimmed.slice(2))}
        </h1>
      )
      i++
      continue
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${baseIndex}-${blockIdx++}`} className="mt-3.5 mb-1.5 text-[17px] font-semibold text-violet-100 leading-snug">
          {formatInlineText(trimmed.slice(3))}
        </h2>
      )
      i++
      continue
    }
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${baseIndex}-${blockIdx++}`} className="mt-3 mb-1 text-[15.5px] font-semibold text-violet-100 leading-snug">
          {formatInlineText(trimmed.slice(4))}
        </h3>
      )
      i++
      continue
    }
    if (trimmed.startsWith('#### ')) {
      elements.push(
        <h4 key={`h4-${baseIndex}-${blockIdx++}`} className="mt-2.5 mb-1 text-[14.5px] font-semibold text-violet-200 leading-snug">
          {formatInlineText(trimmed.slice(5))}
        </h4>
      )
      i++
      continue
    }

    // 4. Blockquotes
    if (isBlockquote(line)) {
      const quoteLines: string[] = []
      while (i < rawLines.length && isBlockquote(rawLines[i])) {
        quoteLines.push(rawLines[i].trim().replace(/^>\s*/, ''))
        i++
      }
      elements.push(
        <blockquote
          key={`quote-${baseIndex}-${blockIdx++}`}
          className="my-2.5 border-l-2 border-violet-400/50 pl-3.5 italic text-neutral-300 text-[14.5px] leading-relaxed"
        >
          {quoteLines.map((ql, qIdx) => (
            <React.Fragment key={`ql-${qIdx}`}>
              {qIdx > 0 && <br />}
              {formatInlineText(ql)}
            </React.Fragment>
          ))}
        </blockquote>
      )
      continue
    }

    // 5. Table
    if (isTableStart(rawLines, i)) {
      const tableLines: string[] = []
      while (i < rawLines.length && rawLines[i].trim().includes('|')) {
        tableLines.push(rawLines[i])
        i++
      }
      const tableData = parseTable(tableLines)
      if (tableData) {
        elements.push(
          <div key={`table-${baseIndex}-${blockIdx++}`} className="my-3 overflow-x-auto rounded-lg border border-white/[0.08]">
            <table className="chat-table min-w-full text-left text-sm text-[#ede8f5]">
              <thead className="bg-white/[0.04] text-xs font-semibold text-violet-200 border-b border-white/[0.08]">
                <tr>
                  {tableData.headers.map((h, hIdx) => (
                    <th key={`th-${hIdx}`} className="px-3 py-2 font-semibold">
                      {formatInlineText(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {tableData.rows.map((row, rIdx) => (
                  <tr key={`tr-${rIdx}`}>
                    {row.map((cell, cIdx) => (
                      <td key={`td-${cIdx}`} className="px-3 py-2 text-[14px]">
                        {formatInlineText(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
        continue
      }
    }

    // 6. Bullet List (Supports -, *, +, and unicode • bullets)
    if (isBulletItem(line)) {
      const items: string[] = []
      while (i < rawLines.length && isBulletItem(rawLines[i])) {
        items.push(stripBullet(rawLines[i]))
        i++
      }
      elements.push(
        <ul
          key={`ul-${baseIndex}-${blockIdx++}`}
          className="chat-list chat-list--bullet my-2 space-y-1 pl-5 list-disc text-neutral-200"
        >
          {items.map((item, itIdx) => (
            <li key={`li-${itIdx}`} className="text-[15px] leading-[1.58] text-[#ede8f5]">
              {formatInlineText(item)}
            </li>
          ))}
        </ul>
      )
      continue
    }

    // 7. Numbered List
    if (isNumberedItem(line)) {
      const items: string[] = []
      while (i < rawLines.length && isNumberedItem(rawLines[i])) {
        items.push(stripNumber(rawLines[i]))
        i++
      }
      elements.push(
        <ol
          key={`ol-${baseIndex}-${blockIdx++}`}
          className="chat-list chat-list--number my-2 space-y-1 pl-5 list-decimal text-neutral-200"
        >
          {items.map((item, itIdx) => (
            <li key={`oli-${itIdx}`} className="text-[15px] leading-[1.58] text-[#ede8f5]">
              {formatInlineText(item)}
            </li>
          ))}
        </ol>
      )
      continue
    }

    // 8. Normal Paragraph (accumulate contiguous lines until next block)
    const pLines: string[] = []
    while (
      i < rawLines.length &&
      rawLines[i].trim().length > 0 &&
      !isBulletItem(rawLines[i]) &&
      !isNumberedItem(rawLines[i]) &&
      !isBlockquote(rawLines[i]) &&
      !isTableStart(rawLines, i) &&
      !rawLines[i].trim().startsWith('#') &&
      !/^(?:---+|\*\*\*+|___+)$/.test(rawLines[i].trim())
    ) {
      pLines.push(rawLines[i])
      i++
    }

    if (pLines.length > 0) {
      elements.push(
        <p key={`p-${baseIndex}-${blockIdx++}`} className="chat-paragraph my-1.5 text-[15px] leading-[1.62] text-[#ede8f5] overflow-wrap-anywhere">
          {pLines.map((pl, plIdx) => (
            <React.Fragment key={`pl-${plIdx}`}>
              {plIdx > 0 && <br />}
              {formatInlineText(pl)}
            </React.Fragment>
          ))}
        </p>
      )
    }
  }

  return <React.Fragment key={`chunk-${baseIndex}`}>{elements}</React.Fragment>
}

export const FormattedMessage: React.FC<FormattedMessageProps> = ({ content }) => {
  if (!content) return null

  // Split by fenced code blocks first
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g
  const blocks: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textChunk = content.slice(lastIndex, match.index)
      blocks.push(renderTextChunk(textChunk, lastIndex))
    }

    const language = match[1]?.trim()
    const code = match[2]
    blocks.push(
      <CodeBlock key={`code-${match.index}`} code={code} language={language} />
    )

    lastIndex = codeBlockRegex.lastIndex
  }

  if (lastIndex < content.length) {
    const textChunk = content.slice(lastIndex)
    blocks.push(renderTextChunk(textChunk, lastIndex))
  }

  return (
    <div className="chat-formatted-message text-[15px] leading-[1.62] text-[#ede8f5]">
      {blocks}
    </div>
  )
}
