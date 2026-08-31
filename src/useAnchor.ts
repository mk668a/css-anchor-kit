import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import {
  buildAnchorStyles,
  isAnchorPositioningSupported,
  type AnchorOptions,
  type Placement,
} from './core'
import { resolveFlip } from './flipWithin'
import { warnContainingBlockTrap } from './containingBlock'

/**
 * What to flip within: a scroll container (the element itself, or a ref to it),
 * or the string `'viewport'` to flip against the viewport in JS.
 */
export type Boundary = Element | RefObject<Element | null> | 'viewport' | null

/**
 * A ref callback to spread onto a host element. Intentionally loose (`any` node)
 * so it attaches to a `<button>`, `<div>`, custom component, etc. without fighting
 * each element's specific ref type.
 */
export type AnchorRef = (node: any) => void

export interface UseAnchorOptions extends AnchorOptions {
  /**
   * **Opt-in:** flip in JS instead of leaving it to `position-try-fallbacks`.
   *
   * Pass a **scroll container** (or a ref to it) to flip within *that* box.
   * Native CSS `flip` is judged against the viewport and ignores inner scroll
   * containers, so a floating element won't otherwise flip as a scrollable panel
   * scrolls. The hook adds a small scroll/resize listener that swaps the
   * placement as the anchor nears the boundary's edge.
   *
   * Pass `'viewport'` to flip against the viewport — the same decision CSS would
   * make, but taken in JS, so the hook *knows* about it: the returned
   * `placement` reports the effective side and `arrowProps` moves with the
   * floating element. Use it when you render an arrow **and** want flipping; a
   * CSS flip is invisible to JS, so the arrow would otherwise stay on the side
   * you asked for while the floating box moves to the other one.
   *
   * Either way, spread the returned `ref` onto the anchor and floating elements
   * for the measurement to work. Leave it unset for the default: 100% CSS, zero
   * positioning JS.
   */
  boundary?: Boundary
}

export interface UseAnchorReturn {
  /** Spread onto the anchor (reference) element: `<button {...anchorProps} />`. */
  anchorProps: { style: CSSProperties; ref: AnchorRef }
  /** Spread onto the floating element: `<div {...floatingProps} role="tooltip" />`. */
  floatingProps: { style: CSSProperties; ref: AnchorRef }
  /**
   * Spread onto an optional arrow element — render it **inside** the floating
   * element. It centers itself on the edge that faces the anchor, at whatever
   * size you give it; shape it, but don't nudge it. A *native* flip moves the
   * floating box out from under it — pass `boundary: 'viewport'` to flip in JS
   * instead, which the arrow does follow.
   */
  arrowProps: { style: CSSProperties }
  /**
   * Spread onto an optional safe-area element — a **child** of the floating
   * element. Inert unless the `safeArea` option is on.
   */
  safeAreaProps: { style: CSSProperties }
  /** The generated `anchor-name` dashed-ident (e.g. for manual CSS). */
  anchorName: string
  /**
   * The placement currently in effect. Equals the requested placement unless a
   * `boundary` flipped it to the opposite side.
   */
  placement: Placement
  /** Whether a safe area is enabled (mirrors the `safeArea` option). */
  safeArea: boolean
  /**
   * Whether the browser supports CSS Anchor Positioning. `false` during SSR and
   * on the first client render (set `true` after mount to avoid hydration
   * mismatch). Use it to conditionally load a polyfill or JS fallback.
   */
  supported: boolean
}

const sanitize = (id: string) => id.replace(/[^a-zA-Z0-9-]/g, '')

function resolveBoundary(boundary: Boundary | undefined): Element | 'viewport' | null {
  if (!boundary) return null
  if (boundary === 'viewport') return 'viewport'
  if (typeof Element !== 'undefined' && boundary instanceof Element) return boundary
  return (boundary as RefObject<Element | null>).current ?? null
}

/** The viewport in `getBoundingClientRect` coordinates: it starts at the origin. */
function viewportRect() {
  return { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight }
}

/**
 * Headless positioning for tooltips, popovers, menus and dropdowns — backed by
 * native CSS Anchor Positioning instead of a JS measurement loop.
 *
 * ```tsx
 * const { anchorProps, floatingProps } = useAnchor({ placement: 'top', offset: 8 })
 * return (
 *   <>
 *     <button {...anchorProps}>Hover me</button>
 *     <div {...floatingProps} role="tooltip">Hi</div>
 *   </>
 * )
 * ```
 *
 * You still own visibility/interaction (hover, focus, `popover`, click-outside)
 * and styling — this hook only computes position styles. By default it emits
 * pure CSS with zero positioning JS; pass `boundary` to opt into flipping inside
 * an inner scroll container (the one thing CSS can't do).
 */
