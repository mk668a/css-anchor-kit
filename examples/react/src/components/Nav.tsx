const REPO = 'https://github.com/mk668a/css-anchor-kit'

export function Nav() {
  return (
    <nav className="nav">
      <a className="brand" href="#top">
        <span className="brand-mark" aria-hidden>
          ⚓
        </span>
        css-anchor-kit
        <span className="badge">v1.0.0</span>
      </a>
      <div className="nav-links">
        <a href="#quick-start">Docs</a>
        <a href="#api">API</a>
        <a href="https://www.npmjs.com/package/css-anchor-kit" target="_blank" rel="noreferrer">
          npm
        </a>
        <a className="nav-cta" href={REPO} target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
      </div>
    </nav>
  )
}
