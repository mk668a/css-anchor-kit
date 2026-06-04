import { useEffect, useRef, useState } from 'react'
import { useAnchor, type Placement } from 'css-anchor-kit'
import type { AnchorOptions } from 'css-anchor-kit'
import { CodeBlock } from '../components/CodeBlock'

const PLACEMENTS: Placement[] = [
  'top', 'top-start', 'top-end',
  'bottom', 'bottom-start', 'bottom-end',
  'left', 'left-start', 'left-end',
  'right', 'right-start', 'right-end',
]

type SizeOpt = 'none' | 'width' | 'height' | 'both'
type Strategy = 'fixed' | 'absolute'
type Surface = 'light' | 'dark' | 'brand'

const SIZE_MAP: Record<SizeOpt, AnchorOptions['size']> = {
  none: false,
  width: 'width',
  height: 'height',
  both: true,
}

const ARROW_CLASS: Record<string, string> = {
  top: 'arrow-down',
  bottom: 'arrow-up',
  left: 'arrow-left',
  right: 'arrow-right',
}

function genCode(o: {
  placement: Placement
  offset: number
  flip: boolean
  boundaryFlip: boolean
  hide: boolean
  size: SizeOpt
  strategy: Strategy
  showArrow: boolean
  arrowShift: number
  blockAxis: boolean
}): string {
  const opts = [`placement: '${o.placement}'`]
  if (o.offset) opts.push(`offset: ${o.offset}`)
  if (!o.flip) opts.push('flip: false')
  if (o.flip && o.boundaryFlip) opts.push('boundary: scrollRef // flip within the frame')
  if (o.hide) opts.push('hide: true')
  if (o.size !== 'none') opts.push(`size: ${o.size === 'both' ? 'true' : `'${o.size}'`}`)
  if (o.strategy !== 'fixed') opts.push(`strategy: '${o.strategy}'`)
  const destruct = o.showArrow
    ? 'anchorProps, floatingProps, arrowProps'
    : 'anchorProps, floatingProps'
  // The arrow stays anchor-centered by default; slide it along the edge with a
  // plain `translate` on your own arrow element.
  const slide = o.arrowShift
    ? ` style={{ translate: '${o.blockAxis ? `${o.arrowShift}px 0` : `0 ${o.arrowShift}px`}' }}`
    : ''
  const arrowLine = o.showArrow
    ? `\n  <div {...arrowProps}${slide} className="arrow" />`
    : ''
  return `const { ${destruct} } = useAnchor({
  ${opts.join(',\n  ')},
})

<>
  <button {...anchorProps}>anchor</button>${arrowLine}
  <div {...floatingProps}>floating</div>
</>`
}

/**
 * Storybook-style playground: every {@link useAnchor} option is a live control,
 * the canvas reflects it instantly, and the code block below regenerates to
 * match — copy it straight into your app.
 */