export function useAnchor(options: UseAnchorOptions = {}): UseAnchorReturn {
  const { placement, offset, flip, hide, size, strategy, safeArea, boundary } = options
  const requested = placement ?? 'bottom'

  const id = useId()
  const anchorName = useMemo(() => `--cak-${sanitize(id)}`, [id])

  // Live element refs for boundary-scoped flip measurement.
  const anchorElRef = useRef<Element | null>(null)
  const floatingElRef = useRef<Element | null>(null)
  const setAnchorEl = useCallback<AnchorRef>((el) => {
    anchorElRef.current = el
  }, [])
  const setFloatingEl = useCallback<AnchorRef>((el) => {
    floatingElRef.current = el
  }, [])

  // The placement actually applied. Diverges from `requested` only when a
  // boundary is set and the anchor nears its edge.
  const [effPlacement, setEffPlacement] = useState<Placement>(requested)
  useEffect(() => {
    setEffPlacement(requested)
  }, [requested])

  const hasBoundary = boundary != null
  // With a boundary, JS owns the flip, so suppress the CSS fallback to avoid the
  // viewport-based flip fighting the container-based one.
  const cssFlip = hasBoundary ? false : flip

  const styles = useMemo(
    () =>
      buildAnchorStyles(anchorName, {
        placement: effPlacement,
        offset,
        flip: cssFlip,
        hide,
        size,
        strategy,
        safeArea,
      }),
    [anchorName, effPlacement, offset, cssFlip, hide, size, strategy, safeArea],
  )

  // Boundary-scoped flip: measure on scroll/resize, swap placement when the
  // preferred side overflows the container and the opposite side has room.
  useEffect(() => {
    const resolved = resolveBoundary(boundary)
    if (!resolved || flip === false) return
    // `'viewport'` has no element to observe — the window listeners below cover
    // every way it can change.
    const boundaryEl = resolved === 'viewport' ? null : resolved

    let raf = 0
    const measure = () => {
      raf = 0
      const a = anchorElRef.current
      const f = floatingElRef.current
      if (!a || !f) return
      const fr = f.getBoundingClientRect()
      const next = resolveFlip(
        requested,
        a.getBoundingClientRect(),
        { width: fr.width, height: fr.height },
        boundaryEl ? boundaryEl.getBoundingClientRect() : viewportRect(),
        offset ?? 0,
      )
      setEffPlacement((prev) => (prev === next ? prev : next))
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }

    schedule()
    boundaryEl?.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('scroll', schedule, { passive: true, capture: true })
    window.addEventListener('resize', schedule)
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null
    if (ro) {
      if (boundaryEl) ro.observe(boundaryEl)
      if (floatingElRef.current) ro.observe(floatingElRef.current)
    }

    return () => {
      if (raf) cancelAnimationFrame(raf)
      boundaryEl?.removeEventListener('scroll', schedule)
      window.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', schedule)
      ro?.disconnect()
    }
  }, [boundary, flip, requested, offset])

  // Resolve support only after mount so server and first client render agree.
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    setSupported(isAnchorPositioningSupported())
  }, [])

  // Dev-only: the anchor's ancestors decide whether a `position: fixed`
  // floating element can leave its panel at all. Say so once, at mount, with
  // the offending element — the alternative is bisecting someone else's CSS.
  //
  // `process.env.NODE_ENV` is written bare, the way every bundler's `define`
  // expects it: a `typeof process` guard would read as dynamic and pin the
  // whole diagnostic (~1 KB of message strings) into production bundles. The
  // try/catch is that guard instead — it survives a raw `<script type=module>`
  // where `process` doesn't exist, and folds away with the branch.
  useEffect(() => {
    try {
      if (process.env.NODE_ENV !== 'production' && strategy !== 'absolute') {
        warnContainingBlockTrap(anchorElRef.current, floatingElRef.current)
      }
    } catch {
      // No `process` binding at all (a bundler-less `<script type="module">`).
      // Stay silent rather than throw; call warnContainingBlockTrap() yourself
      // if you want the diagnostic there.
    }
  }, [strategy])

  return {
    anchorProps: { style: styles.anchor as CSSProperties, ref: setAnchorEl },
    floatingProps: { style: styles.floating as CSSProperties, ref: setFloatingEl },
    arrowProps: { style: styles.arrow as CSSProperties },
    safeAreaProps: { style: styles.safeArea as CSSProperties },
    anchorName,
    safeArea: safeArea === true,
    placement: effPlacement,
    supported,
  }
}
