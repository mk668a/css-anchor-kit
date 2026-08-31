/**
 * Popover-layer components — the native Popover API wired to CSS Anchor
 * Positioning.
 *
 * {@link useAnchor} / `<Anchored>` position a floating element but leave
 * visibility and interaction to you. These components fill that half with the
 * platform's popover machinery instead of re-implementing it in JS: top layer
 * (no portal, no z-index), light dismiss + Escape from `popover="auto"`, and
 * focus restore — all from the browser.
 *
 * ```tsx
 * <Popover placement="bottom-start" offset={6}>
 *   <PopoverTrigger>Open</PopoverTrigger>
 *   <PopoverContent className="card">…</PopoverContent>
 * </Popover>
 * ```
 *
 * Headless like the rest of the kit: no styles, no classes, every prop
 * forwarded. `<Arrow>` composes inside `<PopoverContent>`.
 *
 * Three flavors share one engine:
 * - `Popover` — click-to-toggle, `popover="auto"` (light dismiss).
 * - `Tooltip` — hover/focus with delays, `popover="manual"`, `role="tooltip"`.
 * - `Menu` — `role="menu"` dropdown with arrow-key navigation.
 *
 * When the Popover API is missing (pre-Baseline-2025 browsers, SSR markup
 * before hydration) the components fall back to `display: none` plus their own
 * outside-click/Escape handling, so behavior degrades gracefully rather than
 * rendering content inline.
 */
