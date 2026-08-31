/**
 * css-anchor-kit core — framework-agnostic style builder.
 *
 * Turns a floating-ui-style `{ placement, offset, flip, ... }` config into plain
 * CSS style objects that lean entirely on native **CSS Anchor Positioning**
 * (`anchor-name` / `position-anchor` / `anchor()` / `position-try-fallbacks`).
 *
 * No React, no DOM measurement, no `requestAnimationFrame` loop — the browser
 * does the positioning. This module is pure: same input → same output.
 */

export type Side = 'top' | 'bottom' | 'left' | 'right'

/** floating-ui-compatible placement names. */
export type Placement = Side | `${Side}-start` | `${Side}-end`

export type Strategy = 'fixed' | 'absolute'

export interface AnchorOptions {
  /** Where the floating element sits relative to the anchor. Default `'bottom'`. */
  placement?: Placement
  /** Gap between anchor and floating element, in px. Default `0`. */
  offset?: number
  /**
   * Flip to the opposite side when the preferred side overflows.
   * Maps to `position-try-fallbacks`. Default `true`.
   */
  flip?: boolean
  /**
   * Hide the floating element when the anchor is scrolled out of view
   * (maps to `position-visibility: anchors-visible`). Default `false`.
   */
  hide?: boolean
  /**
   * Match the floating element's size to the anchor's, via `anchor-size()`.
   * `'width'` / `'height'` match one axis; `true` matches both. Useful for
   * select/combobox popovers that should be as wide as their trigger.
   * Default `false`.
   */
  size?: boolean | 'width' | 'height'
  /** `position` value for the floating element. Default `'fixed'`. */
  strategy?: Strategy
  /**
   * Emit a **safe area**: a transparent rectangle covering the corridor between
   * the anchor and the floating element, so a pointer travelling diagonally
   * between the two never crosses dead space and never triggers a close.
   *
   * This is the CSS-only counterpart of floating-ui's `safePolygon()`. It is a
   * rectangle, not a cursor-tracked polygon (CSS can't read the pointer), so
   * it's more forgiving: any path through the corridor keeps the pair alive.
   * Default `false`.
   *
   * Render the returned `safeArea` styles on an element **inside** the floating
   * element — see {@link buildAnchorStyles} for why.
   */
  safeArea?: boolean
}

/**
 * A style object that may carry CSS Anchor Positioning properties not yet in
 * the standard `CSSStyleDeclaration` type. Keys are camelCased CSS properties.
 */
export type AnchorStyle = Record<string, string | number>

export interface AnchorStyles {
  /** Spread onto the anchor (reference) element. */
  anchor: AnchorStyle
  /** Spread onto the floating (positioned) element. */
  floating: AnchorStyle
  /** Spread onto an optional arrow element (a sibling of the floating element). */
  arrow: AnchorStyle
  /**
   * Spread onto an optional safe-area element (a **child** of the floating
   * element). `{ display: 'none' }` unless `safeArea` is on.
   */
  safeArea: AnchorStyle
}

type Align = 'start' | 'end' | 'center'

const OPPOSITE: Record<Side, Side> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
}

function parsePlacement(placement: Placement): { side: Side; align: Align } {
  const dash = placement.indexOf('-')
  if (dash === -1) return { side: placement as Side, align: 'center' }
  return {
    side: placement.slice(0, dash) as Side,
    align: placement.slice(dash + 1) as Align,
  }
}

function capitalize<T extends string>(s: T): Capitalize<T> {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<T>
}

/**
 * Logical cross-axis inset property to pin for `start` / `end` aligned
 * placements. Logical (not physical) so `-start` / `-end` follow the writing
 * direction automatically — in RTL, `bottom-start` aligns to the right edge,
 * matching floating-ui's RTL behavior, with zero JS.
 */
function crossInset(blockAxis: boolean, align: 'start' | 'end'): string {
  if (blockAxis) return align === 'start' ? 'insetInlineStart' : 'insetInlineEnd'
  return align === 'start' ? 'insetBlockStart' : 'insetBlockEnd'
}

function flipFallbacks(blockAxis: boolean, align: Align): string {
  const primary = blockAxis ? 'flip-block' : 'flip-inline'
  const secondary = blockAxis ? 'flip-inline' : 'flip-block'
  // Centered placements only overflow on the main axis; aligned placements can
  // also overflow on the cross axis, so offer the perpendicular flip too.
  return align === 'center' ? primary : `${primary}, ${secondary}`
}

/**
 * The corridor between the anchor and the floating element: the gap on the
 * placement's own axis, the union of both boxes on the cross axis. Hovering it
 * counts as "still travelling between the two", which is what floating-ui's
 * `safePolygon()` buys with a `pointermove` listener and a cursor-tracked
 * triangle.
 *
 * Every edge is `min()` of the *same* edge on both anchors. `anchor(--a right)`
 * and `anchor(--f right)` are both distances from the containing block's left
 * edge, so `min()` reads as "whichever box sits further left" — true no matter
 * which side the browser ended up putting the floating element on, so the rect
 * survives a native `flip` without any JS.
 */