export function InteractivePlayground() {
  const [placement, setPlacement] = useState<Placement>('top')
  const [offset, setOffset] = useState(10)
  const [flip, setFlip] = useState(true)
  const [boundaryFlip, setBoundaryFlip] = useState(true)
  const [hide, setHide] = useState(false)
  const [size, setSize] = useState<SizeOpt>('none')
  const [strategy, setStrategy] = useState<Strategy>('absolute')
  const [showArrow, setShowArrow] = useState(true)
  const [arrowShift, setArrowShift] = useState(0)
  const [surface, setSurface] = useState<Surface>('light')

  const stageRef = useRef<HTMLDivElement>(null)

  const { anchorProps, floatingProps, arrowProps, placement: effPlacement } = useAnchor({
    placement,
    offset,
    flip,
    hide,
    size: SIZE_MAP[size],
    strategy,
    // Opt-in container flip: when on, the kit flips against this scroll frame
    // (not the viewport) — the thing native CSS can't do.
    boundary: boundaryFlip ? stageRef : null,
  })

  useEffect(() => {
    // Centre the canvas on both axes so the anchor starts mid-frame.
    const el = stageRef.current
    if (el) {
      el.scrollTop = (el.scrollHeight - el.clientHeight) / 2
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
    }
  }, [])

  // The arrow + canvas follow the *effective* placement (boundary flip may have
  // swapped it); the generated code shows the *requested* placement.
  const liveSide = effPlacement.split('-')[0]
  const liveBlockAxis = liveSide === 'top' || liveSide === 'bottom'
  // Slide the arrow along the anchor's edge. Uses the `translate` property (not
  // `transform`) so it composes cleanly with the arrow's 45° rotate + tuck.
  const arrowSlide = liveBlockAxis
    ? `${arrowShift}px 0`
    : `0 ${arrowShift}px`
  const reqSide = placement.split('-')[0]
  const code = genCode({
    placement, offset, flip, boundaryFlip, hide, size, strategy, showArrow, arrowShift,
    blockAxis: reqSide === 'top' || reqSide === 'bottom',
  })

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
          offset · {offset}px
          <input type="range" min={0} max={32} value={offset}
            onChange={(e) => setOffset(Number(e.target.value))} />
        </label>

        <label>
          size (anchor-size)
          <select value={size} onChange={(e) => setSize(e.target.value as SizeOpt)}>
            <option value="none">none</option>
            <option value="width">width</option>
            <option value="height">height</option>
            <option value="both">both</option>
          </select>
        </label>

        <label>
          strategy
          <select value={strategy} onChange={(e) => setStrategy(e.target.value as Strategy)}>
            <option value="absolute">absolute</option>
            <option value="fixed">fixed</option>
          </select>
        </label>

        <label>
          surface
          <select value={surface} onChange={(e) => setSurface(e.target.value as Surface)}>
            <option value="light">light</option>
            <option value="dark">dark</option>
            <option value="brand">brand</option>
          </select>
        </label>

        <label className="check">
          <input type="checkbox" checked={showArrow}
            onChange={(e) => setShowArrow(e.target.checked)} />
          arrow
        </label>

        {showArrow && (
          <label>
            arrow shift · {arrowShift}px
            <input type="range" min={-24} max={24} value={arrowShift}
              onChange={(e) => setArrowShift(Number(e.target.value))} />
          </label>
        )}

        <label className="check">
          <input type="checkbox" checked={flip}
            onChange={(e) => setFlip(e.target.checked)} />
          flip on overflow
        </label>

        <label className="check">
          <input type="checkbox" checked={boundaryFlip} disabled={!flip}
            onChange={(e) => setBoundaryFlip(e.target.checked)} />
          flip within this frame (<code>boundary</code>)
        </label>
        <p className="ctrl-hint">
          <code>boundary</code> on → the kit flips against this scroll frame
          (opt-in JS). Scroll the canvas to an edge and watch the card flip. Off
          → flip falls back to native CSS, judged against the viewport, which a
          contained frame can&apos;t trigger.
        </p>

        <label className="check">
          <input type="checkbox" checked={hide}
            onChange={(e) => setHide(e.target.checked)} />
          hide when anchor scrolls away
        </label>
      </div>

      <div className="pg-canvas">
        <div className="scroll-area" ref={stageRef}>
          <div className={`scroll-inner style-demo ${surface}`}>
            <button {...anchorProps} className="btn">
              anchor
            </button>
            {showArrow && (
              <div
                {...arrowProps}
                className={`arrow ${ARROW_CLASS[liveSide]}`}
                style={{ ...arrowProps.style, translate: arrowSlide }}
                aria-hidden
              />
            )}
            <div {...floatingProps} className="pg-card">
              floating
            </div>
          </div>
        </div>
        <p className="pg-note">
          Scroll the canvas (both axes) to move the anchor. With{' '}
          <code>boundary</code> on, the card <strong>flips at this frame&apos;s
          edge</strong>; toggle <code>hide</code> to fade it as the anchor leaves.
        </p>
      </div>

      <div className="pg-code">
        <CodeBlock code={code} />
      </div>
    </div>
  )
}
