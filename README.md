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
| Arrow stays on the anchor when the box is edge-aligned | needs JS middleware | a child of the floating element, positioned by `anchor()` |
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
  boundary:  null,      // opt-in JS flip: a scroll container, or 'viewport'
})
```

Returns:

| field | type | use |
|---|---|---|
| `anchorProps` | `{ style }` | spread on the reference element |
| `floatingProps` | `{ style }` | spread on the floating element |
| `arrowProps` | `{ style }` | spread on an optional arrow element — a **child** of the floating one |
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

Render the arrow **inside** the floating element. Give it a size and a background; the kit centres its box on whichever edge faces the anchor, so exactly half of it pokes out:

```tsx
const { anchorProps, floatingProps, arrowProps } = useAnchor({ placement: 'top', offset: 8 })
return (
  <>
    <button {...anchorProps}>Menu</button>
    <div {...floatingProps} className="popover">
      <div {...arrowProps} className="arrow" aria-hidden />
      …
    </div>
  </>
)
```

```css
.arrow {
  width: 16px;
  height: 16px;
  background: #fff;
  /* The kit centres the *box* on the edge, so the triangle takes the outer half
     of it: base on the edge, tip pointing at the anchor. */
  clip-path: polygon(50% 0, 100% 50%, 0 50%);   /* pointing up */
}
```

Three things fall out of that:

- **It stays centred on the anchor** even when the floating box is edge-aligned (`bottom-start` and friends) — that's what the JS `arrow()` middleware is for elsewhere.
- **It's centred on the edge at any size.** Half the box sits inside the surface and half outside, so nothing hand-tunes a nudge and nothing breaks when you change the arrow's size. A rotated square (`rotate: 45deg`, no `clip-path`) works too — its visible half is the same triangle — but don't tuck either one with `transform`: `transform` composes *after* `rotate`, so a `translateY` on a 45°-rotated square travels diagonally instead of straight. (`translate` is applied *before* `rotate` — use that to slide the arrow along its edge.)
- **It paints above the surface, not under it** — which is why it's a child and not a sibling. A child paints on top of its parent's background *and* its parent's `box-shadow`; a preceding sibling gets that shadow smeared across it and reads as a dirty grey chip. Being a child also means the arrow rides into the top layer with a `popover` floating element — a sibling out there isn't an acceptable anchor for it at all, and lands thousands of px away.

Reset the popover's UA border. The UA stylesheet gives every `[popover]` `border: solid`, which computes to **3px of `currentColor`** — a near-black ring on a light surface, sitting exactly between the arrow's base (which lands on the border box) and the surface's fill, so an un-reset popover looks like there's a gap between the two. The kit neutralises the UA `inset`/`margin` because those break positioning; `border`, `padding` and `background` are yours to set.

Give the arrow a **flat** background. A gradient is painted relative to each element's own box, so the same `linear-gradient` on a 16px arrow squeezes the whole ramp into 16px and stops matching the surface behind it — and the mismatch slides around as the arrow moves along the edge. `background-attachment: fixed` would give both boxes one shared origin, but the arrow is `position: fixed`, which resolves that against itself. Pick a solid colour from the gradient, or keep gradient surfaces arrowless.

On a surface with a border, carry that outline across the notch the arrow punches in it. A `border` can't do it on a clipped element — the clip cuts the border off — so use a `drop-shadow` of the triangle's own silhouette, nudged 1px away from the surface so only the two sloped edges show it. **Cut the shape on a child, and filter the parent**: `clip-path` is applied *after* `filter`, so a `drop-shadow` on the same box is clipped away with everything else outside the triangle, and you get no outline at all.

```css
.arrow::before {
  content: '';
  display: block;
  width: 100%;
  height: 100%;
  background: var(--surface);
  clip-path: polygon(50% 0, 100% calc(50% + 1px), 0 calc(50% + 1px));
}
.arrow { filter: drop-shadow(0 -1px 0 var(--border)); }   /* pointing up */
```

(The base runs 1px past the edge on purpose: landing it exactly on the edge leaves both shapes antialiasing the same fractional coordinate, and the hairline neither covers reads as a gap. With a rotated square instead of a clip, put a border on the two edges that stick out — after a 45° rotation the tip is the square's top-left corner, so an up-pointing arrow is outlined by its `border-top` and `border-left`.)

The arrow is pinned to the **anchor**, not to the floating box, so a *native* `flip` moves the box out from under it. Measuring off the floating element instead is the obvious fix and it demos beautifully — but `anchor()` naming a second, `position: fixed` element is resolved against stale coordinates by both engines in cases far more common than a flip (see [limitations](#honest-limitations)), so the kit doesn't.

**If you render an arrow and want flipping, pass `boundary: 'viewport'`.** That takes the same decision CSS would, but in JS, so the hook knows about it — the returned `placement` reports the effective side and every emitted style, arrow included, is rebuilt for it. It costs one throttled scroll/resize listener, and it's the same escape hatch as flipping inside a scroll container:

```tsx
const { arrowProps, placement } = useAnchor({ placement: 'bottom', offset: 10, boundary: 'viewport' })
// `placement` is 'top' once the box has flipped — use it to pick the arrow's direction class
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

