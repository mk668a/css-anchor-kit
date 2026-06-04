import { useEffect, useId, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  buildAnchorStyles,
  isAnchorPositioningSupported,
  type AnchorOptions,
} from './core'

export interface UseAnchorReturn {
  /** Spread onto the anchor (reference) element: `<button {...anchorProps} />`. */
  anchorProps: { style: CSSProperties }
  /** Spread onto the floating element: `<div {...floatingProps} role="tooltip" />`. */
  floatingProps: { style: CSSProperties }
  /** Spread onto an optional arrow element (sibling of the floating element). */
  arrowProps: { style: CSSProperties }
  /** The generated `anchor-name` dashed-ident (e.g. for manual CSS). */
  anchorName: string
  /**
   * Whether the browser supports CSS Anchor Positioning. `false` during SSR and
   * on the first client render (set `true` after mount to avoid hydration
   * mismatch). Use it to conditionally load a polyfill or JS fallback.
   */
  supported: boolean
}

const sanitize = (id: string) => id.replace(/[^a-zA-Z0-9-]/g, '')

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
 * and styling — this hook only computes position styles.
 */
export function useAnchor(options: AnchorOptions = {}): UseAnchorReturn {
  const { placement, offset, flip, hide, size, strategy } = options

  const id = useId()
  const anchorName = useMemo(() => `--cak-${sanitize(id)}`, [id])

  const styles = useMemo(
    () => buildAnchorStyles(anchorName, { placement, offset, flip, hide, size, strategy }),
    [anchorName, placement, offset, flip, hide, size, strategy],
  )

  // Resolve support only after mount so server and first client render agree.
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    setSupported(isAnchorPositioningSupported())
  }, [])

  return {
    anchorProps: { style: styles.anchor as CSSProperties },
    floatingProps: { style: styles.floating as CSSProperties },
    arrowProps: { style: styles.arrow as CSSProperties },
    anchorName,
    supported,
  }
}
