<p align="center">
  <a href="https://css-anchor-kit.netlify.app">
    <img src="https://raw.githubusercontent.com/mk668a/css-anchor-kit/main/image.jpg" alt="css-anchor-kit — Floating UI, positioned by the browser, not JavaScript" width="100%">
  </a>
</p>

# css-anchor-kit

**Tooltips and popovers, positioned by the browser — not by JavaScript.**

▶ **[Live demo &amp; interactive docs →](https://css-anchor-kit.netlify.app)**

<p align="center">
  <img src="https://raw.githubusercontent.com/mk668a/css-anchor-kit/main/demo.gif" alt="Tooltip, popover and menu positioned natively by the browser — no JS repositioning on scroll" width="100%">
</p>

A tiny headless React hook for floating elements (tooltips, popovers, dropdowns, menus) built entirely on native [CSS Anchor Positioning](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning). Same ergonomics as [floating-ui](https://floating-ui.com) — `placement`, `offset`, `flip`, arrows — but **no measurement loop, no `requestAnimationFrame`, no reflow on scroll**. The browser does the positioning.

```tsx
import { useAnchor } from 'css-anchor-kit'

function Tooltip() {
  const { anchorProps, floatingProps } = useAnchor({ placement: 'top', offset: 8 })
  return (
    <>
      <button {...anchorProps}>Hover me</button>
      <div {...floatingProps} role="tooltip">Type less. Think more.</div>
    </>
  )
}
```

That's it. No `ref`s to wire, no effect to keep position in sync — `anchorProps`/`floatingProps` are just inline styles that compile to `anchor-name`, `position-anchor`, `anchor()` and `position-try-fallbacks`.

---

## Why

floating-ui is ~28M weekly downloads of JavaScript whose core job — *keep this box next to that box* — [browsers now do natively](https://caniuse.com/css-anchor-positioning). CSS Anchor Positioning reached Baseline in 2026 (Chrome/Edge 125+, Safari 26+, Firefox behind a flag with a solid polyfill). `css-anchor-kit` is the thin headless layer that gives you floating-ui's API and deletes the runtime.

| | floating-ui | css-anchor-kit |
|---|---|---|
| Position computed by | JS, on every scroll/resize | the browser's layout engine |
| Runtime cost | measure → place → `autoUpdate` loop | **none** (it's CSS) |
| Bundle (min+gzip) | ~6–10 KB core + React | **< 1 KB**, React optional |
| Arrow tracks anchor when shifted | needs JS middleware | a sibling anchored to the same element |
| Hover survives the gap | `safePolygon()` — a cursor-tracked triangle, one `pointermove` listener | a rect the browser positions between the two boxes |
| Works without React | yes | yes — [`buildAnchorStyles`](#vanilla--non-react) |

## Install

```sh
npm i css-anchor-kit
```

React 18+ is an **optional** peer dependency — you only need it for the `useAnchor` hook. The framework-agnostic `buildAnchorStyles` core has zero dependencies.

## API

### `useAnchor(options?)`

```ts
const { anchorProps, floatingProps, arrowProps, safeAreaProps, anchorName, supported } = useAnchor({
  placement: 'bottom',  // Side | `${Side}-start` | `${Side}-end`, default 'bottom'
  offset:    0,         // gap in px, default 0
  flip:      true,      // flip to the opposite side on overflow, default true
  hide:      false,     // hide when the anchor scrolls out of view, default false
  size:      false,     // match the anchor's size: 'width' | 'height' | true, default false
  strategy:  'fixed',   // 'fixed' | 'absolute', default 'fixed'
  safeArea:  false,     // hoverable corridor across the offset gap, default false
})
```

Returns:

| field | type | use |
|---|---|---|
| `anchorProps` | `{ style }` | spread on the reference element |
| `floatingProps` | `{ style }` | spread on the floating element |
| `arrowProps` | `{ style }` | spread on an optional arrow element (a **sibling** of the floating one) |
| `safeAreaProps` | `{ style }` | spread on an optional [safe area](#safe-area-the-safepolygon-problem) (a **child** of the floating one) |
| `anchorName` | `string` | the generated `--cak-*` dashed-ident (for hand-written CSS) |
| `supported` | `boolean` | `false` during SSR + first paint, then reflects browser support |

`useAnchor` **only computes position**. You stay in control of visibility and interaction — pair it with the native [`popover`](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) attribute, a hover/focus state, or your own `useState`.

### Placements

The 12 floating-ui placements, mapped to native CSS:

```
top      top-start      top-end
bottom   bottom-start   bottom-end
left     left-start     left-end
right    right-start    right-end
```

Centered placements use `justify-self / align-self: anchor-center`. `-start` / `-end` pin the matching **logical** edges (`inset-inline-*` / `inset-block-*`) with `anchor()`, so alignment follows the writing direction automatically — in RTL, `bottom-start` aligns to the right edge, matching floating-ui, with zero JS. `flip` emits `position-try-fallbacks`.

### Match the anchor's size

`size` sets the floating element's dimensions from the anchor via `anchor-size()` — handy for select/combobox popovers that should be exactly as wide as their trigger:

```tsx
const { anchorProps, floatingProps } = useAnchor({ placement: 'bottom', size: 'width' })
// floatingProps.style.width === 'anchor-size(width)'  →  matches the trigger width
```

`'width'` / `'height'` match one axis; `true` matches both.

### Components (optional)

If you prefer composition over spreading props, opt into the headless components — thin sugar over the hook:

```tsx
import { Anchored, Anchor, Floating, Arrow } from 'css-anchor-kit'

<Anchored placement="top" offset={8}>
  <Anchor as="button">Hover me</Anchor>
  <Floating role="tooltip">Type less. Think more.</Floating>
  <Arrow className="arrow" />
</Anchored>
```

`<Anchored>` runs `useAnchor` and shares it via context; `<Anchor>`/`<Floating>`/`<Arrow>`/[`<SafeArea>`](#safe-area-the-safepolygon-problem) are polymorphic (`as` prop, default `div`) and spread the matching props. The hook stays the primary API — components are pure DX sugar and tree-shake away if unused.

### Popover, Tooltip, Menu — the interaction half

`useAnchor` answers *where*; these components answer *when* — and they outsource that to the platform too, via the native [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) (Baseline 2025). Top layer (no portal, no `z-index`), light dismiss, Escape, and focus restore all come from the browser, not from event-listener JS:

```tsx
import { Popover, PopoverTrigger, PopoverContent, Arrow } from 'css-anchor-kit'

<Popover placement="bottom-start" offset={6}>
  <PopoverTrigger>Open</PopoverTrigger>
  <PopoverContent className="card">
    Click outside or press Esc — the browser closes it.
    <Arrow className="arrow" />
  </PopoverContent>
</Popover>
```

Three flavors share one engine:

| | visibility driven by | `popover` mode | extras |
|---|---|---|---|
| `Popover` | trigger click (native invoker) | `auto` — light dismiss | controlled via `open` / `onOpenChange`, `defaultOpen` |
| `Tooltip` | hover (`openDelay`/`closeDelay`) + focus | `manual` | `role="tooltip"`, `aria-describedby`, Escape to close |
| `Menu` | trigger click / ArrowDown | `auto` | `role="menu"`, ArrowUp/Down/Home/End navigation, `<MenuItem>` |

```tsx
<Tooltip placement="top" offset={8} openDelay={150}>
  <TooltipTrigger>Hover me</TooltipTrigger>
  <TooltipContent className="tip">Type less. Think more.</TooltipContent>
</Tooltip>

<Menu placement="bottom-end">
  <MenuTrigger>Actions</MenuTrigger>
  <MenuContent className="menu">
    <MenuItem onClick={rename}>Rename</MenuItem>
    <MenuItem onClick={remove}>Delete</MenuItem>
  </MenuContent>
</Menu>
```

Still headless: no styles, no classes, every prop forwarded, `as` to change the tag. All root props extend `useAnchor`'s options, so `placement` / `offset` / `flip` / `size` work unchanged. State is uncontrolled by default; pass `open` + `onOpenChange` to control it (light dismiss and Escape report through `onOpenChange` like any other close).

If the Popover API is missing (older browsers, or before hydration), the components degrade gracefully: content is hidden with `display: none` and outside-click/Escape handling falls back to a small JS shim — but it's never *rendered inline* into the page flow. Detect support with `isPopoverSupported()`.

> **The classic popover-CSS gotcha**: visibility belongs to the browser, so the kit never touches `display` on a native popover — which means an *unconditional* `display` in your own CSS (e.g. `.card { display: grid }`) overrides the UA's `[popover]:not(:popover-open) { display: none }` and the closed popover stays visible. Scope layout display to the open state:
>
> ```css
> .card:popover-open { display: grid; }   /* not: .card { display: grid } */
> ```



### Arrow

The arrow is a sibling element anchored to the **same** anchor, so it stays centered on the anchor even when the floating box is edge-aligned or flips — no JS middleware:

```tsx
const { anchorProps, floatingProps, arrowProps } = useAnchor({ placement: 'top', offset: 8 })
return (
  <>
    <button {...anchorProps}>Menu</button>
    <div {...floatingProps} className="popover">…</div>
    <div {...arrowProps} className="arrow" />
  </>
)
```

### Safe area (the `safePolygon` problem)

Give a floating element an `offset` and you carve out a gap that belongs to neither box. Move the pointer diagonally toward the card and it lands on nothing, so the card closes exactly as you reach for it. floating-ui answers this with `safePolygon()`: a cursor-tracked triangle rebuilt on every `pointermove`.

CSS can't read the pointer — but it doesn't have to. The corridor between two boxes is a **rectangle**, and rectangles are what `anchor()` is good at. Turn on `safeArea` and render the safe area **inside** the floating element:

```tsx
import { Tooltip, TooltipTrigger, TooltipContent, SafeArea } from 'css-anchor-kit'

<Tooltip placement="right" offset={24} safeArea>
  <TooltipTrigger className="btn">Hover me</TooltipTrigger>
  <TooltipContent className="card">
    <SafeArea />          {/* transparent, no children — just a hover target */}
    Reachable across the gap.
  </TooltipContent>
</Tooltip>
```

It compiles to one more `anchor-name` (on the floating element) and a rect spanning both:

```css
/* placement 'right' → the gap runs along the inline axis, the block axis covers both boxes */
left:   min(anchor(--a right), anchor(--f right));
right:  min(anchor(--a left),  anchor(--f left));
top:    min(anchor(--a top),    anchor(--f top));
bottom: min(anchor(--a bottom), anchor(--f bottom));
```

Every edge is a `min()` of the *same* edge on both boxes — `min(anchor(--a right), anchor(--f right))` reads as "whichever box sits further left" — so the corridor stays right after a native `flip`, with no JS deciding anything. [Live demo →](https://css-anchor-kit.netlify.app/#safe-area)

**With the bare hook**, you own visibility, so let the close wait one task: the browser fires `pointerleave` on the trigger *before* `pointerenter` on the safe area, and an immediate close would hide the corridor before it could catch anything. (`<Tooltip>` already does this for you.)

```tsx
const { anchorProps, floatingProps, safeAreaProps } = useAnchor({
  placement: 'right', offset: 24, safeArea: true,
})
const openNow   = () => { clearTimeout(timer.current); setOpen(true) }
const closeSoon = () => { timer.current = setTimeout(() => setOpen(false), 0) }

<button {...anchorProps} onPointerEnter={openNow} onPointerLeave={closeSoon}>Hover me</button>
{open && (
  <div {...floatingProps} onPointerEnter={openNow} onPointerLeave={closeSoon}>
    <div {...safeAreaProps} />
    Reachable across the gap.
  </div>
)}
```

One rule the CSS enforces on you, and one honest trade-off:

- The safe area is a **child** of the floating element (the arrow is a sibling — this one isn't). A top-layer popover is only an acceptable anchor for something else in the top layer, and only `position: fixed` keeps the corridor's containing block outside the floating box. Both come free by rendering it inside.
- It's a rect, not a shrinking polygon, so it's *more* forgiving than floating-ui's: any path through the corridor keeps the pair alive, not just one aimed at the card. No cursor tracking means no `buffer` and no intent detection, and while the floating element is open the corridor swallows pointer events over whatever sits between the two boxes.

### Vanilla / non-React

```ts
import { buildAnchorStyles } from 'css-anchor-kit/core'

const { anchor, floating, arrow } = buildAnchorStyles('--my-tooltip', { placement: 'top', offset: 8 })
Object.assign(anchorEl.style, anchor)
Object.assign(floatingEl.style, floating)
```

## Browser support & polyfill

Detect support with the `supported` flag (or `isAnchorPositioningSupported()`), and load the [`@oddbird/css-anchor-positioning`](https://github.com/oddbird/css-anchor-positioning) polyfill for older browsers — it's **BYO and not bundled**, so supporting browsers ship nothing extra:

```tsx
const { supported } = useAnchor()
useEffect(() => {
  if (!supported) import('@oddbird/css-anchor-positioning/fn').then((m) => m.default())
}, [supported])
```

## Migrating from floating-ui

| floating-ui | css-anchor-kit |
|---|---|
| `useFloating({ placement })` | `useAnchor({ placement })` |
| `offset(8)` middleware | `offset: 8` |
| `flip()` middleware | `flip: true` (default) |
| `hide()` middleware | `hide: true` |
| `size()` middleware (match width) | `size: 'width'` / `'height'` / `true` |
| `arrow()` middleware + `ref` | spread `arrowProps` on a sibling |
| `refs.setReference` / `setFloating` | spread `anchorProps` / `floatingProps` |
| `autoUpdate(...)` | — not needed, the browser tracks it |
| `useHover(..., { handleClose: safePolygon() })` | `safeArea: true` + `<SafeArea />` (a rect, not a cursor-tracked polygon) |

### Automated migration (`migrate` codemod)

A jscodeshift codemod does the mechanical 80% of the table above and flags the rest:

```sh
npx css-anchor-kit migrate "src/**/*.{ts,tsx}"   # rewrite in place
npx css-anchor-kit migrate "src/**/*.tsx" --dry --print   # preview only
```

It rewrites `useFloating(...)` → `useAnchor(...)`, maps `offset`/`flip`/`hide`
middleware to options, drops the `autoUpdate` loop, rewires
`ref={refs.setReference}`/`setFloating` to `{...anchorProps}`/`{...floatingProps}`,
and fixes the imports. It also flags `safePolygon()` and points it at `safeArea`.
Anything without a native equivalent — `shift`, `size`,
`autoPlacement`, `inline`, and `arrow` ref-wiring — is left in place with a
`// TODO(css-anchor-kit)` comment rather than silently dropped, so you can finish
those by hand:

```sh
grep -rn "TODO(css-anchor-kit)" src
```

The codemod is a **dev-time CLI only** (it depends on jscodeshift) — it is never
imported by the library, so it has **zero effect on your runtime bundle**.

## Honest limitations

CSS Anchor Positioning is **discrete**, not continuous, so the kit is intentionally not a 1:1 floating-ui clone:

- **`shift`** (continuously *sliding* a popover pixel-by-pixel to stay in view) has **no native equivalent** — the platform's fallback model is discrete (try position A, then B, …), not continuous. `flip` covers the common overflow case natively; if you genuinely need continuous shifting, floating-ui is still the right tool.
- **`autoPlacement`** (pick the best of many sides at runtime) isn't mapped; choose a `placement` + `flip`.
- **`safePolygon()`'s cursor tracking** can't be reproduced — CSS has no way to read the pointer. [`safeArea`](#safe-area-the-safepolygon-problem) covers the same failure with a static rect over the gap, which is more forgiving but has no `buffer` or intent detection.

Everything else floating-ui is used for in the 90% tooltip/popover/menu case — placement, offset, flip, hide, **size**, arrows, and **RTL/logical alignment** — is covered, natively, with no JS in the scroll path.

> Verified in Chrome 152 by [`examples/verify.html`](./examples/verify.html), a geometry harness that asserts real `getBoundingClientRect()` values: all 12 placements position correctly (right side, ~8px gap, logical `-start`/`-end` alignment), `size` matches the anchor, `flip` kicks in on overflow, and the [safe area](#safe-area-the-safepolygon-problem) fills the gap exactly — and is hit-testable — on all four sides.

## Roadmap

- [x] `size` (`anchor-size()`) option
- [x] logical-property / RTL placements
- [x] headless `<Anchor>` / `<Floating>` / `<Arrow>` components
- [x] `npx css-anchor-kit migrate` codemod (floating-ui → css-anchor-kit)
- [x] `<Popover>` / `<Tooltip>` / `<Menu>` on the native Popover API (top layer, light dismiss — no portal JS)
- [x] `safeArea` — floating-ui's `safePolygon()` as a pure-CSS hover corridor
- [ ] discrete `shift` approximation via generated `@position-try` fallback positions (exploration; continuous shift is not expressible in pure CSS)

## License

[MIT](./LICENSE) © mk668a
