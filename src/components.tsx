/**
 * Optional headless components — thin sugar over {@link useAnchor}.
 *
 * `<Anchored>` runs the hook and shares its result via context; `<Anchor>`,
 * `<Floating>` and `<Arrow>` are polymorphic elements that spread the matching
 * props. Styling and visibility stay entirely yours.
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

type PolymorphicProps = {
  /** The element/component to render. Default `'div'`. */
  as?: ElementType
  style?: CSSProperties
  // `any` index keeps named members precise while letting consumers pass any
  // DOM props (className, role, onClick, data-*, …) straight through.
  [key: string]: any
}

/** Build a polymorphic component that spreads one slot's props (merging style). */
function slot(slotKey: 'anchorProps' | 'floatingProps' | 'arrowProps', displayName: string) {
  const Component = forwardRef<unknown, PolymorphicProps>(function Slot(
    { as, style, ...rest },
    ref,
  ) {
    const ctx = useAnchorContext(displayName)
    const props = ctx[slotKey]
    const Tag: ElementType = as ?? 'div'
    return createElement(Tag, {
      ref: ref as Ref<unknown>,
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
/** An optional arrow (a sibling of the floating element). Spreads `arrowProps`. */
export const Arrow = slot('arrowProps', 'Arrow')
