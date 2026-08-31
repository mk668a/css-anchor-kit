/**
 * Containing-block traps — the one failure mode native anchor positioning has.
 *
 * `anchor()` itself never breaks: the offset it resolves is always correct.
 * What breaks is *where that offset is measured from*. A floating element is
 * `position: fixed`, so its containing block is normally the viewport — but a
 * handful of ancestor declarations (`transform`, `filter`, `contain`,
 * `content-visibility`, `container-type`, …) capture fixed descendants and
 * become the containing block themselves. Two things follow:
 *
 * 1. **Clamping.** `position-try-fallbacks` (flip) and `anchor-center` are
 *    resolved against that ancestor's box instead of the viewport, so the
 *    floating element gets held inside it — a centered tooltip stops being
 *    centered once it would stick out.
 * 2. **Clipping.** If that same ancestor also clips (`contain: paint`,
 *    `content-visibility`, or `overflow` other than `visible`), the floating
 *    element is cut away entirely and looks like it never rendered.
 *
 * The fix is always the same: put the floating element in the **top layer**
 * (`<Popover>` / `<Tooltip>` / `<Menu>`, or the `popover` attribute by hand),
 * which escapes every ancestor. This module finds the trap so the kit can say
 * so out loud in development instead of leaving you to bisect your CSS.
 *
 * Verified against Chrome by `examples/verify.html`.
 */

/** The parts of a computed style this module reads. `getComputedStyle` fits. */
export interface StyleReader {
  getPropertyValue(property: string): string
}

/** Reads an element's computed style. Injectable so tests don't need a layout engine. */
export type ReadStyle = (element: Element) => StyleReader

export interface ContainingBlockTrap {
  /** The ancestor that captured the floating element. */
  element: Element
  /** The declaration that captured it, e.g. `'contain'` or `'transform'`. */
  property: string
  /** That declaration's computed value, e.g. `'paint'`. */
  value: string
  /**
   * Whether the same ancestor also clips its overflow. When `true` the floating
   * element doesn't just get clamped — it disappears.
   */
  clips: boolean
  /** The clipping declaration, when `clips` is true (e.g. `'overflow: hidden'`). */
  clipReason?: string
}

/** `will-change` hints that pre-emptively create a containing block. */
const WILL_CHANGE_TRAPS = ['transform', 'perspective', 'filter', 'backdrop-filter', 'contain']

/** `contain` keywords that make an element a containing block for fixed descendants. */
const CONTAIN_TRAPS = ['layout', 'paint', 'strict', 'content']

/** `contain` keywords that also clip. `content` is layout+paint+style. */
const CONTAIN_CLIPS = ['paint', 'strict', 'content']

/** `content-visibility` values that apply containment. */
const CONTENT_VISIBILITY_TRAPS = ['auto', 'hidden']

function has(value: string, keywords: string[]): boolean {
  const parts = value.split(/\s+/)
  return keywords.some((k) => parts.includes(k))
}

/**
 * Which declaration, if any, makes this element the containing block for its
 * `position: fixed` descendants. Returns the *first* one found, in rough order
 * of how often it's the real culprit.
 */
function capturesFixed(style: StyleReader): { property: string; value: string } | null {
  const get = (p: string) => style.getPropertyValue(p) || ''

  for (const property of ['transform', 'translate', 'rotate', 'scale', 'perspective', 'filter']) {
    const value = get(property)
    // `translate`/`rotate`/`scale` compute to `none` when unset; an engine that
    // doesn't know the property returns '' — both mean "not a trap".
    if (value && value !== 'none') return { property, value }
  }

  const backdrop = get('backdrop-filter') || get('-webkit-backdrop-filter')
  if (backdrop && backdrop !== 'none') return { property: 'backdrop-filter', value: backdrop }

  const willChange = get('will-change')
  if (willChange && has(willChange.replace(/,/g, ' '), WILL_CHANGE_TRAPS)) {
    return { property: 'will-change', value: willChange }
  }

  const contain = get('contain')
  if (contain && has(contain, CONTAIN_TRAPS)) return { property: 'contain', value: contain }

  const contentVisibility = get('content-visibility')
  if (CONTENT_VISIBILITY_TRAPS.includes(contentVisibility)) {
    return { property: 'content-visibility', value: contentVisibility }
  }

  // Deliberately NOT listed: `container-type`. Reading the spec you'd expect a
  // query container to capture (it applies layout containment), but measured in
  // Chrome 152 no value of `container-type` — nor `contain: size | style |
  // inline-size` — moves the containing block. Warning about it would be a
  // false positive on a very common declaration. See examples/verify.html.
  return null
}