function buildSafeArea(anchorName: string, floatingName: string, blockAxis: boolean): AnchorStyle {
  const edge = (side: Side) => `min(anchor(${anchorName} ${side}), anchor(${floatingName} ${side}))`
  return {
    // Always fixed, never `strategy`: the safe area lives *inside* the floating
    // element, and only `fixed` gives it the initial containing block. An
    // absolutely positioned child would be laid out inside the floating box,
    // where the anchor is no longer an acceptable anchor element and every
    // `anchor()` silently falls back to `auto`.
    position: 'fixed',
    // The anchor is also the *default* anchor, which is what the browser's
    // scroll adjustment keys off — without it the rect keeps its layout-time
    // position and drifts by the scroll offset.
    positionAnchor: anchorName,
    margin: '0',
    ...(blockAxis
      ? { top: edge('bottom'), bottom: edge('top'), left: edge('left'), right: edge('right') }
      : { left: edge('right'), right: edge('left'), top: edge('top'), bottom: edge('bottom') }),
  }
}

/**
 * Build anchor / floating / arrow / safe-area style objects for a placement.
 *
 * The arrow is a **sibling** of the floating element; the safe area (opt in
 * with `safeArea`) is a **child** of it, because it references both boxes and a
 * top-layer popover is only an acceptable anchor for another element in the top
 * layer.
 *
 * @param anchorName a CSS dashed-ident, e.g. `'--cak-tooltip'`. Must be unique
 *   per anchor↔floating pair on the page. When `safeArea` is on, the floating
 *   element is named `${anchorName}-floating` so the safe area can span both.
 */
export function buildAnchorStyles(
  anchorName: string,
  options: AnchorOptions = {},
): AnchorStyles {
  const {
    placement = 'bottom',
    offset = 0,
    flip = true,
    hide = false,
    size = false,
    strategy = 'fixed',
    safeArea = false,
  } = options

  const { side, align } = parsePlacement(placement)
  const blockAxis = side === 'top' || side === 'bottom'

  // The floating element's facing edge is the side opposite the placement, and
  // it's pinned to the anchor's `side` edge. e.g. placement 'bottom' →
  // `top: anchor(bottom)`.
  const mainInset = OPPOSITE[side]
  const anchorEdge = `anchor(${side})`

  const anchor: AnchorStyle = { anchorName }

  const floating: AnchorStyle = {
    position: strategy,
    positionAnchor: anchorName,
    margin: '0',
    [mainInset]: anchorEdge,
  }

  // The arrow anchors to the *same* element and stays centered on it, so it keeps
  // pointing at the anchor even when the floating box flips or is aligned.
  const arrow: AnchorStyle = {
    position: strategy,
    positionAnchor: anchorName,
    margin: '0',
    [mainInset]: anchorEdge,
  }

  if (offset) {
    // Apply the gap to BOTH the floating element and the arrow so the arrow
    // tracks the floating element's facing edge. Without this the arrow stays
    // pinned to the anchor and visibly detaches as the offset grows.
    const marginProp = `margin${capitalize(mainInset)}`
    floating[marginProp] = `${offset}px`
    arrow[marginProp] = `${offset}px`
  }

  const selfProp = blockAxis ? 'justifySelf' : 'alignSelf'
  // Arrow is always centered on the anchor.
  arrow[selfProp] = 'anchor-center'

  if (align === 'center') {
    floating[selfProp] = 'anchor-center'
  } else {
    // Pin the matching logical cross-axis edge to the anchor's same edge.
    // `anchor(start)` / `anchor(end)` resolve along the inset property's axis.
    floating[crossInset(blockAxis, align)] = `anchor(${align})`
  }

  if (flip) {
    floating.positionTryFallbacks = flipFallbacks(blockAxis, align)
  }
  if (hide) {
    floating.positionVisibility = 'anchors-visible'
  }
  if (size) {
    if (size === true || size === 'width') floating.width = 'anchor-size(width)'
    if (size === true || size === 'height') floating.height = 'anchor-size(height)'
  }

  // The safe area spans *both* boxes, so the floating element needs a name of
  // its own. Only when asked: an unconditional `anchor-name` here would
  // override one the consumer set in their own CSS.
  const floatingName = `${anchorName}-floating`
  if (safeArea) floating.anchorName = floatingName

  return {
    anchor,
    floating,
    arrow,
    safeArea: safeArea ? buildSafeArea(anchorName, floatingName, blockAxis) : { display: 'none' },
  }
}

/**
 * Feature-detect CSS Anchor Positioning. Returns `false` during SSR (no `CSS`).
 *
 * When this is `false`, either load the
 * [`@oddbird/css-anchor-positioning`](https://github.com/oddbird/css-anchor-positioning)
 * polyfill (BYO — not bundled) or fall back to a JS positioner.
 */
export function isAnchorPositioningSupported(): boolean {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('anchor-name: --x')
  )
}
