/**
 * Container-scoped flip — the one thing native CSS Anchor Positioning can't do.
 *
 * `position-try-fallbacks` (the CSS `flip` feature) is evaluated against the
 * **viewport**, never an inner `overflow: auto` scroll container. So a floating
 * element inside a scrollable panel won't flip as that panel scrolls — the CSS
 * engine simply doesn't look at an inner scrollport.
 *
 * This module is the opt-in escape hatch: given the live rects of the anchor,
 * the floating element and a boundary, it decides which placement best fits
 * inside that boundary. It's pure geometry — no DOM, no React — so it's trivial
 * to test and reuse. The React glue ({@link useAnchor}'s `boundary` option) only
 * wires it to scroll/resize events and feeds the result back as the placement.
 *
 * The default, boundary-less path stays 100% CSS with zero positioning JS.
 */

import type { Placement, Side } from './core'

const OPPOSITE: Record<Side, Side> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
}

/** Flip a placement to the opposite side, preserving any `-start` / `-end` align. */
export function oppositePlacement(placement: Placement): Placement {
  const dash = placement.indexOf('-')
  if (dash === -1) return OPPOSITE[placement as Side]
  const side = placement.slice(0, dash) as Side
  const align = placement.slice(dash + 1)
  return `${OPPOSITE[side]}-${align}` as Placement
}

/** A rectangle, in the same coordinate space (e.g. all from `getBoundingClientRect`). */
export interface Rect {
  top: number
  bottom: number
  left: number
  right: number
}

/** The floating element's measured size. */
export interface Size {
  width: number
  height: number
}

/**
 * Decide the placement that best fits inside `boundary`.
 *
 * Returns the requested `placement` when the preferred side fits (or when the
 * opposite side wouldn't fit any better — never flip into a worse spot). Only
 * flips when the preferred side overflows the boundary **and** the opposite side
 * has room. Pure function: same inputs → same output.
 *
 * @param offset gap (px) between anchor and floating, matching `AnchorOptions.offset`.
 */
export function resolveFlip(
  placement: Placement,
  anchor: Rect,
  floating: Size,
  boundary: Rect,
  offset = 0,
): Placement {
  const dash = placement.indexOf('-')
  const side = (dash === -1 ? placement : placement.slice(0, dash)) as Side
  const blockAxis = side === 'top' || side === 'bottom'

  let preferred: number
  let opposite: number
  let need: number

  if (blockAxis) {
    need = floating.height + offset
    const spaceBelow = boundary.bottom - anchor.bottom
    const spaceAbove = anchor.top - boundary.top
    preferred = side === 'bottom' ? spaceBelow : spaceAbove
    opposite = side === 'bottom' ? spaceAbove : spaceBelow
  } else {
    need = floating.width + offset
    const spaceRight = boundary.right - anchor.right
    const spaceLeft = anchor.left - boundary.left
    preferred = side === 'right' ? spaceRight : spaceLeft
    opposite = side === 'right' ? spaceLeft : spaceRight
  }

  if (preferred < need && opposite > preferred) return oppositePlacement(placement)
  return placement
}
