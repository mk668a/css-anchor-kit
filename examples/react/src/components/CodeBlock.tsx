import { useState } from 'react'
import { highlight } from './highlight'

/**
 * Minimal code block with a language tag and copy-to-clipboard button.
 * Syntax highlighting comes from a tiny in-repo tokenizer (./highlight) —
 * no external dependency, so the docs build stays dependency-free.
 */
export function CodeBlock({ code, lang = 'tsx' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  const tokens = highlight(code, lang)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard blocked (e.g. insecure context) — ignore */
    }
  }

  return (
    <div className="code">
      <div className="code-head">
        <span className="code-lang">{lang}</span>
        <button className="code-copy" onClick={copy} aria-label="Copy code">
          {copied ? 'copied ✓' : 'copy'}
        </button>
      </div>
      <pre>
        <code>
          {tokens.map((t, i) =>
            t.cls ? (
              <span key={i} className={t.cls}>
                {t.text}
              </span>
            ) : (
              t.text
            ),
          )}
        </code>
      </pre>
    </div>
  )
}
