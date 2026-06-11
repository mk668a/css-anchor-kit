import {
  Arrow,
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
 * Live preview: the interaction-layer components. Positioning comes from CSS
 * Anchor Positioning, visibility from the native Popover API — top layer,
 * light dismiss, Escape and focus restore are all the browser's.
 */
export function PopoverKitDemo() {
  return (
    <div className="preview-stage">
      <Popover placement="bottom-start" offset={10}>
        <PopoverTrigger className="btn">Popover — click ▾</PopoverTrigger>
        <PopoverContent className="card">
          <strong>Native light dismiss</strong>
          <span>
            Click outside or press <kbd>Esc</kbd> — the browser closes it. No
            outside-click listener shipped.
          </span>
          <Arrow className="arrow arrow-up" aria-hidden />
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