- The safe area is a **child** of the floating element, for the same reasons as [the arrow](#arrow). A top-layer popover is only an acceptable anchor for something else in the top layer, and only `position: fixed` keeps the corridor's containing block outside the floating box. Both come free by rendering it inside.
- It's a rect, not a shrinking polygon, so it's *more* forgiving than floating-ui's: any path through the corridor keeps the pair alive, not just one aimed at the card. No cursor tracking means no `buffer` and no intent detection, and while the floating element is open the corridor swallows pointer events over whatever sits between the two boxes.

### Vanilla / non-React

```ts
import { buildAnchorStyles } from 'css-anchor-kit/core'

const { anchor, floating, arrow } = buildAnchorStyles('--my-tooltip', { placement: 'top', offset: 8 })
Object.assign(anchorEl.style, anchor)
Object.assign(floatingEl.style, floating)
```

## Containing-block traps

The one thing that breaks native anchor positioning isn't `anchor()` — it's *where `anchor()` measures from*. A floating element is `position: fixed`, so its containing block is normally the viewport. A handful of ancestor declarations capture fixed descendants and become the containing block instead, and the floating element is stuck inside that ancestor's box:

- **Clamping** — `flip` and `anchor-center` are resolved against that box instead of the viewport, so a centered tooltip stops being centered the moment it would stick out.
- **Clipping** — if the same ancestor also clips, the floating element is cut away and looks like it never rendered. This is the one that costs an afternoon: nothing errors, the element is in the DOM, its rect is correct, and you see nothing.

Measured in Chrome 152 by [`examples/verify.html`](./examples/verify.html):

| ancestor declaration | captures `fixed` | also clips |
|---|---|---|
| `transform` / `translate` / `rotate` / `scale` / `perspective` | yes | no |
| `filter` / `backdrop-filter` | yes | no |
| `will-change: transform \| filter \| perspective \| contain` | yes | no |
| `contain: layout` | yes | no |
| `contain: paint` / `strict` / `content` | yes | **yes** |
| `content-visibility: auto \| hidden` | yes | **yes** |
| any of the above **+ `overflow` other than `visible`** | yes | **yes** |
| `overflow: hidden` on its own | no | no |
| `container-type` (any value), `contain: size \| style \| inline-size` | no | no |

The last row is worth knowing: a query container reads like a trap and isn't one. `overflow: hidden` alone isn't one either — a fixed element whose containing block is the viewport isn't the scroller's descendant to clip.

### The fix: the top layer

`<Popover>` / `<Tooltip>` / `<Menu>` put the panel in the **top layer**, which leaves the ancestor chain entirely. All 13 cases above pass with the panel in the top layer — same 8px gap, still centered, never clipped. If you're rendering a floating element inside an editor, a virtualized list, a `contain`ed card, or anything with a transform on it, [use those components](#popover-tooltip-menu--the-interaction-half) rather than `useAnchor` + your own visibility toggle.

### The kit tells you

`useAnchor` walks the anchor's ancestors once, on mount, and warns when it finds a trap — with the offending element attached so devtools can highlight it:

```
[css-anchor-kit] The anchor is inside an ancestor with `contain: paint`, which becomes the
containing block for `position: fixed` — it also clips (contain: paint), so the floating
element is cut away and looks like it never rendered.
Fix: render the floating element in the top layer — use <Popover>/<Tooltip>/<Menu>, or add
the `popover` attribute and call showPopover().
```

The check is behind a bare `process.env.NODE_ENV`, so bundlers fold the branch away and tree-shake the whole diagnostic — about 1 KB of message strings that never reaches a production build (verified with esbuild's `define`). It also stays quiet when the floating element is already in the top layer, and when you asked for `strategy: 'absolute'` — there, binding to an ancestor is the point.

The same walk is exported if you want it in a test or a vanilla setup — React not required:

```ts
import { findContainingBlockTrap } from 'css-anchor-kit/containing-block'

const trap = findContainingBlockTrap(buttonEl)
// → { element, property: 'contain', value: 'paint', clips: true, clipReason: 'contain: paint' } | null
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
| `arrow()` middleware + `ref` | spread `arrowProps` on a child of the floating element |
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
- **An ancestor can still capture the floating element.** `transform`, `contain` and friends move the containing block out from under it — see [containing-block traps](#containing-block-traps). Not a limitation of the kit so much as of `position: fixed`, but it's the failure everyone hits, so the kit detects it and the top layer solves it.
- **`safePolygon()`'s cursor tracking** can't be reproduced — CSS has no way to read the pointer. [`safeArea`](#safe-area-the-safepolygon-problem) covers the same failure with a static rect over the gap, which is more forgiving but has no `buffer` or intent detection.
- **The arrow doesn't follow a native `flip`.** It's positioned off the anchor, so when `position-try-fallbacks` throws the floating box to the other side, the arrow stays put. The tempting fix — measure off the floating element, which *does* move — needs an `anchor()` that names a second, `position: fixed` element, and neither engine resolves that reliably: Chrome returns document-space coordinates for anything mounted on an already-scrolled page (a tooltip opening halfway down a page — off by the scroll offset), and Safari misses it inside a [containing-block trap](#containing-block-traps). Pay for it with `boundary: 'viewport'` (JS flip, reports the effective `placement`, one throttled listener) or with `flip: false`, not with a positioning bug.
- **Safari drifts a `position: fixed` child of an *open top-layer* popover on scroll.** The arrow and the safe area are exactly that. Scroll the page while a `popover` is open and Safari doesn't re-run the anchor scroll adjustment for them, so they slide by the scroll distance while the popover itself stays correctly anchored — a `<Popover>` left open across a scroll ends up with its arrow floating in the gap. Measured: Chrome 152 holds at 0px through any scroll; WebKit 26.5 is off by exactly the scroll delta. The blast radius is only the top layer — a plain `position: fixed` floating element (no `popover` attribute) is exact in both engines at any scroll — and nothing about it is new: v1.3.0's arrow drifts identically. There is no CSS-only way around it: the arrow has to point at the anchor, an `anchor()` needs the containing block to be the viewport to do that, and that is the very thing Safari fails to re-adjust. Until it's fixed, either accept it, or close the popover on scroll in your own code.

Everything else floating-ui is used for in the 90% tooltip/popover/menu case — placement, offset, flip, hide, **size**, arrows, and **RTL/logical alignment** — is covered, natively, with no JS in the scroll path.

> Verified in **Chrome 152 and Safari 26 (WebKit 26.5)** by [`examples/verify.html`](./examples/verify.html), a geometry harness that asserts real `getBoundingClientRect()` values: all 12 placements position correctly (right side, ~8px gap, logical `-start`/`-end` alignment), `size` matches the anchor, `flip` kicks in on overflow, the [safe area](#safe-area-the-safepolygon-problem) fills the gap exactly — and is hit-testable — on all four sides, the [arrow](#arrow) sits centred on the surface's facing edge at every placement and at any arrow size, stays centred on the anchor, and is painted above the surface — including when it is mounted on an already-scrolled page, which is where a stale `anchor()` shows up — and all 13 [containing-block traps](#containing-block-traps) behave as documented (both the browser's outcome and the detector's prediction), before and after the top layer fixes them. Open it at a viewport of at least 1400×900; it needs the room to scroll each pair into the middle of the screen.

## Roadmap

- [x] `size` (`anchor-size()`) option
- [x] logical-property / RTL placements
- [x] headless `<Anchor>` / `<Floating>` / `<Arrow>` components
- [x] `npx css-anchor-kit migrate` codemod (floating-ui → css-anchor-kit)
- [x] `<Popover>` / `<Tooltip>` / `<Menu>` on the native Popover API (top layer, light dismiss — no portal JS)
- [x] `safeArea` — floating-ui's `safePolygon()` as a pure-CSS hover corridor
- [x] [containing-block trap](#containing-block-traps) detection — a dev-time warning, and `findContainingBlockTrap()` for your own tests
- [ ] discrete `shift` approximation via generated `@position-try` fallback positions (exploration; continuous shift is not expressible in pure CSS)

## License

[MIT](./LICENSE) © mk668a
