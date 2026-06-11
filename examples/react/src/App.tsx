import { useState } from 'react'
import { useAnchor } from 'css-anchor-kit'
import { Nav } from './components/Nav'
import { Sidebar, type NavItem } from './components/Sidebar'
import { CodeBlock } from './components/CodeBlock'
import { InteractivePlayground } from './demos/InteractivePlayground'
import { ComponentsPlayground } from './demos/ComponentsPlayground'
import { FlipDemo } from './demos/FlipDemo'
import { FlipFrameDemo } from './demos/FlipFrameDemo'
import { PopoverKitDemo } from './demos/PopoverKitDemo'

const REPO = 'https://github.com/mk668a/css-anchor-kit'

const SECTIONS: NavItem[] = [
  { id: 'how', label: 'How it works' },
  { id: 'playground', label: 'Playground' },
  { id: 'props', label: 'Props' },
  { id: 'quick-start', label: 'Install & quick start' },
  { id: 'components', label: 'Components & popover' },
  { id: 'popover-kit', label: 'Popover · Tooltip · Menu' },
  { id: 'support', label: 'Browser support' },
]

const INSTALL = `npm install css-anchor-kit`

const CORE_CODE = `// No React? Use the pure, framework-agnostic builder from /core.
import { buildAnchorStyles } from 'css-anchor-kit/core'

const { anchor, floating, arrow } = buildAnchorStyles('--menu', {
  placement: 'bottom-start',
  offset: 8,
  flip: true,
})
// Apply the returned style objects however you like (Vue, Svelte, vanilla…).`

const MIGRATION_CODE = `# Codemod rewrites the mechanical 80% of a floating-ui setup.
npx css-anchor-kit migrate src/`

const POPOVER_KIT_CODE = `import { Popover, PopoverTrigger, PopoverContent } from 'css-anchor-kit'

<Popover placement="bottom-start" offset={10}>
  <PopoverTrigger className="btn">Open</PopoverTrigger>
  <PopoverContent className="card">
    Click outside or press Esc — the browser closes it.
  </PopoverContent>
</Popover>

// Same engine, two more flavors:
<Tooltip openDelay={150}>…</Tooltip>   // hover/focus, role="tooltip"
<Menu>…<MenuItem onClick={…} />…</Menu> // role="menu", arrow-key navigation`

const SUPPORT_CODE = `import { isAnchorPositioningSupported } from 'css-anchor-kit/core'

if (!isAnchorPositioningSupported()) {
  // BYO polyfill — not bundled:
  await import('@oddbird/css-anchor-positioning/fn')
}`

function Hero() {
  const [tip, setTip] = useState(false)
  const { anchorProps, floatingProps, arrowProps } = useAnchor({
    placement: 'bottom',
    offset: 10,
  })
  return (
    <header className="hero" id="top">
      <p className="eyebrow">React · CSS Anchor Positioning</p>
      <h1>
        Floating UI ergonomics,
        <br />
        <span className="grad">zero runtime positioning JS.</span>
      </h1>
      <p className="lede">
        Tooltips, popovers, menus and dropdowns positioned by the browser via
        native <code>anchor-name</code> / <code>anchor()</code> — a familiar{' '}
        <code>{'{ placement, offset, flip }'}</code> API, no measurement loop, no
        reflow.
      </p>

      <div className="hero-cta">
        <a className="btn-primary" href="#playground">
          Try the playground
        </a>
        <button
          {...anchorProps}
          className="btn-ghost"
          onMouseEnter={() => setTip(true)}
          onMouseLeave={() => setTip(false)}
          onFocus={() => setTip(true)}
          onBlur={() => setTip(false)}
        >
          ⌘ Live demo — hover me
        </button>
        {tip && (
          <>
            <div {...arrowProps} className="arrow arrow-up" aria-hidden />
            <div {...floatingProps} className="tooltip hero-tip">
              this badge is positioned by css-anchor-kit ✨
            </div>
          </>
        )}
      </div>

      <div className="hero-install">
        <CodeBlock code={INSTALL} lang="bash" />
      </div>
    </header>
  )
}