import {
  createContext,
  createElement,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react'
import { useAnchor, type UseAnchorOptions, type UseAnchorReturn } from './useAnchor'
import { AnchorProvider, mergeRefs, type PolymorphicProps } from './components'

type PopoverElement = HTMLElement & {
  showPopover?: () => void
  hidePopover?: () => void
}

/** Feature-detect the Popover API. Returns `false` during SSR. */
export function isPopoverSupported(): boolean {
  return (
    typeof HTMLElement !== 'undefined' &&
    typeof (HTMLElement.prototype as PopoverElement).showPopover === 'function'
  )
}

type Kind = 'popover' | 'tooltip' | 'menu'

interface PopoverContextValue {
  anchor: UseAnchorReturn
  contentId: string
  kind: Kind
  open: boolean
  native: boolean
  /** Open/close through the DOM popover when available, else through state. */
  requestOpen: (next: boolean) => void
  /** Funnel for "the open state changed" — syncs state + fires onOpenChange. */
  handleToggle: (next: boolean) => void
  /** requestOpen with the root's open/close delay applied (tooltips). */
  schedule: (next: boolean) => void
  triggerRef: RefObject<HTMLElement | null>
  contentRef: RefObject<HTMLElement | null>
  /** What the DOM popover currently shows (kept in sync by toggle events). */
  domOpenRef: RefObject<boolean>
  /** Mirror of `open` for event handlers (avoids stale closures). */
  openRef: RefObject<boolean>
}

const PopoverContext = createContext<PopoverContextValue | null>(null)

function usePopoverContext(component: string, root: string): PopoverContextValue {
  const ctx = useContext(PopoverContext)
  if (!ctx) {
    throw new Error(`<${component}> must be rendered inside <${root}>.`)
  }
  return ctx
}

/** Run the consumer's handler first, then ours (unless they preventDefault). */
function chain<E extends { defaultPrevented?: boolean }>(
  theirs: ((event: E) => void) | undefined,
  ours: (event: E) => void,
): (event: E) => void {
  return (event) => {
    theirs?.(event)
    if (!event.defaultPrevented) ours(event)
  }
}

export interface PopoverProps extends UseAnchorOptions {
  children?: ReactNode
  /** Controlled open state. When set, you own it — update it from `onOpenChange`. */
  open?: boolean
  /** Uncontrolled initial state. Default `false`. */
  defaultOpen?: boolean
  /** Fires on every open/close, including light dismiss and Escape. */
  onOpenChange?: (open: boolean) => void
}

export interface TooltipProps extends PopoverProps {
  /** ms before the tooltip opens on hover. Default `150`. */
  openDelay?: number
  /** ms before the tooltip closes after the pointer leaves. Default `0`. */
  closeDelay?: number
}

export type MenuProps = PopoverProps

interface RootProps extends PopoverProps {
  kind: Kind
  openDelay?: number
  closeDelay?: number
}

function Root({
  kind,
  openDelay = 0,
  closeDelay = 0,
  children,
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...anchorOptions
}: RootProps): ReactNode {
  const anchor = useAnchor(anchorOptions)

  const rawId = useId()
  const contentId = useMemo(
    () => `cak-pop-${rawId.replace(/[^a-zA-Z0-9-]/g, '')}`,
    [rawId],
  )

  const [openState, setOpenState] = useState(defaultOpen ?? false)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : openState

  // Resolved after mount so server and first client render agree (same pattern
  // as useAnchor's `supported`).
  const [native, setNative] = useState(false)
  useEffect(() => {
    setNative(isPopoverSupported())
  }, [])

  const triggerRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLElement | null>(null)
  const domOpenRef = useRef(false)

  // Latest-value mirrors, assigned during render (not in an effect): the
  // content's DOM-sync effect runs before this component's effects would, and
  // it must already see the `open` value of the render that triggered it.
  const openRef = useRef(open)
  const controlledRef = useRef(controlled)
  const onOpenChangeRef = useRef(onOpenChange)
  openRef.current = open
  controlledRef.current = controlled
  onOpenChangeRef.current = onOpenChange

  const handleToggle = useCallback((next: boolean) => {
    if (!controlledRef.current) setOpenState(next)
    onOpenChangeRef.current?.(next)
  }, [])

  const requestOpen = useCallback(
    (next: boolean) => {
      const el = contentRef.current as PopoverElement | null
      if (el && typeof el.showPopover === 'function') {
        // The 'toggle' listener on the content syncs state from here.
        try {
          next ? el.showPopover() : el.hidePopover()
        } catch {
          // InvalidStateError: already in the requested state — nothing to do.
        }
      } else {
        domOpenRef.current = next
        handleToggle(next)
      }
    },
    [handleToggle],
  )

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const delaysRef = useRef({ open: openDelay, close: closeDelay })
  useEffect(() => {
    delaysRef.current = { open: openDelay, close: closeDelay }
  })
  // Mirror assigned during render, like the ones above — `schedule` is stable.
  const safeAreaRef = useRef(anchor.safeArea)
  safeAreaRef.current = anchor.safeArea
  const schedule = useCallback(
    (next: boolean) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      const delay = next ? delaysRef.current.open : delaysRef.current.close
      // A safe area is only reachable if the close waits for the pointer to get
      // there: the browser fires `pointerleave` on the trigger *before*
      // `pointerenter` on the corridor, so a synchronous close would hide the
      // corridor before it could cancel anything. One task is enough — boundary
      // events all fire while dispatching the same pointermove.
      if (delay > 0 || (!next && safeAreaRef.current)) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          requestOpen(next)
        }, delay)
      } else {
        requestOpen(next)
      }
    },
    [requestOpen],
  )
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  const value = useMemo<PopoverContextValue>(
    () => ({
      anchor,
      contentId,
      kind,
      open,
      native,
      requestOpen,
      handleToggle,
      schedule,
      triggerRef,
      contentRef,
      domOpenRef,
      openRef,
    }),
    [anchor, contentId, kind, open, native, requestOpen, handleToggle, schedule],
  )

  return createElement(
    PopoverContext.Provider,
    { value },
    // Also provide the anchor context so <Anchor>/<Floating>/<Arrow> compose.
    createElement(AnchorProvider, { value: anchor }, children),
  )
}

/** Click-to-toggle popover root. Content uses `popover="auto"` (light dismiss). */
export function Popover(props: PopoverProps): ReactNode {
  return createElement(Root, { ...props, kind: 'popover' })
}

/** Hover/focus tooltip root. Content uses `popover="manual"` + `role="tooltip"`. */
export function Tooltip({ openDelay = 150, closeDelay = 0, ...props }: TooltipProps): ReactNode {
  return createElement(Root, { ...props, openDelay, closeDelay, kind: 'tooltip' })
}

/** Dropdown menu root. Content uses `role="menu"` with arrow-key navigation. */
export function Menu(props: MenuProps): ReactNode {
  return createElement(Root, { ...props, kind: 'menu' })
}

const MENU_ITEM_SELECTOR =
  '[role="menuitem"]:not([aria-disabled="true"]):not([disabled])'

function menuItems(content: HTMLElement | null): HTMLElement[] {
  return content ? Array.from(content.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR)) : []
}

