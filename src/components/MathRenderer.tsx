import React, { useMemo } from 'react'
import katex from 'katex'

interface MathRendererProps {
  content: string
  className?: string
  inline?: boolean
}

type Token = 
  | { type: 'block-math'; content: string }
  | { type: 'inline-math'; content: string }
  | { type: 'code-block'; language: string; content: string }
  | { type: 'inline-code'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'text'; content: string }
  | { type: 'newline' }

function parseContent(raw: string): Token[] {
  if (!raw) return []

  const tokens: Token[] = []
  let cursor = 0
  const length = raw.length

  while (cursor < length) {
    // 1. Block Math: $$...$$ or \[...\]
    if (raw.startsWith('$$', cursor)) {
      const end = raw.indexOf('$$', cursor + 2)
      if (end !== -1) {
        const math = raw.substring(cursor + 2, end).trim()
        tokens.push({ type: 'block-math', content: math })
        cursor = end + 2
        continue
      }
    }
    if (raw.startsWith('\\[', cursor)) {
      const end = raw.indexOf('\\]', cursor + 2)
      if (end !== -1) {
        const math = raw.substring(cursor + 2, end).trim()
        tokens.push({ type: 'block-math', content: math })
        cursor = end + 2
        continue
      }
    }

    // 2. Code Block: ```lang ... ```
    if (raw.startsWith('```', cursor)) {
      const end = raw.indexOf('```', cursor + 3)
      if (end !== -1) {
        const fullBlock = raw.substring(cursor + 3, end)
        const firstLineEnd = fullBlock.indexOf('\n')
        let lang = ''
        let code = fullBlock
        if (firstLineEnd !== -1) {
          lang = fullBlock.substring(0, firstLineEnd).trim()
          code = fullBlock.substring(firstLineEnd + 1)
        }
        tokens.push({ type: 'code-block', language: lang, content: code })
        cursor = end + 3
        continue
      }
    }

    // 3. Inline Code: `...`
    if (raw[cursor] === '`') {
      const end = raw.indexOf('`', cursor + 1)
      if (end !== -1) {
        const code = raw.substring(cursor + 1, end)
        tokens.push({ type: 'inline-code', content: code })
        cursor = end + 1
        continue
      }
    }

    // 4. Inline Math: $...$ or \(...\)
    if (raw[cursor] === '$' && raw[cursor + 1] !== '$') {
      const end = raw.indexOf('$', cursor + 1)
      if (end !== -1 && end > cursor + 1) {
        const math = raw.substring(cursor + 1, end)
        tokens.push({ type: 'inline-math', content: math })
        cursor = end + 1
        continue
      }
    }
    if (raw.startsWith('\\(', cursor)) {
      const end = raw.indexOf('\\)', cursor + 2)
      if (end !== -1) {
        const math = raw.substring(cursor + 2, end).trim()
        tokens.push({ type: 'inline-math', content: math })
        cursor = end + 2
        continue
      }
    }

    // 5. Bold: **...**
    if (raw.startsWith('**', cursor)) {
      const end = raw.indexOf('**', cursor + 2)
      if (end !== -1) {
        tokens.push({ type: 'bold', content: raw.substring(cursor + 2, end) })
        cursor = end + 2
        continue
      }
    }

    // 6. Newline
    if (raw[cursor] === '\n') {
      tokens.push({ type: 'newline' })
      cursor++
      continue
    }

    // 7. Regular text
    let nextSpecial = length
    const specials = ['$$', '\\[', '```', '`', '$', '\\(', '**', '\n']
    for (const spec of specials) {
      const idx = raw.indexOf(spec, cursor)
      if (idx !== -1 && idx < nextSpecial) {
        nextSpecial = idx
      }
    }

    const textChunk = raw.substring(cursor, nextSpecial)
    if (textChunk.length > 0) {
      tokens.push({ type: 'text', content: textChunk })
      cursor = nextSpecial
    } else {
      tokens.push({ type: 'text', content: raw[cursor] })
      cursor++
    }
  }

  return tokens
}

export const MathRenderer: React.FC<MathRendererProps> = ({ content, className = '', inline = false }) => {
  const tokens = useMemo(() => parseContent(content), [content])

  return (
    <div className={`leading-relaxed ${inline ? 'inline' : 'space-y-1.5'} ${className}`}>
      {tokens.map((token, index) => {
        switch (token.type) {
          case 'block-math': {
            let html = ''
            try {
              html = katex.renderToString(token.content, {
                displayMode: true,
                throwOnError: false,
                output: 'htmlAndMathml',
              })
            } catch {
              html = `<span class="text-rose-400 font-mono text-xs">[LaTeX Error: ${token.content}]</span>`
            }
            return (
              <div
                key={index}
                className="my-2.5 py-1 px-1 bg-transparent overflow-x-auto text-center"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )
          }

          case 'inline-math': {
            let html = ''
            try {
              html = katex.renderToString(token.content, {
                displayMode: false,
                throwOnError: false,
                output: 'htmlAndMathml',
              })
            } catch {
              html = `<span class="text-rose-400 font-mono text-xs">[LaTeX: ${token.content}]</span>`
            }
            return (
              <span
                key={index}
                className="inline-block mx-0.5 px-0.5 bg-transparent align-middle"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )
          }

          case 'code-block':
            return (
              <pre
                key={index}
                className="p-3 my-2 text-xs md:text-sm bg-slate-950 border border-slate-800 rounded-lg text-emerald-400 font-mono overflow-x-auto"
              >
                <code>{token.content}</code>
              </pre>
            )

          case 'inline-code':
            return (
              <code
                key={index}
                className="px-1.5 py-0.5 mx-0.5 text-xs bg-slate-800 border border-slate-700/60 rounded text-cyan-300 font-mono"
              >
                {token.content}
              </code>
            )

          case 'bold':
            return (
              <strong key={index} className="font-semibold text-white">
                {token.content}
              </strong>
            )

          case 'newline':
            return <div key={index} className="h-1.5" />

          case 'text':
          default:
            return <span key={index}>{token.content}</span>
        }
      })}
    </div>
  )
}

