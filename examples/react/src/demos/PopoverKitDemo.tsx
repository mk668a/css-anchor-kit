import {
  Arrow,
  useAnchored,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'css-anchor-kit'

/**
 * The arrow's direction class has to follow the *effective* placement, which is
 * why the popover flips with `boundary="viewport"`: a CSS flip never reports
 * back, so the triangle would keep pointing the way you asked for while the card
 * moved to the other side. `useAnchored()` reads the live placement from the
 * same context `<Arrow>` gets its position from.
 */
function FollowingArrow() {
  const { placement } = useAnchored()
  const side = placement.split('-')[0]
  const direction =
    side === 'top' ? 'arrow-down' : side === 'bottom' ? 'arrow-up'
    : side === 'left' ? 'arrow-right' : 'arrow-left'
  return <Arrow className={`arrow ${direction}`} aria-hidden />
}

/**
 * Live preview: the interaction-layer components. Positioning comes from CSS
 * Anchor Positioning, visibility from the native Popover API — top layer,
 * light dismiss, Escape and focus restore are all the browser's.
 */
export function PopoverKitDemo() {
  return (
    <div className="preview-stage">
      {/* `boundary="viewport"` flips in JS rather than leaving it to CSS. A CSS
          flip is invisible to JS, so the arrow — which is positioned off the
          anchor — would stay below the trigger while the card moved above it. */}
      <Popover placement="bottom-start" offset={10} boundary="viewport">
        <PopoverTrigger className="btn">Popover — click ▾</PopoverTrigger>
        <PopoverContent className="card">
          <strong>Native light dismiss</strong>
          <span>
            Click outside or press <kbd>Esc</kbd> — the browser closes it. No
            outside-click listener shipped.
          </span>
          <FollowingArrow />
        </PopoverContent>
      </Popover>

      <Tooltip placement="top" offset={10} openDelay={150}>
        <TooltipTrigger className="btn">Tooltip — hover me</TooltipTrigger>
        <TooltipContent className="tooltip">
          Top layer, zero positioning JS.
        </TooltipContent>
      </Tooltip>

      <Menu placement="bottom-end" offset={6} flip={false}>
        <MenuTrigger className="btn">Menu — ⌨️ arrows ▾</MenuTrigger>
        <MenuContent as="ul" className="menu">
          <MenuItem as="li">Profile</MenuItem>
          <MenuItem as="li">Settings</MenuItem>
          <MenuItem as="li">Keyboard shortcuts</MenuItem>
          <MenuItem as="li">Sign out</MenuItem>
        </MenuContent>
      </Menu>
    </div>
  )
}