function createTrigger(displayName: string, root: string) {
  const Component = forwardRef<unknown, PolymorphicProps>(function Trigger(
    { as, style, ...rest },
    ref,
  ) {
    const ctx = usePopoverContext(displayName, root)
    const { anchor, contentId, kind, open, native } = ctx
    const Tag: ElementType = as ?? 'button'

    // Wire the native invoker relationship imperatively: React 18 drops the
    // camelCase `popoverTarget` prop and React 19 warns on the lowercase
    // spelling, so neither renders cleanly across the peer-dep range. The
    // attribute gives us the browser's own toggle handling (and the implicit
    // anchor/invoker semantics) on every native click.
    useEffect(() => {
      if (kind === 'tooltip') return
      ctx.triggerRef.current?.setAttribute('popovertarget', contentId)
    })

    const props: Record<string, unknown> = {
      ...rest,
      ref: mergeRefs(ref as Ref<unknown>, anchor.anchorProps.ref, (node: unknown) => {
        ctx.triggerRef.current = (node as HTMLElement | null) ?? null
      }),
      style: { ...style, ...anchor.anchorProps.style },
    }
    if (Tag === 'button' && props.type === undefined) props.type = 'button'

    if (kind === 'tooltip') {
      props['aria-describedby'] = contentId
      props.onPointerEnter = chain(rest.onPointerEnter, (e: ReactPointerEvent) => {
        if (e.pointerType === 'touch') return
        ctx.schedule(true)
      })
      props.onPointerLeave = chain(rest.onPointerLeave, () => ctx.schedule(false))
      props.onFocus = chain(rest.onFocus, () => ctx.requestOpen(true))
      props.onBlur = chain(rest.onBlur, () => ctx.requestOpen(false))
    } else {
      props['aria-expanded'] = open
      props['aria-controls'] = contentId
      if (kind === 'menu') props['aria-haspopup'] = 'menu'
      props.onClick = chain(rest.onClick, () => {
        // Native clicks are handled by the popovertarget attribute; doubling
        // up here would re-toggle and cancel the browser's action out.
        if (!native) ctx.requestOpen(!ctx.openRef.current)
      })
      if (kind === 'menu') {
        props.onKeyDown = chain(rest.onKeyDown, (e: ReactKeyboardEvent) => {
          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !ctx.openRef.current) {
            e.preventDefault()
            ctx.requestOpen(true)
          }
        })
      }
    }

    return createElement(Tag, props)
  })
  Component.displayName = displayName
  return Component
}

