import { useState } from 'react'
import { useAnchor } from 'css-anchor-kit'

/**
 * Live preview: a tooltip built on the headless {@link useAnchor} hook.
 * Heading-less so it can sit inside a docs section's preview frame.
 */
export function TooltipDemo() {
  const [open, setOpen] = useState(true)
  const { anchorProps, floatingProps, arrowProps } = useAnchor({
    placement: 'top',
    offset: 10,
  })

  return (
    <div className="preview-stage">
      <button
        {...anchorProps}
        className="btn"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        Hover or focus me
      </button>

      {open && (
        <div {...floatingProps} role="tooltip" className="tooltip">
          <div {...arrowProps} className="arrow arrow-down" aria-hidden />
          Positioned natively — zero JS reflow.
        </div>
      )}
    </div>
  )
}