/** Whether this element clips what overflows it, and which declaration does it. */
function clipsOverflow(style: StyleReader): string | null {
  const get = (p: string) => style.getPropertyValue(p) || ''

  const contain = get('contain')
  if (contain && has(contain, CONTAIN_CLIPS)) return `contain: ${contain}`

  const contentVisibility = get('content-visibility')
  if (CONTENT_VISIBILITY_TRAPS.includes(contentVisibility)) {
    return `content-visibility: ${contentVisibility}`
  }

  for (const property of ['overflow-x', 'overflow-y']) {
    const value = get(property)
    if (value && value !== 'visible') return `${property}: ${value}`
  }

  return null
}

/** Walk the flat tree, so a shadow boundary doesn't hide the trap. */
function flatParent(element: Element): Element | null {
  if (element.parentElement) return element.parentElement
  const root = element.parentNode as ShadowRoot | null
  return root && 'host' in root ? (root.host as Element) : null
}

const defaultReadStyle: ReadStyle = (element) => getComputedStyle(element)

/**
 * Find the nearest ancestor of `anchor` that captures `position: fixed`
 * descendants — the reason a floating element ends up clamped inside a panel or
 * invisible altogether. Returns `null` when the chain is clean.
 *
 * Only meaningful for the default `strategy: 'fixed'`. With
 * `strategy: 'absolute'` the floating element is bound to the nearest
 * *positioned* ancestor by design, which is a much wider net and your choice.
 *
 * ```ts
 * const trap = findContainingBlockTrap(buttonEl)
 * if (trap?.clips) console.warn('tooltip will be clipped by', trap.element)
 * ```
 *
 * @param readStyle override the style source (tests, or a cached reader).
 */
export function findContainingBlockTrap(
  anchor: Element | null | undefined,
  readStyle: ReadStyle = defaultReadStyle,
): ContainingBlockTrap | null {
  if (!anchor) return null

  let element = flatParent(anchor)
  while (element) {
    const style = readStyle(element)
    const capture = capturesFixed(style)
    if (capture) {
      const clipReason = clipsOverflow(style)
      return {
        element,
        property: capture.property,
        value: capture.value,
        clips: clipReason !== null,
        ...(clipReason ? { clipReason } : null),
      }
    }
    element = flatParent(element)
  }

  return null
}

/**
 * Whether this element is (or will be) in the top layer, which escapes every
 * containing-block trap. An element carrying `popover` in a browser that
 * implements the Popover API is promoted out of the ancestor chain when shown.
 */
function isTopLayer(floating: Element): boolean {
  return (
    floating.hasAttribute('popover') &&
    typeof (floating as HTMLElement & { showPopover?: unknown }).showPopover === 'function'
  )
}

/** Warn at most once per anchor element, so re-renders and StrictMode stay quiet. */
const warned = new WeakSet<Element>()

const DOCS = 'https://github.com/mk668a/css-anchor-kit#containing-block-traps'

/**
 * Development-time diagnostic: log the trap that will misplace or hide this
 * floating element, with the offending ancestor attached for inspection.
 *
 * Called by `useAnchor` behind a `process.env.NODE_ENV` check, so production
 * bundles drop it. Safe to call yourself in a vanilla setup.
 */
export function warnContainingBlockTrap(
  anchor: Element | null | undefined,
  floating: Element | null | undefined,
  readStyle: ReadStyle = defaultReadStyle,
): ContainingBlockTrap | null {
  if (!anchor || !floating || warned.has(anchor)) return null
  // The top layer is the fix, so there's nothing to report when it's in use.
  if (isTopLayer(floating)) return null

  const trap = findContainingBlockTrap(anchor, readStyle)
  if (!trap) return null
  warned.add(anchor)

  const decl = `${trap.property}: ${trap.value}`
  const effect = trap.clips
    ? `it also clips (${trap.clipReason}), so the floating element is cut away and looks like it never rendered`
    : 'flip and anchor-center are resolved against that box instead of the viewport, so the floating element gets clamped inside it'

  console.warn(
    `[css-anchor-kit] The anchor is inside an ancestor with \`${decl}\`, which becomes the ` +
      `containing block for \`position: fixed\` — ${effect}.\n` +
      `Fix: render the floating element in the top layer — use <Popover>/<Tooltip>/<Menu>, ` +
      `or add the \`popover\` attribute and call showPopover(). See ${DOCS}`,
    trap.element,
  )

  return trap
}