function createContent(displayName: string, root: string) {
  const Component = forwardRef<unknown, PolymorphicProps>(function Content(
    { as, style, ...rest },
    ref,
  ) {
    const ctx = usePopoverContext(displayName, root)
    const { anchor, contentId, kind, open, native } = ctx
    const Tag: ElementType = as ?? 'div'

    // Sync React state from the DOM. 'toggle' fires for every native path:
    // popovertarget clicks, light dismiss, Escape, show/hidePopover().
    useEffect(() => {
      const el = ctx.contentRef.current
      if (!el) return
      const onToggle = (e: Event) => {
        const next = (e as { newState?: string }).newState === 'open'
        ctx.domOpenRef.current = next
        if (next !== ctx.openRef.current) ctx.handleToggle(next)
      }
      el.addEventListener('toggle', onToggle)
      return () => el.removeEventListener('toggle', onToggle)
      // ctx callbacks are stable (refs inside), so mount-only is safe.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Re-assert the DOM when `open` changes from the React side (controlled
    // mode, defaultOpen) rather than from the DOM itself.
    useEffect(() => {
      if (ctx.domOpenRef.current === open) return
      const el = ctx.contentRef.current as PopoverElement | null
      if (el && typeof el.showPopover === 'function') {
        try {
          open ? el.showPopover() : el.hidePopover()
        } catch {
          // already in the requested state
        }
      } else {
        ctx.domOpenRef.current = open
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    // Dismissal the browser doesn't give us: Escape for manual tooltips (the
    // native popover only auto-closes `auto` popovers), and outside-click +
    // Escape when there's no Popover API at all.
    useEffect(() => {
      if (!open) return
      if (native && kind !== 'tooltip') return
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return
        if (ctx.contentRef.current?.contains(document.activeElement)) {
          ctx.triggerRef.current?.focus()
        }
        ctx.requestOpen(false)
      }
      const onPointerDown = (e: Event) => {
        if (kind === 'tooltip') return
        const target = e.target as Node
        if (
          ctx.contentRef.current?.contains(target) ||
          ctx.triggerRef.current?.contains(target)
        ) {
          return
        }
        ctx.requestOpen(false)
      }
      document.addEventListener('keydown', onKeyDown)
      document.addEventListener('pointerdown', onPointerDown)
      return () => {
        document.removeEventListener('keydown', onKeyDown)
        document.removeEventListener('pointerdown', onPointerDown)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, native, kind])

    // Menus move focus into the list when they open (ARIA menu pattern).
    useEffect(() => {
      if (kind !== 'menu' || !open) return
      menuItems(ctx.contentRef.current)[0]?.focus()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind, open])

    const fallbackHidden = !native && !open
    const props: Record<string, unknown> = {
      ...rest,
      id: contentId,
      popover: kind === 'tooltip' ? 'manual' : 'auto',
      ref: mergeRefs(ref as Ref<unknown>, anchor.floatingProps.ref, (node: unknown) => {
        ctx.contentRef.current = (node as HTMLElement | null) ?? null
      }),
      // `inset: auto` neutralizes the UA popover stylesheet's `inset: 0` so
      // the kit's anchor() insets and anchor-center alignment own the position.
      style: {
        ...style,
        inset: 'auto',
        ...anchor.floatingProps.style,
        ...(fallbackHidden ? { display: 'none' } : null),
      },
    }

    if (kind === 'tooltip') {
      if (props.role === undefined) props.role = 'tooltip'
      // Hovering the tooltip itself keeps it open (cancels a pending close).
      props.onPointerEnter = chain(rest.onPointerEnter, () => ctx.schedule(true))
      props.onPointerLeave = chain(rest.onPointerLeave, () => ctx.schedule(false))
    }

    if (kind === 'menu') {
      if (props.role === undefined) props.role = 'menu'
      props.onKeyDown = chain(rest.onKeyDown, (e: ReactKeyboardEvent) => {
        const items = menuItems(ctx.contentRef.current)
        if (!items.length) return
        const current = items.indexOf(document.activeElement as HTMLElement)
        let next = -1
        switch (e.key) {
          case 'ArrowDown':
            next = current < 0 ? 0 : (current + 1) % items.length
            break
          case 'ArrowUp':
            next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length
            break
          case 'Home':
            next = 0
            break
          case 'End':
            next = items.length - 1
            break
          default:
            return
        }
        e.preventDefault()
        items[next]?.focus()
      })
    }

    return createElement(Tag, props)
  })
  Component.displayName = displayName
  return Component
}

/** The popover's trigger. Renders a `<button>` wired as the native invoker. */
export const PopoverTrigger = createTrigger('PopoverTrigger', 'Popover')
/** The popover panel: `popover="auto"`, anchored, in the top layer. */
export const PopoverContent = createContent('PopoverContent', 'Popover')

/** The tooltip's trigger: opens on hover (with delay) and on focus. */
export const TooltipTrigger = createTrigger('TooltipTrigger', 'Tooltip')
/** The tooltip panel: `popover="manual"`, `role="tooltip"`, Escape to close. */
export const TooltipContent = createContent('TooltipContent', 'Tooltip')

/** The menu's trigger: `aria-haspopup="menu"`, ArrowDown/ArrowUp also open. */
export const MenuTrigger = createTrigger('MenuTrigger', 'Menu')
/** The menu panel: `role="menu"` with ArrowUp/Down/Home/End item navigation. */
export const MenuContent = createContent('MenuContent', 'Menu')

export interface MenuItemProps extends PolymorphicProps {
  /** Close the menu after this item is clicked. Default `true`. */
  closeOnSelect?: boolean
}

/** A `role="menuitem"` entry. Enter/Space activate it like a button. */
export const MenuItem = forwardRef<unknown, MenuItemProps>(function MenuItem(
  { as, closeOnSelect = true, ...rest },
  ref,
) {
  const ctx = usePopoverContext('MenuItem', 'Menu')
  const Tag: ElementType = as ?? 'div'
  return createElement(Tag, {
    ...rest,
    ref,
    role: rest.role ?? 'menuitem',
    tabIndex: rest.tabIndex ?? -1,
    onClick: chain(rest.onClick, () => {
      if (!closeOnSelect) return
      ctx.requestOpen(false)
      ctx.triggerRef.current?.focus()
    }),
    onKeyDown: chain(rest.onKeyDown, (e: ReactKeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).click()
    }),
  })
})
MenuItem.displayName = 'MenuItem'
