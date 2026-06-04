# css-anchor-kit — React example

A runnable Vite + React 19 demo of [`css-anchor-kit`](../../), showing both APIs:

| Demo | API used | Features shown |
| --- | --- | --- |
| **Tooltip** | `useAnchor` hook | `placement`, `offset`, arrow, hover/focus visibility |
| **Dropdown** | `<Anchored>/<Anchor>/<Floating>` | native Popover API, `size="width"` (`anchor-size()`) |
| **Playground** | `useAnchor` hook | live `placement` / `offset` / `flip` / `hide` |

Every position is computed by the browser from inline `anchor-name` /
`position-anchor` / `anchor()` styles — there is no JS measurement loop.

## Run

```bash
cd examples/react
npm install
npm run dev
```

The demo imports `css-anchor-kit` directly from the library source
(`../../src`) via a Vite alias, so changes to the kit show up instantly with no
build or `npm link` step.

## Browser support

CSS Anchor Positioning ships in Chromium 125+. In other browsers the demo shows
a banner — load the
[`@oddbird/css-anchor-positioning`](https://github.com/oddbird/css-anchor-positioning)
polyfill (BYO, not bundled) to see positions resolve.
