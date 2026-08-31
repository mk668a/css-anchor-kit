import { describe, expect, it, vi } from 'vitest'
import {
  findContainingBlockTrap,
  warnContainingBlockTrap,
  type ReadStyle,
} from './containingBlock'

/**
 * happy-dom has no layout engine and drops properties like `contain`, so the
 * style source is stubbed: the tree is real, the computed values are declared
 * here per element via a `data-style` attribute.
 */
const readStyle: ReadStyle = (el) => {
  const declared = Object.fromEntries(
    (el.getAttribute('data-style') ?? '')
      .split(';')
      .filter(Boolean)
      .map((decl) => {
        const i = decl.indexOf(':')
        return [decl.slice(0, i).trim(), decl.slice(i + 1).trim()]
      }),
  )
  return { getPropertyValue: (property) => declared[property] ?? '' }
}

/** Build a chain `<div>…<div><button>` from outermost to innermost styles. */
function chain(...styles: string[]): HTMLElement {
  let outer = document.createElement('div')
  const root = outer
  for (const style of styles) {
    const el = document.createElement('div')
    el.setAttribute('data-style', style)
    outer.append(el)
    outer = el
  }
  const anchor = document.createElement('button')
  outer.append(anchor)
  document.body.append(root)
  return anchor
}

describe('findContainingBlockTrap', () => {
  it('returns null for a clean ancestor chain', () => {
    expect(findContainingBlockTrap(chain('', 'color: red'), readStyle)).toBeNull()
  })

  it('returns null without an anchor', () => {
    expect(findContainingBlockTrap(null, readStyle)).toBeNull()
  })

  it.each([
    ['transform: translateZ(0)', 'transform'],
    ['translate: 0 10px', 'translate'],
    ['rotate: 45deg', 'rotate'],
    ['scale: 1.5', 'scale'],
    ['perspective: 100px', 'perspective'],
    ['filter: blur(2px)', 'filter'],
    ['backdrop-filter: blur(2px)', 'backdrop-filter'],
    ['will-change: transform', 'will-change'],
    ['contain: layout', 'contain'],
    ['contain: paint', 'contain'],
    ['contain: strict', 'contain'],
    ['content-visibility: auto', 'content-visibility'],
  ])('detects %s', (style, property) => {
    const trap = findContainingBlockTrap(chain(style), readStyle)
    expect(trap?.property).toBe(property)
  })

  it.each([
    ['transform: none'],
    ['translate: none'],
    ['filter: none'],
    ['contain: none'],
    ['contain: size style'], // neither layout nor paint — fixed still escapes
    ['contain: inline-size'],
    ['content-visibility: visible'],
    // Measured in Chrome 152: a query container does NOT capture fixed
    // descendants, despite the spec's layout containment. Warning here would
    // fire on half the pages that use container queries.
    ['container-type: inline-size'],
    ['container-type: size'],
    ['will-change: opacity'],
    ['overflow-y: auto'], // clips, but a fixed element isn't its descendant
  ])('ignores %s', (style) => {
    expect(findContainingBlockTrap(chain(style), readStyle)).toBeNull()
  })

  it('reports the nearest trap, not the outermost', () => {
    const trap = findContainingBlockTrap(
      chain('transform: translateZ(0)', 'contain: paint'),
      readStyle,
    )
    expect(trap?.property).toBe('contain')
  })

  it.each([
    ['contain: paint', 'contain: paint'],
    ['contain: strict', 'contain: strict'],
    ['contain: content', 'contain: content'],
    ['content-visibility: auto', 'content-visibility: auto'],
    ['transform: translateZ(0); overflow-x: hidden', 'overflow-x: hidden'],
    ['transform: translateZ(0); overflow-y: clip', 'overflow-y: clip'],
  ])('flags %s as clipping', (style, clipReason) => {
    const trap = findContainingBlockTrap(chain(style), readStyle)
    expect(trap?.clips).toBe(true)
    expect(trap?.clipReason).toBe(clipReason)
  })

  it('does not flag a capturing ancestor that lets overflow through', () => {
    const trap = findContainingBlockTrap(chain('transform: translateZ(0)'), readStyle)
    expect(trap?.clips).toBe(false)
    expect(trap?.clipReason).toBeUndefined()
  })

  it('only clips when the *capturing* ancestor is the one that clips', () => {
    // The overflow lives outside the transform, so the floating element is
    // bound to the transform's box but not cut by the outer scroller.
    const trap = findContainingBlockTrap(
      chain('overflow-y: auto', 'transform: translateZ(0)'),
      readStyle,
    )
    expect(trap?.property).toBe('transform')
    expect(trap?.clips).toBe(false)
  })

  it('crosses a shadow boundary to find the trap on the host', () => {
    const host = document.createElement('div')
    host.setAttribute('data-style', 'contain: paint')
    document.body.append(host)
    const root = host.attachShadow({ mode: 'open' })
    const anchor = document.createElement('button')
    root.append(anchor)

    expect(findContainingBlockTrap(anchor, readStyle)?.property).toBe('contain')
  })
})

describe('warnContainingBlockTrap', () => {
  const floating = () => document.createElement('div')

  it('warns once per anchor, naming the declaration and the clipping', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const anchor = chain('contain: paint')

    expect(warnContainingBlockTrap(anchor, floating(), readStyle)?.clips).toBe(true)
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toContain('contain: paint')
    expect(warn.mock.calls[0][0]).toContain('cut away')

    // Second mount of the same anchor stays quiet.
    expect(warnContainingBlockTrap(anchor, floating(), readStyle)).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('describes clamping when the trap does not clip', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnContainingBlockTrap(chain('transform: translateZ(0)'), floating(), readStyle)
    expect(warn.mock.calls[0][0]).toContain('clamped')
    warn.mockRestore()
  })

  it('stays quiet for a floating element in the top layer', () => {
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>
    proto.showPopover = () => {}
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const popover = floating()
    popover.setAttribute('popover', 'auto')

    expect(warnContainingBlockTrap(chain('contain: paint'), popover, readStyle)).toBeNull()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
    delete proto.showPopover
  })

  it('still warns for a `popover` element where the API is unsupported', () => {
    // Without the Popover API the kit falls back to display toggling, which
    // stays in the ancestor chain — so the trap is still real.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const popover = floating()
    popover.setAttribute('popover', 'auto')

    expect(warnContainingBlockTrap(chain('contain: paint'), popover, readStyle)).not.toBeNull()
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('stays quiet on a clean chain', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(warnContainingBlockTrap(chain(''), floating(), readStyle)).toBeNull()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
