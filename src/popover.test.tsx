import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render } from '@testing-library/react'
import {
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
  isPopoverSupported,
} from './popover'
import { SafeArea } from './components'

// happy-dom doesn't implement the Popover API (no showPopover), so by default
// these tests exercise the fallback path. installNativeStub() simulates the
// native path: showPopover/hidePopover flip a flag and dispatch 'toggle'.
function installNativeStub() {
  const proto = HTMLElement.prototype as any
  proto.showPopover = function () {
    if (this.__popoverOpen) return
    this.__popoverOpen = true
    const e = new Event('toggle') as any
    e.oldState = 'closed'
    e.newState = 'open'
    this.dispatchEvent(e)
  }
  proto.hidePopover = function () {
    if (!this.__popoverOpen) return
    this.__popoverOpen = false
    const e = new Event('toggle') as any
    e.oldState = 'open'
    e.newState = 'closed'
    this.dispatchEvent(e)
  }
  return () => {
    delete proto.showPopover
    delete proto.hidePopover
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Popover (wiring)', () => {
  it('wires trigger/content: popovertarget, ids, aria, anchor styles', () => {
    const { container } = render(
      <Popover placement="bottom-start" offset={6}>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent data-testid="content">Panel</PopoverContent>
      </Popover>,
    )
    const trigger = container.querySelector('button') as HTMLElement
    const content = container.querySelector('[data-testid="content"]') as HTMLElement

    expect(trigger.getAttribute('type')).toBe('button')
    expect(content.id).toMatch(/^cak-pop-/)
    expect(trigger.getAttribute('popovertarget')).toBe(content.id)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('aria-controls')).toBe(content.id)
    expect(content.getAttribute('popover')).toBe('auto')

    // Both halves share the same anchor-name (positioning is wired through).
    const anchorName = (trigger.style as any).anchorName
    expect(anchorName).toMatch(/^--cak-/)
    expect((content.style as any).positionAnchor).toBe(anchorName)
  })

  it('falls back without the Popover API: click toggles, content hides via display', () => {
    const onOpenChange = vi.fn()
    const { container } = render(
      <Popover onOpenChange={onOpenChange}>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent data-testid="content">Panel</PopoverContent>
      </Popover>,
    )
    const trigger = container.querySelector('button') as HTMLElement
    const content = container.querySelector('[data-testid="content"]') as HTMLElement

    expect(isPopoverSupported()).toBe(false)
    expect(content.style.display).toBe('none')

    fireEvent.click(trigger)
    expect(content.style.display).not.toBe('none')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(onOpenChange).toHaveBeenLastCalledWith(true)

    fireEvent.click(trigger)
    expect(content.style.display).toBe('none')
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('fallback light dismiss: outside pointerdown and Escape close it', () => {
    const { container } = render(
      <Popover defaultOpen>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent data-testid="content">Panel</PopoverContent>
      </Popover>,
    )
    const content = container.querySelector('[data-testid="content"]') as HTMLElement
    expect(content.style.display).not.toBe('none')

    fireEvent.pointerDown(document.body)
    expect(content.style.display).toBe('none')

    // Re-open, then Escape.
    fireEvent.click(container.querySelector('button') as HTMLElement)
    expect(content.style.display).not.toBe('none')
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(content.style.display).toBe('none')
  })

  it('clicking inside the content does not dismiss (fallback)', () => {
    const { container } = render(
      <Popover defaultOpen>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent data-testid="content">
          <button data-testid="inner">inner</button>
        </PopoverContent>
      </Popover>,
    )
    const content = container.querySelector('[data-testid="content"]') as HTMLElement
    fireEvent.pointerDown(container.querySelector('[data-testid="inner"]') as HTMLElement)
    expect(content.style.display).not.toBe('none')
  })

  it('native path: controlled `open` drives show/hidePopover, toggle syncs back', () => {
    const restore = installNativeStub()
    try {
      const onOpenChange = vi.fn()
      const { container, rerender } = render(
        <Popover open={false} onOpenChange={onOpenChange}>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent data-testid="content">Panel</PopoverContent>
        </Popover>,
      )
      const content = container.querySelector('[data-testid="content"]') as any
      expect(content.__popoverOpen).toBeFalsy()
      // Native path: no fallback display:none — the UA stylesheet hides it.
      expect(content.style.display).not.toBe('none')

      rerender(
        <Popover open onOpenChange={onOpenChange}>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent data-testid="content">Panel</PopoverContent>
        </Popover>,
      )
      expect(content.__popoverOpen).toBe(true)
      // The echo of our own showPopover() must not fire onOpenChange.
      expect(onOpenChange).not.toHaveBeenCalled()

      // Light dismiss / Escape arrive as a DOM-initiated toggle.
      act(() => content.hidePopover())
      expect(onOpenChange).toHaveBeenLastCalledWith(false)
    } finally {
      restore()
    }
  })

  it('native path: defaultOpen shows the popover on mount', () => {
    const restore = installNativeStub()
    try {
      const { container } = render(
        <Popover defaultOpen>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent data-testid="content">Panel</PopoverContent>
        </Popover>,
      )
      const content = container.querySelector('[data-testid="content"]') as any
      expect(content.__popoverOpen).toBe(true)
    } finally {
      restore()
    }
  })

  it('throws if a slot is used outside its root', () => {
    expect(() => render(<PopoverContent>x</PopoverContent>)).toThrow(
      /must be rendered inside <Popover>/,
    )
  })
})

describe('Tooltip', () => {
  it('renders role/aria wiring and popover="manual"', () => {
    const { container } = render(
      <Tooltip placement="top">
        <TooltipTrigger>Hover</TooltipTrigger>
        <TooltipContent data-testid="tip">Hi</TooltipContent>
      </Tooltip>,
    )
    const trigger = container.querySelector('button') as HTMLElement
    const tip = container.querySelector('[data-testid="tip"]') as HTMLElement
    expect(tip.getAttribute('popover')).toBe('manual')
    expect(tip.getAttribute('role')).toBe('tooltip')
    expect(trigger.getAttribute('aria-describedby')).toBe(tip.id)
    // Tooltips are hover-driven, not invoker-driven.
    expect(trigger.getAttribute('popovertarget')).toBeNull()
  })

  it('opens after openDelay on hover, closes on pointer leave', () => {
    vi.useFakeTimers()
    const { container } = render(
      <Tooltip openDelay={150}>
        <TooltipTrigger>Hover</TooltipTrigger>
        <TooltipContent data-testid="tip">Hi</TooltipContent>
      </Tooltip>,
    )
    const trigger = container.querySelector('button') as HTMLElement
    const tip = container.querySelector('[data-testid="tip"]') as HTMLElement

    fireEvent.pointerOver(trigger)
    expect(tip.style.display).toBe('none')
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(tip.style.display).not.toBe('none')

    fireEvent.pointerOut(trigger)
    expect(tip.style.display).toBe('none')
  })

  it('leaving before openDelay cancels the pending open', () => {
    vi.useFakeTimers()
    const { container } = render(
      <Tooltip openDelay={150}>
        <TooltipTrigger>Hover</TooltipTrigger>
        <TooltipContent data-testid="tip">Hi</TooltipContent>
      </Tooltip>,
    )
    const trigger = container.querySelector('button') as HTMLElement
    const tip = container.querySelector('[data-testid="tip"]') as HTMLElement

    fireEvent.pointerOver(trigger)
    fireEvent.pointerOut(trigger)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(tip.style.display).toBe('none')
  })

  it('keeps the tooltip open when the pointer crosses into the safe area', () => {
    vi.useFakeTimers()
    const { container } = render(
      <Tooltip placement="right" offset={16} defaultOpen safeArea>
        <TooltipTrigger>Hover</TooltipTrigger>
        <TooltipContent data-testid="tip">
          <SafeArea data-testid="safe" />
          Hi
        </TooltipContent>
      </Tooltip>,
    )
    const trigger = container.querySelector('button') as HTMLElement
    const tip = container.querySelector('[data-testid="tip"]') as HTMLElement
    const safe = container.querySelector('[data-testid="safe"]') as HTMLElement

    // Leaving the trigger *towards* the corridor: the browser fires leave on
    // the trigger before enter on the safe area, so the close must be deferred
    // long enough for the enter to cancel it.
    fireEvent.pointerOut(trigger, { relatedTarget: safe })
    fireEvent.pointerOver(safe, { relatedTarget: trigger })
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(tip.style.display).not.toBe('none')
  })

  it('still closes when the pointer leaves for somewhere else', () => {
    vi.useFakeTimers()
    const { container } = render(
      <Tooltip placement="right" offset={16} defaultOpen safeArea>
        <TooltipTrigger>Hover</TooltipTrigger>
        <TooltipContent data-testid="tip">
          <SafeArea data-testid="safe" />
          Hi
        </TooltipContent>
      </Tooltip>,
    )
    const trigger = container.querySelector('button') as HTMLElement
    const tip = container.querySelector('[data-testid="tip"]') as HTMLElement

    fireEvent.pointerOut(trigger)
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(tip.style.display).toBe('none')
  })

  it('opens immediately on focus and closes on blur', () => {
    const { container } = render(
      <Tooltip>
        <TooltipTrigger>Hover</TooltipTrigger>
        <TooltipContent data-testid="tip">Hi</TooltipContent>
      </Tooltip>,
    )
    const trigger = container.querySelector('button') as HTMLElement
    const tip = container.querySelector('[data-testid="tip"]') as HTMLElement

    fireEvent.focus(trigger)
    expect(tip.style.display).not.toBe('none')
    fireEvent.blur(trigger)
    expect(tip.style.display).toBe('none')
  })

  it('Escape closes an open tooltip', () => {
    const { container } = render(
      <Tooltip defaultOpen>
        <TooltipTrigger>Hover</TooltipTrigger>
        <TooltipContent data-testid="tip">Hi</TooltipContent>
      </Tooltip>,
    )
    const tip = container.querySelector('[data-testid="tip"]') as HTMLElement
    expect(tip.style.display).not.toBe('none')
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(tip.style.display).toBe('none')
  })
})

describe('Menu', () => {
  function renderMenu(onOpenChange = vi.fn()) {
    const utils = render(
      <Menu onOpenChange={onOpenChange}>
        <MenuTrigger>Actions</MenuTrigger>
        <MenuContent data-testid="menu">
          <MenuItem data-testid="i1">One</MenuItem>
          <MenuItem data-testid="i2">Two</MenuItem>
          <MenuItem data-testid="i3">Three</MenuItem>
        </MenuContent>
      </Menu>,
    )
    const trigger = utils.container.querySelector('button') as HTMLElement
    const menu = utils.container.querySelector('[data-testid="menu"]') as HTMLElement
    const items = ['i1', 'i2', 'i3'].map(
      (id) => utils.container.querySelector(`[data-testid="${id}"]`) as HTMLElement,
    )
    return { ...utils, trigger, menu, items, onOpenChange }
  }

  it('renders menu roles and aria-haspopup', () => {
    const { trigger, menu, items } = renderMenu()
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(menu.getAttribute('role')).toBe('menu')
    for (const item of items) {
      expect(item.getAttribute('role')).toBe('menuitem')
      expect(item.getAttribute('tabindex')).toBe('-1')
    }
  })

  it('opens on click and focuses the first item', () => {
    const { trigger, menu, items } = renderMenu()
    fireEvent.click(trigger)
    expect(menu.style.display).not.toBe('none')
    expect(document.activeElement).toBe(items[0])
  })

  it('arrow keys move focus and wrap; Home/End jump', () => {
    const { trigger, items } = renderMenu()
    fireEvent.click(trigger)

    fireEvent.keyDown(items[0], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])
    fireEvent.keyDown(items[1], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[2])
    fireEvent.keyDown(items[2], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[0]) // wraps
    fireEvent.keyDown(items[0], { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[2]) // wraps back
    fireEvent.keyDown(items[2], { key: 'Home' })
    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(items[0], { key: 'End' })
    expect(document.activeElement).toBe(items[2])
  })

  it('selecting an item closes the menu and returns focus to the trigger', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <Menu defaultOpen>
        <MenuTrigger>Actions</MenuTrigger>
        <MenuContent data-testid="menu">
          <MenuItem data-testid="i1" onClick={onSelect}>One</MenuItem>
        </MenuContent>
      </Menu>,
    )
    const menu = container.querySelector('[data-testid="menu"]') as HTMLElement
    const item = container.querySelector('[data-testid="i1"]') as HTMLElement
    const trigger = container.querySelector('button') as HTMLElement

    fireEvent.click(item)
    expect(onSelect).toHaveBeenCalled()
    expect(menu.style.display).toBe('none')
    expect(document.activeElement).toBe(trigger)
  })

  it('ArrowDown on the closed trigger opens the menu', () => {
    const { trigger, menu } = renderMenu()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(menu.style.display).not.toBe('none')
  })

  it('skips disabled items in keyboard navigation', () => {
    const { container } = render(
      <Menu defaultOpen>
        <MenuTrigger>Actions</MenuTrigger>
        <MenuContent data-testid="menu">
          <MenuItem data-testid="i1">One</MenuItem>
          <MenuItem data-testid="i2" aria-disabled="true">Two</MenuItem>
          <MenuItem data-testid="i3">Three</MenuItem>
        </MenuContent>
      </Menu>,
    )
    const i1 = container.querySelector('[data-testid="i1"]') as HTMLElement
    const i3 = container.querySelector('[data-testid="i3"]') as HTMLElement
    expect(document.activeElement).toBe(i1)
    fireEvent.keyDown(i1, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(i3)
  })
})
