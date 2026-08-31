import { describe, expect, it } from 'vitest'
import { buildAnchorStyles } from './core'

const NAME = '--cak-test'

describe('buildAnchorStyles', () => {
  it('marks the anchor with the anchor-name', () => {
    const { anchor } = buildAnchorStyles(NAME)
    expect(anchor).toEqual({ anchorName: NAME })
  })

  it('defaults to a centered bottom placement, fixed, flip on', () => {
    const { floating } = buildAnchorStyles(NAME)
    expect(floating.position).toBe('fixed')
    expect(floating.positionAnchor).toBe(NAME)
    expect(floating.top).toBe('anchor(bottom)')
    expect(floating.justifySelf).toBe('anchor-center')
    expect(floating.positionTryFallbacks).toBe('flip-block')
    // no cross-axis insets when centered
    expect(floating.left).toBeUndefined()
    expect(floating.right).toBeUndefined()
  })

  it('places top placement above and centered', () => {
    const { floating } = buildAnchorStyles(NAME, { placement: 'top' })
    expect(floating.bottom).toBe('anchor(top)')
    expect(floating.justifySelf).toBe('anchor-center')
  })

  it('uses align-self on inline-axis sides (left/right)', () => {
    const right = buildAnchorStyles(NAME, { placement: 'right' }).floating
    expect(right.left).toBe('anchor(right)')
    expect(right.alignSelf).toBe('anchor-center')
    expect(right.positionTryFallbacks).toBe('flip-inline')

    const left = buildAnchorStyles(NAME, { placement: 'left' }).floating
    expect(left.right).toBe('anchor(left)')
    expect(left.alignSelf).toBe('anchor-center')
  })

  it('pins cross-axis edges (logical, RTL-aware) for -start / -end placements', () => {
    const bs = buildAnchorStyles(NAME, { placement: 'bottom-start' }).floating
    expect(bs.top).toBe('anchor(bottom)')
    expect(bs.insetInlineStart).toBe('anchor(start)')
    expect(bs.justifySelf).toBeUndefined()

    const be = buildAnchorStyles(NAME, { placement: 'bottom-end' }).floating
    expect(be.insetInlineEnd).toBe('anchor(end)')

    const rs = buildAnchorStyles(NAME, { placement: 'right-start' }).floating
    expect(rs.left).toBe('anchor(right)')
    expect(rs.insetBlockStart).toBe('anchor(start)')
  })

  it('matches the anchor size via anchor-size() when size is set', () => {
    expect(buildAnchorStyles(NAME, { size: 'width' }).floating.width).toBe('anchor-size(width)')
    expect(buildAnchorStyles(NAME, { size: 'width' }).floating.height).toBeUndefined()
    expect(buildAnchorStyles(NAME, { size: 'height' }).floating.height).toBe('anchor-size(height)')
    const both = buildAnchorStyles(NAME, { size: true }).floating
    expect(both.width).toBe('anchor-size(width)')
    expect(both.height).toBe('anchor-size(height)')
    // off by default
    expect(buildAnchorStyles(NAME).floating.width).toBeUndefined()
  })

  it('aligned placements offer a perpendicular flip fallback', () => {
    expect(
      buildAnchorStyles(NAME, { placement: 'bottom-start' }).floating
        .positionTryFallbacks,
    ).toBe('flip-block, flip-inline')
    expect(
      buildAnchorStyles(NAME, { placement: 'right-end' }).floating
        .positionTryFallbacks,
    ).toBe('flip-inline, flip-block')
  })

  it('applies offset as a margin on the facing side', () => {
    expect(buildAnchorStyles(NAME, { placement: 'bottom', offset: 8 }).floating.marginTop).toBe('8px')
    expect(buildAnchorStyles(NAME, { placement: 'top', offset: 8 }).floating.marginBottom).toBe('8px')
    expect(buildAnchorStyles(NAME, { placement: 'right', offset: 12 }).floating.marginLeft).toBe('12px')
    expect(buildAnchorStyles(NAME, { placement: 'left', offset: 12 }).floating.marginRight).toBe('12px')
  })

  it('omits margin when offset is 0', () => {
    const { floating, arrow } = buildAnchorStyles(NAME, { offset: 0 })
    expect(floating.marginTop).toBeUndefined()
    expect(floating.margin).toBe('0')
    expect(arrow.marginTop).toBeUndefined()
    expect(arrow.margin).toBe('0')
  })

  it('never puts the offset on the arrow — it rides the floating edge instead', () => {
    // The arrow is positioned off the floating box, which already carries the
    // gap. Re-applying the offset would double it.
    for (const placement of ['top', 'bottom', 'left', 'right'] as const) {
      const { arrow } = buildAnchorStyles(NAME, { placement, offset: 12 })
      expect(arrow.margin).toBe('0')
      for (const side of ['marginTop', 'marginBottom', 'marginLeft', 'marginRight']) {
        expect(arrow[side]).toBeUndefined()
      }
    }
  })

  it('disables flip and toggles hide', () => {
    const { floating } = buildAnchorStyles(NAME, { flip: false, hide: true })
    expect(floating.positionTryFallbacks).toBeUndefined()
    expect(floating.positionVisibility).toBe('anchors-visible')
  })

  it('honors the absolute strategy — but keeps the arrow fixed', () => {
    const { floating, arrow } = buildAnchorStyles(NAME, { strategy: 'absolute' })
    expect(floating.position).toBe('absolute')
    // An absolutely positioned arrow resolves anchor() against its offset
    // parent and lands tens of px off; measured in Chrome and WebKit.
    expect(arrow.position).toBe('fixed')
  })

  it('centers the arrow on the line the floating edge lands on', () => {
    const { arrow } = buildAnchorStyles(NAME, { placement: 'bottom-start', offset: 8 })
    expect(arrow.positionAnchor).toBe(NAME)
    // Both insets name that same line — the sign only flips because `bottom`
    // measures from the other side of the containing block…
    expect(arrow.top).toBe(`calc(anchor(${NAME} bottom) + 8px)`)
    expect(arrow.bottom).toBe(`calc(anchor(${NAME} bottom) - 8px)`)
    // …so self-alignment centers the box on it, at any arrow size.
    expect(arrow.alignSelf).toBe('center')
    // Cross axis stays pinned to the anchor even though the box is edge-aligned.
    expect(arrow.left).toBe(`anchor(${NAME} center)`)
    expect(arrow.right).toBe(`anchor(${NAME} center)`)
    expect(arrow.justifySelf).toBe('center')
  })

  it('pushes the arrow the other way for a top/left placement', () => {
    expect(buildAnchorStyles(NAME, { placement: 'top', offset: 8 }).arrow.top)
      .toBe(`calc(anchor(${NAME} top) - 8px)`)
    expect(buildAnchorStyles(NAME, { placement: 'top', offset: 8 }).arrow.bottom)
      .toBe(`calc(anchor(${NAME} top) + 8px)`)
    expect(buildAnchorStyles(NAME, { placement: 'left', offset: 8 }).arrow.left)
      .toBe(`calc(anchor(${NAME} left) - 8px)`)
    expect(buildAnchorStyles(NAME, { placement: 'left', offset: 8 }).arrow.right)
      .toBe(`calc(anchor(${NAME} left) + 8px)`)
  })

  it('swaps the arrow axes for an inline-axis placement', () => {
    const { arrow } = buildAnchorStyles(NAME, { placement: 'right' })
    expect(arrow.left).toBe(`anchor(${NAME} right)`)
    expect(arrow.right).toBe(`anchor(${NAME} right)`)
    expect(arrow.top).toBe(`anchor(${NAME} center)`)
    expect(arrow.bottom).toBe(`anchor(${NAME} center)`)
  })

  it('names no anchor but the default one', () => {
    // Measuring off the floating element would buy flip-tracking, and both
    // engines resolve that second, `position: fixed` anchor against stale
    // coordinates in cases far more common than a flip.
    for (const placement of ['top', 'bottom', 'left', 'right'] as const) {
      const { arrow } = buildAnchorStyles(NAME, { placement, offset: 10, safeArea: true })
      for (const value of Object.values(arrow)) {
        expect(String(value)).not.toContain(`${NAME}-floating`)
      }
      expect(arrow.alignSelf).toBe('center')
      expect(arrow.justifySelf).toBe('center')
    }
  })

  it('emits no safe area (and no floating anchor-name) by default', () => {
    const { floating, safeArea } = buildAnchorStyles(NAME)
    expect(floating.anchorName).toBeUndefined()
    expect(safeArea).toEqual({ display: 'none' })
  })

  it('spans the gap on the placement axis and the union on the cross axis', () => {
    const F = `${NAME}-floating`
    const { floating, safeArea } = buildAnchorStyles(NAME, { safeArea: true })
    // The floating element becomes an anchor too, so the rect can span both.
    expect(floating.anchorName).toBe(F)
    expect(safeArea.position).toBe('fixed')
    // placement 'bottom' → gap runs down the block axis…
    expect(safeArea.top).toBe(`min(anchor(${NAME} bottom), anchor(${F} bottom))`)
    expect(safeArea.bottom).toBe(`min(anchor(${NAME} top), anchor(${F} top))`)
    // …and the inline axis covers both boxes.
    expect(safeArea.left).toBe(`min(anchor(${NAME} left), anchor(${F} left))`)
    expect(safeArea.right).toBe(`min(anchor(${NAME} right), anchor(${F} right))`)
  })

  it('swaps which axis carries the gap for left/right placements', () => {
    const F = `${NAME}-floating`
    const { safeArea } = buildAnchorStyles(NAME, { placement: 'right', safeArea: true })
    expect(safeArea.left).toBe(`min(anchor(${NAME} right), anchor(${F} right))`)
    expect(safeArea.right).toBe(`min(anchor(${NAME} left), anchor(${F} left))`)
    expect(safeArea.top).toBe(`min(anchor(${NAME} top), anchor(${F} top))`)
  })

  it('reads the same for a placement and its flipped opposite', () => {
    // Both edges are a min() of the two boxes, so a native flip needs no new
    // CSS — 'left' and 'right' produce byte-identical safe areas.
    const right = buildAnchorStyles(NAME, { placement: 'right', safeArea: true }).safeArea
    const left = buildAnchorStyles(NAME, { placement: 'left', safeArea: true }).safeArea
    expect(left).toEqual(right)
  })

  it('keeps the safe area fixed even under the absolute strategy', () => {
    // Absolute would make the floating element its containing block, and the
    // anchor would stop being an acceptable anchor element.
    const { safeArea } = buildAnchorStyles(NAME, { strategy: 'absolute', safeArea: true })
    expect(safeArea.position).toBe('fixed')
  })
})
