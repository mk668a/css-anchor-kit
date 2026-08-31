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

  describe('containing-block warning', () => {
    /** Render an anchor + floating pair inside a wrapper and mount the hook. */
    function mount(trapped: boolean, strategy?: 'fixed' | 'absolute') {
      vi.stubGlobal('getComputedStyle', () => ({
        getPropertyValue: (p: string) =>
          trapped && p === 'transform' ? 'matrix(1, 0, 0, 1, 0, 0)' : '',
      }))
      renderHook(() => {
        const { anchorProps, floatingProps } = useAnchor({ strategy })
        anchorProps.ref(document.body.appendChild(document.createElement('button')))
        floatingProps.ref(document.body.appendChild(document.createElement('div')))
      })
      vi.unstubAllGlobals()
    }

    it('warns when the anchor sits inside a transformed ancestor', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mount(true)
      expect(warn).toHaveBeenCalledOnce()
      expect(warn.mock.calls[0][0]).toContain('[css-anchor-kit]')
      warn.mockRestore()
    })

    it('stays quiet on a clean ancestor chain', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mount(false)
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })

    it('stays quiet for `strategy: absolute`, where the trap is the point', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mount(true, 'absolute')
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })
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
