import { describe, expect, it } from 'vitest'
import { oppositePlacement, resolveFlip, type Rect } from './flipWithin'

describe('oppositePlacement', () => {
  it('flips the side and preserves alignment', () => {
    expect(oppositePlacement('bottom')).toBe('top')
    expect(oppositePlacement('top')).toBe('bottom')
    expect(oppositePlacement('left')).toBe('right')
    expect(oppositePlacement('right')).toBe('left')
    expect(oppositePlacement('bottom-start')).toBe('top-start')
    expect(oppositePlacement('right-end')).toBe('left-end')
  })
})

// A 200x200 boundary at the viewport origin.
const boundary: Rect = { top: 0, bottom: 200, left: 0, right: 200 }
const floating = { width: 100, height: 40 }

describe('resolveFlip — block axis', () => {
  it('keeps the placement when the preferred side fits', () => {
    // anchor near the top: plenty of room below for a bottom placement
    const anchor: Rect = { top: 20, bottom: 50, left: 80, right: 120 }
    expect(resolveFlip('bottom', anchor, floating, boundary)).toBe('bottom')
  })

  it('flips to the opposite side when the preferred side overflows and the opposite has room', () => {
    // anchor near the bottom edge: no room below (150px down to 200 - bottom 190 = 10), room above
    const anchor: Rect = { top: 160, bottom: 190, left: 80, right: 120 }
    expect(resolveFlip('bottom', anchor, floating, boundary)).toBe('top')
  })

  it('does not flip when neither side fits but the opposite is no better', () => {
    // tiny boundary: 30px tall — nothing fits; anchor centered, equal (no) room
    const tiny: Rect = { top: 0, bottom: 30, left: 0, right: 200 }
    const anchor: Rect = { top: 10, bottom: 20, left: 80, right: 120 }
    // room below = 10, room above = 10 → opposite not greater → stay
    expect(resolveFlip('bottom', anchor, floating, tiny)).toBe('bottom')
  })

  it('respects the offset when checking fit', () => {
    // room below = 45; floating height 40 fits without offset but not with offset 8
    const anchor: Rect = { top: 120, bottom: 155, left: 80, right: 120 }
    expect(resolveFlip('bottom', anchor, floating, boundary, 0)).toBe('bottom')
    expect(resolveFlip('bottom', anchor, floating, boundary, 8)).toBe('top')
  })

  it('flips top placement down when there is no room above', () => {
    const anchor: Rect = { top: 10, bottom: 40, left: 80, right: 120 }
    expect(resolveFlip('top', anchor, floating, boundary)).toBe('bottom')
  })

  it('keeps the alignment suffix when flipping', () => {
    const anchor: Rect = { top: 160, bottom: 190, left: 80, right: 120 }
    expect(resolveFlip('bottom-start', anchor, floating, boundary)).toBe('top-start')
  })
})

describe('resolveFlip — inline axis', () => {
  it('flips right to left when there is no room on the right', () => {
    // anchor near the right edge: room right = 200 - 190 = 10, room left = 160
    const anchor: Rect = { top: 80, bottom: 120, left: 160, right: 190 }
    expect(resolveFlip('right', anchor, floating, boundary)).toBe('left')
  })

  it('keeps right when it fits', () => {
    const anchor: Rect = { top: 80, bottom: 120, left: 10, right: 40 }
    expect(resolveFlip('right', anchor, floating, boundary)).toBe('right')
  })
})
