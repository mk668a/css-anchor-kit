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
    const { floating } = buildAnchorStyles(NAME, { offset: 0 })
    expect(floating.marginTop).toBeUndefined()
    expect(floating.margin).toBe('0')
  })

  it('disables flip and toggles hide', () => {
    const { floating } = buildAnchorStyles(NAME, { flip: false, hide: true })
    expect(floating.positionTryFallbacks).toBeUndefined()
    expect(floating.positionVisibility).toBe('anchors-visible')
  })

  it('honors the absolute strategy', () => {
    const { floating, arrow } = buildAnchorStyles(NAME, { strategy: 'absolute' })
    expect(floating.position).toBe('absolute')
    expect(arrow.position).toBe('absolute')
  })

  it('keeps the arrow centered on the anchor regardless of alignment', () => {
    const { arrow } = buildAnchorStyles(NAME, { placement: 'bottom-start' })
    expect(arrow.positionAnchor).toBe(NAME)
    expect(arrow.top).toBe('anchor(bottom)')
    expect(arrow.justifySelf).toBe('anchor-center')
  })
})
