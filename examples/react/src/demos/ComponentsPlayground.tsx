import { useState } from 'react'
import { Anchored, Anchor, Floating, Arrow, type Placement } from 'css-anchor-kit'
import { CodeBlock } from '../components/CodeBlock'

const PLACEMENTS: Placement[] = [
  'bottom-start', 'bottom', 'bottom-end',
  'top-start', 'top', 'top-end',
  'right-start', 'left-start',
]

type SizeOpt = 'none' | 'width'

function genCode(o: { placement: Placement; size: SizeOpt; arrow: boolean }): string {
  const attrs = [`placement="${o.placement}"`, 'offset={10}', 'flip={false}']
  if (o.size === 'width') attrs.push('size="width"')
  const arrowLine = o.arrow ? '\n    <Arrow as="li" className="arrow arrow-up" />' : ''
  return `import { Anchored, Anchor, Floating${o.arrow ? ', Arrow' : ''} } from 'css-anchor-kit'

<Anchored ${attrs.join(' ')}>
  <Anchor as="button" popoverTarget="menu">Open menu ▾</Anchor>
  <Floating as="ul" id="menu" popover="auto">${arrowLine}
    <li>Profile</li>
    <li>Settings</li>
    <li>Sign out</li>
  </Floating>
</Anchored>`
}

/**
 * Storybook-style playground for the component API (Anchored/Anchor/Floating/
 * Arrow). Same knobs idea as the hook playground, but driving the JSX sugar.
 */
export function ComponentsPlayground() {
  const [placement, setPlacement] = useState<Placement>('bottom-start')
  const [size, setSize] = useState<SizeOpt>('width')
  const [arrow, setArrow] = useState(false)
  const [open, setOpen] = useState(true)

  const side = placement.split('-')[0]
  // Named for the direction the arrow points, i.e. the side opposite the
  // placement — that's what decides which two of its edges stick out.
  const arrowClass =
    side === 'top' ? 'arrow-down' : side === 'bottom' ? 'arrow-up'
    : side === 'left' ? 'arrow-right' : 'arrow-left'

  return (
    <div className="pg">
      <div className="pg-controls">
        <label>
          placement
          <select value={placement} onChange={(e) => setPlacement(e.target.value as Placement)}>
            {PLACEMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>

        <label>
          size (anchor-size)
          <select value={size} onChange={(e) => setSize(e.target.value as SizeOpt)}>
            <option value="none">none</option>
            <option value="width">width (match trigger)</option>
          </select>
        </label>

        <label className="check">
          <input type="checkbox" checked={arrow} onChange={(e) => setArrow(e.target.checked)} />
          arrow
        </label>

        <label className="check">
          <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
          open
        </label>
        <p className="ctrl-hint">
          <code>&lt;Anchored&gt;</code> runs the hook and shares it via context;
          the slots are polymorphic (<code>as</code> + any props pass through).
        </p>
      </div>

      <div className="pg-canvas">
        <div className="scroll-area cmp-stage">
          <div className="scroll-inner" style={{ width: 'auto', height: 'auto' }}>
            {/* flip is off so the chosen placement is what you actually see. A
                native flip is invisible to JS, so the arrow's outline classes —
                which say which two edges of the diamond stick out — would keep
                pointing the old way even though the arrow itself follows the
                menu across. */}
            <Anchored
              placement={placement}
              offset={10}
              flip={false}
              size={size === 'width' ? 'width' : false}
            >
              <Anchor as="button" className="btn" onClick={() => setOpen((v) => !v)}>
                Open menu ▾
              </Anchor>
              {open && (
                <Floating as="ul" className="cmp-menu">
                  {/* `as="li"` keeps the markup valid inside a <ul>. */}
                  {arrow && <Arrow as="li" className={`arrow ${arrowClass}`} aria-hidden />}
                  <li>Profile</li>
                  <li>Settings</li>
                  <li>Sign out</li>
                </Floating>
              )}
            </Anchored>
          </div>
        </div>
        <p className="pg-note">
          The menu&apos;s width tracks the trigger when <code>size="width"</code>.
          Toggle <code>open</code> to mount/unmount it.
        </p>
      </div>

      <div className="pg-code">
        <CodeBlock code={genCode({ placement, size, arrow })} />
      </div>
    </div>
  )
}