export function App() {
  const { supported } = useAnchor()

  return (
    <div className="site">
      <Nav />
      <Hero />

      {!supported && (
        <div className="support-banner" role="alert">
          Your browser doesn&apos;t support CSS Anchor Positioning yet — the live
          previews below need the{' '}
          <code>@oddbird/css-anchor-positioning</code> polyfill (BYO) to position
          correctly. Chromium 125+ works out of the box.
        </div>
      )}

      <div className="docs">
        <Sidebar items={SECTIONS} />

        <main className="content">
          {/* ---------- PRIMARY: explainer ---------- */}
          <section id="how">
            <h2>How it works</h2>
            <p>
              Libraries like floating-ui keep a JavaScript loop measuring the DOM
              every frame — <code>getBoundingClientRect()</code> the anchor,
              measure the floating element, compute a position, then re-run it on
              every scroll and resize.{' '}
              <strong>css-anchor-kit emits zero such JS.</strong> CSS Anchor
              Positioning moves all of that into the browser&apos;s layout engine,
              so the kit just compiles your config to inline CSS:
            </p>
            <ul className="checks">
              <li>No <code>requestAnimationFrame</code> measurement loop.</li>
              <li>No reflow on scroll or resize — the compositor handles it.</li>
              <li>
                Renders in the top layer, so it pairs with the native Popover API
                and <code>&lt;dialog&gt;</code> and never fights{' '}
                <code>z-index</code> or <code>overflow: hidden</code> clipping.
              </li>
            </ul>
            <p>
              Every <code>useAnchor</code> option is a thin translation to one
              native CSS primitive. There is nothing to measure because the engine
              already knows where the anchor is:
            </p>
            <div className="table-wrap">
              <table className="api-table">
                <thead>
                  <tr><th>What you want</th><th>The CSS primitive</th><th>What the engine does</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Name an element as a reference</td>
                    <td><code>anchor-name: --x</code></td>
                    <td>Registers the element so others can point at it</td>
                  </tr>
                  <tr>
                    <td>Pin to that reference</td>
                    <td><code>position-anchor</code> + <code>top: anchor(bottom)</code></td>
                    <td>Resolves the anchor&apos;s live edge — re-evaluated on scroll/resize by the compositor, no reflow</td>
                  </tr>
                  <tr>
                    <td>Flip when it would overflow</td>
                    <td><code>position-try-fallbacks: flip-block</code></td>
                    <td>Tries the preferred side, falls back to the opposite if it overflows the viewport</td>
                  </tr>
                  <tr>
                    <td>Hide when the anchor scrolls away</td>
                    <td><code>position-visibility: anchors-visible</code></td>
                    <td>Toggles visibility as the anchor crosses the scrollport</td>
                  </tr>
                  <tr>
                    <td>Match the anchor&apos;s size</td>
                    <td><code>width: anchor-size(width)</code></td>
                    <td>Reads the anchor&apos;s box dimensions directly</td>
                  </tr>
                  <tr>
                    <td>Follow writing direction (RTL)</td>
                    <td><code>inset-inline-start: anchor(start)</code></td>
                    <td>Logical insets resolve per <code>dir</code> — no JS branching</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>Framework-agnostic core</h3>
            <p>
              The positioning logic is a pure function with no React dependency.
              Import <code>buildAnchorStyles</code> from{' '}
              <code>css-anchor-kit/core</code> and apply the returned style objects
              in any framework — Vue, Svelte, or vanilla JS. RTL is handled here
              too: it pins <em>logical</em> insets, so <code>-start</code>/
              <code>-end</code> follow the writing direction.
            </p>
            <CodeBlock code={CORE_CODE} lang="ts" />

            <p className="hint">
              The one thing native CSS can&apos;t do: <code>flip</code> is judged
              against the <strong>viewport</strong>, not an inner{' '}
              <code>overflow: auto</code> frame. For a framed flip boundary, pass
              the opt-in <code>boundary</code> option (a tiny scroll listener — see
              the Playground) or use an <code>&lt;iframe&gt;</code>. Everything
              else stays pure CSS, zero positioning JS.
            </p>
          </section>

          {/* ---------- PRIMARY: Storybook-style playground ---------- */}
          <section id="playground">
            <h2>Playground</h2>
            <p>
              Every <code>useAnchor</code> option is a live control. The canvas
              updates instantly and the code below regenerates to match — tweak
              it, then copy it straight into your app.
            </p>
            <InteractivePlayground />

            <h3>Flip, three ways</h3>
            <p>
              The canvas above already flips <strong>inside its frame</strong>:
              that&apos;s the opt-in <code>boundary</code> option (a tiny
              scroll/resize listener) doing the one thing native CSS can&apos;t.
              If you&apos;d rather stay 100% CSS with zero positioning JS, there
              are two pure-CSS flip boundaries too.
            </p>
            <h4>Pure CSS · inside a frame — via an <code>&lt;iframe&gt;</code></h4>
            <p>
              An <code>&lt;iframe&gt;</code> has its own viewport, so the kit&apos;s
              CSS flips natively at the frame&apos;s edge as you scroll inside it —
              no <code>boundary</code> listener needed.
            </p>
            <FlipFrameDemo />
            <h4>Pure CSS · against the page viewport</h4>
            <p>
              Drive the real viewport edge directly — slide the anchor toward the
              bottom of your screen and watch it flip above:
            </p>
            <FlipDemo />
          </section>

          {/* ---------- PRIMARY: Props reference ---------- */}
          <section id="props">
            <h2>Props</h2>
            <p>
              <code>useAnchor(options)</code> takes a floating-ui-style options
              object and returns prop bundles to spread. Each option compiles to a
              native CSS Anchor Positioning feature — there is no JS measurement.
            </p>

            <h3>Options</h3>
            <div className="table-wrap">
              <table className="api-table">
                <thead>
                  <tr><th>Option</th><th>Type</th><th>Default</th><th>Compiles to</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>placement</code></td>
                    <td><code>'top' | 'bottom' | 'left' | 'right'</code> (+ <code>-start</code>/<code>-end</code>)</td>
                    <td><code>'bottom'</code></td>
                    <td><code>anchor()</code> insets</td>
                  </tr>
                  <tr>
                    <td><code>offset</code></td>
                    <td><code>number</code> (px)</td>
                    <td><code>0</code></td>
                    <td><code>margin</code></td>
                  </tr>
                  <tr>
                    <td><code>flip</code></td>
                    <td><code>boolean</code></td>
                    <td><code>true</code></td>
                    <td><code>position-try-fallbacks</code></td>
                  </tr>
                  <tr>
                    <td><code>hide</code></td>
                    <td><code>boolean</code></td>
                    <td><code>false</code></td>
                    <td><code>position-visibility: anchors-visible</code></td>
                  </tr>
                  <tr>
                    <td><code>size</code></td>
                    <td><code>boolean | 'width' | 'height'</code></td>
                    <td><code>false</code></td>
                    <td><code>anchor-size()</code></td>
                  </tr>
                  <tr>
                    <td><code>strategy</code></td>
                    <td><code>'fixed' | 'absolute'</code></td>
                    <td><code>'fixed'</code></td>
                    <td><code>position</code></td>
                  </tr>
                  <tr>
                    <td><code>boundary</code></td>
                    <td><code>Element | RefObject</code></td>
                    <td><code>—</code></td>
                    <td>opt-in JS flip inside a scroll frame</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="hint">
              <code>boundary</code> is the one option that isn&apos;t pure CSS:
              native <code>flip</code> only reacts to the viewport, so to flip
              inside an inner <code>overflow: auto</code> container you pass that
              container and the kit adds a tiny scroll/resize listener. Everything
              else compiles to CSS with zero positioning JS.
            </p>

            <h3>Returns</h3>
            <div className="table-wrap">
              <table className="api-table">
                <thead>
                  <tr><th>Field</th><th>Spread onto</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  <tr><td><code>anchorProps</code></td><td>the reference element</td><td>sets <code>anchor-name</code></td></tr>
                  <tr><td><code>floatingProps</code></td><td>the positioned element</td><td>sets <code>position</code> + insets</td></tr>
                  <tr><td><code>arrowProps</code></td><td>an optional arrow</td><td>omit it for no arrow</td></tr>
                  <tr><td><code>placement</code></td><td>—</td><td>the placement in effect (a <code>boundary</code> may have flipped it)</td></tr>
                  <tr><td><code>anchorName</code></td><td>—</td><td>the generated dashed-ident, for manual CSS</td></tr>
                  <tr><td><code>supported</code></td><td>—</td><td>feature-detect; <code>false</code> during SSR / first render</td></tr>
                </tbody>
              </table>
            </div>
            <p className="hint">
              Styling is entirely yours — the kit injects only positioning
              properties, so your <code>className</code> / <code>style</code> on
              the floating element always win on color, padding, radius, etc.
            </p>
          </section>

          {/* ---------- supplementary ---------- */}
          <section id="quick-start">
            <h2>Install &amp; quick start</h2>
            <CodeBlock code={INSTALL} lang="bash" />
            <p>
              Call <code>useAnchor</code> and spread the returned props — it&apos;s
              headless, so you own visibility (hover/focus/<code>popover</code>)
              and styling; it only computes position. The{' '}
              <a href="#playground">Playground</a> above is the fastest way to find
              the config you want and copy it out.
            </p>

            <h3>Migrating from floating-ui?</h3>
            <p>
              A jscodeshift codemod rewrites the mechanical bulk of a floating-ui
              setup and flags the rest. Dev-time CLI only — never in your bundle.
            </p>
            <CodeBlock code={MIGRATION_CODE} lang="bash" />
          </section>

          <section id="components">
            <h2>Components &amp; native popover</h2>
            <p>
              Optional sugar over the hook. <code>&lt;Anchored&gt;</code> runs it
              and shares the result via context; <code>&lt;Anchor&gt;</code>,{' '}
              <code>&lt;Floating&gt;</code> and <code>&lt;Arrow&gt;</code> are
              polymorphic slots. Tweak the knobs — it pairs with the native
              Popover API and the menu&apos;s width can track its trigger.
            </p>
            <ComponentsPlayground />
          </section>

          <section id="popover-kit">
            <h2>Popover · Tooltip · Menu</h2>
            <p>
              <code>useAnchor</code> answers <em>where</em>; these components
              answer <em>when</em> — and outsource that to the platform too, via
              the native Popover API. Top layer, light dismiss, Escape and focus
              restore all come from the browser. Still headless: every prop
              forwarded, styling is yours.
            </p>
            <PopoverKitDemo />
            <CodeBlock code={POPOVER_KIT_CODE} lang="tsx" />
            <p className="hint">
              All three roots take the same options as <code>useAnchor</code>{' '}
              (<code>placement</code>, <code>offset</code>, <code>flip</code>,{' '}
              <code>size</code>…). State is uncontrolled by default — pass{' '}
              <code>open</code> + <code>onOpenChange</code> to control it; light
              dismiss and Escape report through <code>onOpenChange</code> like
              any other close.
            </p>
          </section>

          <section id="support">
            <h2>Browser support</h2>
            <p>
              CSS Anchor Positioning ships in Chromium 125+. Elsewhere,
              feature-detect and lazy-load the OddBird polyfill (BYO — not bundled,
              so it never weighs down supporting browsers).
            </p>
            <CodeBlock code={SUPPORT_CODE} lang="ts" />
          </section>
        </main>
      </div>

      <footer className="site-footer">
        <div>
          <strong>css-anchor-kit</strong> · MIT · positioned by the browser, not
          a JS loop.
        </div>
        <a href={REPO} target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
      </footer>
    </div>
  )
}
