import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAnchor } from 'css-anchor-kit'

/**
 * Live flip-on-overflow demo.
 *
 * `flip` (`position-try-fallbacks`) is judged against the **viewport**, so to see
 * it fire we move the anchor toward the viewport's bottom edge with a slider.
 * The anchor is `position: fixed`, so the floating element's containing block is
 * the viewport — exactly the condition under which the CSS engine flips. Near the
 * bottom there's no room below, so the engine swaps to the opposite side.
 *
 * (Scrolling an element inside a small scroll frame can't trigger flip — the
 * engine never looks at an inner scrollport. The viewport is the rule.)
 */
export function FlipDemo() {
  const [active, setActive] = useState(false)
  const [y, setY] = useState(50) // anchor top, % of viewport height
  const [flipped, setFlipped] = useState(false)

  const { anchorProps, floatingProps } = useAnchor({
    placement: 'bottom',
    offset: 8,
    flip: true,
    strategy: 'fixed',
  })

  const anchorRef = useRef<HTMLButtonElement>(null)
  const floatRef = useRef<HTMLDivElement>(null)

  // Measure whether the floating box currently renders above the anchor.
  useLayoutEffect(() => {
    if (!active) return
    const a = anchorRef.current?.getBoundingClientRect()
    const f = floatRef.current?.getBoundingClientRect()
    if (a && f) setFlipped(f.bottom <= a.top + 2)
  }, [active, y])

  // Re-measure after the engine settles (anchor() resolves post-layout).
  useEffect(() => {
    if (!active) return
    const id = requestAnimationFrame(() => {
      const a = anchorRef.current?.getBoundingClientRect()
      const f = floatRef.current?.getBoundingClientRect()
      if (a && f) setFlipped(f.bottom <= a.top + 2)
    })
    return () => cancelAnimationFrame(id)
  }, [active, y])

  return (
    <div className="flip-demo">
      <div className="flip-demo-head">
        <div>
          <strong>flip on overflow — live</strong>
          <p className="pg-note" style={{ textAlign: 'left', margin: '0.25rem 0 0' }}>
            Slide the anchor toward the bottom of your viewport. When{' '}
            <code>placement: 'bottom'</code> no longer fits, the engine flips it
            above — no JS, just <code>position-try-fallbacks</code>.
          </p>
        </div>
        <button className="btn-ghost" onClick={() => setActive((v) => !v)}>
          {active ? '✕ stop' : '▶ run demo'}
        </button>
      </div>

      {active && (
        <>
          <label className="flip-demo-slider">
            anchor position · {y}% of viewport
            <input
              type="range"
              min={10}
              max={94}
              value={y}
              onChange={(e) => setY(Number(e.target.value))}
            />
          </label>

          <div className={`flip-badge ${flipped ? 'is-flipped' : ''}`}>
            placement <code>bottom</code> →{' '}
            <strong>{flipped ? 'FLIPPED above ↑' : 'rendering below ↓'}</strong>
          </div>

          {/* Fixed to the viewport so the engine flips against the real edge. */}
          <button
            {...anchorProps}
            ref={anchorRef}
            className="flip-anchor"
            style={{ ...anchorProps.style, position: 'fixed', top: `${y}vh`, left: '50%' }}
          >
            ⚓ anchor (drag the slider)
          </button>
          <div {...floatingProps} ref={floatRef} className="flip-float">
            I flip when there&apos;s no room below
          </div>
        </>
      )}
    </div>
  )
}
