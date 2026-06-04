import { useId } from 'react'
import { Anchored, Anchor, Floating } from 'css-anchor-kit'

/**
 * Live preview: a dropdown built on the component API + the native Popover API,
 * with `size="width"` matching the menu to its trigger. Heading-less for docs.
 */
export function MenuDemo() {
  const menuId = useId()

  return (
    <div className="preview-stage">
      {/* flip is off so the menu stays deterministically below its trigger
          (standard dropdown UX) — native popovers live in the top layer, where
          flipping at a viewport edge can otherwise detach the menu. */}
      <Anchored placement="bottom-start" offset={6} size="width" flip={false}>
        <Anchor as="button" className="btn" popoverTarget={menuId}>
          Open menu ▾
        </Anchor>
        <Floating as="ul" id={menuId} popover="auto" className="menu">
          <li>Profile</li>
          <li>Settings</li>
          <li>Keyboard shortcuts</li>
          <li>Sign out</li>
        </Floating>
      </Anchored>
    </div>
  )
}
