import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import {
  buildAnchorStyles,
  isAnchorPositioningSupported,
  type AnchorOptions,
  type Placement,
} from './core'
import { resolveFlip } from './flipWithin'

/** A scroll container to flip within: the element itself, or a ref to it. */
export type Boundary = Element | RefObject<Element | null> | null

/**
 * A ref callback to spread onto a host element. Intentionally loose (`any` node)
 * so it attaches to a `<button>`, `<div>`, custom component, etc. without fighting
 * each element's specific ref type.
 */
export type AnchorRef = (node: any) => void

export interface UseAnchorOptions extends AnchorOptions {
  /**
   * **Opt-in:** flip inside this scroll container instead of the viewport.
   *
   * Native CSS `flip` (`position-try-fallbacks`) is judged against the viewport
   * and ignores inner scroll containers — so a floating element won't flip as a
   * scrollable panel scrolls. Pass that panel (or a ref to it) here and the hook
   * adds a small scroll/resize listener that swaps the placement as the anchor
   * nears the boundary's edge. Spread the returned `ref` onto the anchor and
   * floating elements for the measurement to work.
   *
   * Leave it unset for the default: 100% CSS, zero positioning JS.
   */
  boundary?: Boundary
}

export interface UseAnchorReturn {
  /** Spread onto the anchor (reference) element: `<button {...anchorProps} />`. */
  anchorProps: { style: CSSProperties; ref: AnchorRef }
  /** Spread onto the floating element: `<div {...floatingProps} role="tooltip" />`. */
  floatingProps: { style: CSSProperties; ref: AnchorRef }
  /** Spread onto an optional arrow element (sibling of the floating element). */
  arrowProps: { style: CSSProperties }
  /** The generated `anchor-name` dashed-ident (e.g. for manual CSS). */
  anchorName: string
  /**
   * The placement currently in effect. Equals the requested placement unless a
   * `boundary` flipped it to the opposite side.
   */
  placement: Placement
  /**
   * Whether the browser supports CSS Anchor Positioning. `false` during SSR and
   * on the first client render (set `true` after mount to avoid hydration
   * mismatch). Use it to conditionally load a polyfill or JS fallback.
   */
  supported: boolean
}

const sanitize = (id: string) => id.replace(/[^a-zA-Z0-9-]/g, '')

function resolveBoundary(boundary: Boundary | undefined): Element | null {
  if (!boundary) return null
  if (typeof Element !== 'undefined' && boundary instanceof Element) return boundary
  return (boundary as RefObject<Element | null>).current ?? null
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
  const { placement, offset, flip, hide, size, strategy, boundary } = options
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
      }),
    [anchorName, effPlacement, offset, cssFlip, hide, size, strategy],
  )

  // Boundary-scoped flip: measure on scroll/resize, swap placement when the
  // preferred side overflows the container and the opposite side has room.
  useEffect(() => {
    const boundaryEl = resolveBoundary(boundary)
    if (!boundaryEl || flip === false) return

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
        boundaryEl.getBoundingClientRect(),
        offset ?? 0,
      )
      setEffPlacement((prev) => (prev === next ? prev : next))
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }

    schedule()
    boundaryEl.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('scroll', schedule, { passive: true, capture: true })
    window.addEventListener('resize', schedule)
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null
    if (ro) {
      ro.observe(boundaryEl)
      if (floatingElRef.current) ro.observe(floatingElRef.current)
    }

    return () => {
      if (raf) cancelAnimationFrame(raf)
      boundaryEl.removeEventListener('scroll', schedule)
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

  return {
    anchorProps: { style: styles.anchor as CSSProperties, ref: setAnchorEl },
    floatingProps: { style: styles.floating as CSSProperties, ref: setFloatingEl },
    arrowProps: { style: styles.arrow as CSSProperties },
    anchorName,
    placement: effPlacement,
    supported,
  }
}
