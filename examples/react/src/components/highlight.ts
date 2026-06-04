/**
 * Tiny zero-dependency syntax highlighter for the docs code blocks.
 *
 * Tokenises TS/TSX/JS and bash into `{ text, cls }` spans with a single named-
 * group regex. Not a full parser — just enough to colour comments, strings,
 * keywords, types, JSX tags and calls. Keeps the docs build dependency-free.
 */

export interface Token {
  text: string
  cls: string
}

const CLASS_OF: Record<string, string> = {
  comment: 'tok-comment',
  string: 'tok-string',
  tag: 'tok-tag',
  number: 'tok-number',
  keyword: 'tok-keyword',
  type: 'tok-type',
  fn: 'tok-fn',
  prop: 'tok-prop',
  flag: 'tok-flag',
}

const TS_RE = new RegExp(
  [
    /(?<comment>\/\/[^\n]*|\/\*[\s\S]*?\*\/)/,
    /(?<string>`(?:\\[\s\S]|\$\{[^}]*\}|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/,
    /(?<tag>(?<=<\/?)[A-Za-z][\w.]*)/,
    /(?<number>\b\d+(?:\.\d+)?\b)/,
    /(?<keyword>\b(?:import|from|export|default|const|let|var|function|return|if|else|await|async|new|true|false|null|undefined|void|type|interface|extends|implements|as|of|in|for|while|do|switch|case|break|continue|class|this|typeof|instanceof|throw|try|catch|finally|yield)\b)/,
    /(?<type>\b[A-Z][A-Za-z0-9_]*\b)/,
    /(?<fn>\b[a-zA-Z_$][\w$]*(?=\())/,
    /(?<prop>\b[a-zA-Z_$][\w$-]*(?=\s*[:=](?!=)))/,
  ]
    .map((r) => r.source)
    .join('|'),
  'g',
)

const BASH_RE = new RegExp(
  [
    /(?<comment>#[^\n]*)/,
    /(?<string>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/,
    /(?<keyword>\b(?:npm|npx|yarn|pnpm|bunx|bun|cd|git|node)\b)/,
    /(?<flag>(?<=\s)-{1,2}[\w-]+)/,
  ]
    .map((r) => r.source)
    .join('|'),
  'g',
)

function tokenize(code: string, re: RegExp): Token[] {
  const out: Token[] = []
  let last = 0
  let m: RegExpExecArray | null
  re.lastIndex = 0
  while ((m = re.exec(code)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++
      continue
    }
    if (m.index > last) out.push({ text: code.slice(last, m.index), cls: '' })
    const groups = m.groups ?? {}
    const key = Object.keys(groups).find((k) => groups[k] !== undefined)
    out.push({ text: m[0], cls: key ? CLASS_OF[key] : '' })
    last = m.index + m[0].length
  }
  if (last < code.length) out.push({ text: code.slice(last), cls: '' })
  return out
}

export function highlight(code: string, lang: string): Token[] {
  return tokenize(code, lang === 'bash' || lang === 'sh' ? BASH_RE : TS_RE)
}
