/**
 * Optional headless components — thin sugar over {@link useAnchor}.
 *
 * `<Anchored>` runs the hook and shares its result via context; `<Anchor>`,
 * `<Floating>`, `<Arrow>` and `<SafeArea>` are polymorphic elements that spread
 * the matching props. Styling and visibility stay entirely yours.
 *
 * ```tsx
 * <Anchored placement="top" offset={8}>
 *   <Anchor as="button">Hover</Anchor>
 *   <Floating role="tooltip">Hi</Floating>
 *   <Arrow className="arrow" />
 * </Anchored>
 * ```
 *
 * These are opt-in: import from `css-anchor-kit` only if you want them. The core
 * hook stays the primary API.
 */
import {
  createContext,
  createElement,
  forwardRef,
  useContext,
  type CSSProperties,
  type ElementType,
  type ReactNode,
  type Ref,
} from 'react'
import { useAnchor, type UseAnchorReturn } from './useAnchor'
import type { AnchorOptions } from './core'

const AnchorContext = createContext<UseAnchorReturn | null>(null)

function useAnchorContext(component: string): UseAnchorReturn {
  const ctx = useContext(AnchorContext)
  if (!ctx) {
    throw new Error(`<${component}> must be rendered inside <Anchored>.`)
  }
  return ctx
}

/**
 * @internal Share an already-created {@link useAnchor} result, so the popover
 * layer (`<Popover>`/`<Tooltip>`/`<Menu>`) can host `<Anchor>`/`<Floating>`/
 * `<Arrow>` without running the hook twice.
 */
export function AnchorProvider({
  value,
  children,
}: {
  value: UseAnchorReturn
  children?: ReactNode
}): ReactNode {
  return createElement(AnchorContext.Provider, { value }, children)
}

export interface AnchoredProps extends AnchorOptions {
  children: ReactNode
}

/** Runs {@link useAnchor} and provides its result to descendant components. */
export function Anchored({ children, ...options }: AnchoredProps): ReactNode {
  const value = useAnchor(options)
  return createElement(AnchorContext.Provider, { value }, children)
}

/** Expose the shared {@link useAnchor} result to custom children. */
export function useAnchored(): UseAnchorReturn {
  return useAnchorContext('useAnchored')
}

export type PolymorphicProps = {
  /** The element/component to render. Default `'div'`. */
  as?: ElementType
  style?: CSSProperties
  // `any` index keeps named members precise while letting consumers pass any
  // DOM props (className, role, onClick, data-*, …) straight through.
  [key: string]: any
}

/** Merge a consumer ref with the kit's internal callback ref (used for boundary flip). */
export function mergeRefs(...refs: Array<Ref<unknown> | undefined>): Ref<unknown> {
  return (node: unknown) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === 'function') ref(node)
      else (ref as { current: unknown }).current = node
    }
  }
}

/** Build a polymorphic component that spreads one slot's props (merging style). */
function slot(
  slotKey: 'anchorProps' | 'floatingProps' | 'arrowProps' | 'safeAreaProps',
  displayName: string,
  /** Slots whose styles are inert unless the matching option is on. */
  requiresSafeArea = false,
) {
  const Component = forwardRef<unknown, PolymorphicProps>(function Slot(
    { as, style, ...rest },
    ref,
  ) {
    const ctx = useAnchorContext(displayName)
    if (requiresSafeArea && !ctx.safeArea) {
      throw new Error(
        `<${displayName}> needs the \`safeArea\` option — e.g. <Anchored safeArea> or <Tooltip safeArea>.`,
      )
    }
    const props = ctx[slotKey]
    // anchorProps/floatingProps carry an internal ref for boundary-scoped flip;
    // merge it with the consumer's ref so both fire. arrowProps has none.
    const internalRef = (props as { ref?: Ref<unknown> }).ref
    const Tag: ElementType = as ?? 'div'
    return createElement(Tag, {
      ref: mergeRefs(ref as Ref<unknown>, internalRef),
      ...rest,
      // The user's own style is kept, but the kit's positioning props come last
      // so they stay authoritative.
      style: { ...style, ...props.style },
    })
  })
  Component.displayName = displayName
  return Component
}

/** The reference element. Spreads `anchorProps`. */
export const Anchor = slot('anchorProps', 'Anchor')
/** The positioned element. Spreads `floatingProps`. */
export const Floating = slot('floatingProps', 'Floating')
/** An optional arrow. Render it **inside** `<Floating>`. Spreads `arrowProps`. */
export const Arrow = slot('arrowProps', 'Arrow')
/**
 * The hover corridor between anchor and floating element — floating-ui's
 * `safePolygon()`, as a rectangle the browser positions. Render it **inside**
 * `<Floating>` (or `<PopoverContent>` / `<TooltipContent>` / `<MenuContent>`)
 * and enable the `safeArea` option; it's transparent and has no children.
 */
export const SafeArea = slot('safeAreaProps', 'SafeArea', true)
