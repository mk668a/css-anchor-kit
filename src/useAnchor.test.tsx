import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { useAnchor } from './useAnchor'
import { isAnchorPositioningSupported } from './core'

afterEach(cleanup)

describe('useAnchor', () => {
  it('generates a stable, valid anchor-name dashed-ident', () => {
    const { result } = renderHook(() => useAnchor())
    const { anchorName } = result.current
    expect(anchorName).toMatch(/^--cak-[a-zA-Z0-9-]+$/)
    // no leftover colons from React.useId()
    expect(anchorName).not.toContain(':')
  })

  it('wires the same anchor-name through anchor and floating props', () => {
    const { result } = renderHook(() => useAnchor({ placement: 'top', offset: 6 }))
    const { anchorProps, floatingProps, anchorName } = result.current
    expect((anchorProps.style as Record<string, unknown>).anchorName).toBe(anchorName)
    expect((floatingProps.style as Record<string, unknown>).positionAnchor).toBe(anchorName)
    expect((floatingProps.style as Record<string, unknown>).bottom).toBe('anchor(top)')
    expect((floatingProps.style as Record<string, unknown>).marginBottom).toBe('6px')
  })

  it('reports safeArea off with inert safe-area props by default', () => {
    const { result } = renderHook(() => useAnchor())
    expect(result.current.safeArea).toBe(false)
    expect(result.current.safeAreaProps.style).toEqual({ display: 'none' })
  })

  it('builds safe-area props from the anchor pair when enabled', () => {
    const { result } = renderHook(() => useAnchor({ placement: 'right', safeArea: true }))
    const { anchorName, safeArea, safeAreaProps } = result.current
    expect(safeArea).toBe(true)
    expect(safeAreaProps.style.position).toBe('fixed')
    expect(safeAreaProps.style.left).toBe(
      `min(anchor(${anchorName} right), anchor(${anchorName}-floating right))`,
    )
  })

  it('resolves `supported` from CSS.supports after mount', () => {
    vi.stubGlobal('CSS', { supports: () => true })
    expect(renderHook(() => useAnchor()).result.current.supported).toBe(true)
    vi.unstubAllGlobals()
  })
})

describe('isAnchorPositioningSupported', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is true when CSS.supports accepts anchor-name', () => {
    vi.stubGlobal('CSS', { supports: () => true })
    expect(isAnchorPositioningSupported()).toBe(true)
  })

  it('is false when CSS.supports rejects anchor-name', () => {
    vi.stubGlobal('CSS', { supports: () => false })
    expect(isAnchorPositioningSupported()).toBe(false)
  })

  it('is false when CSS is undefined (SSR)', () => {
    vi.stubGlobal('CSS', undefined)
    expect(isAnchorPositioningSupported()).toBe(false)
  })
})
