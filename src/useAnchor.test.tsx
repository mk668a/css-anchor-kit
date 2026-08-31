import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
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

  it("flips against the viewport in JS with boundary: 'viewport'", async () => {
    // The point of the JS flip is that the hook *knows* about it: the arrow is
    // built from the effective placement, where a CSS flip would leave it behind.
    const anchor = document.createElement('button')
    const floating = document.createElement('div')
    document.body.append(anchor, floating)
    // Anchor parked at the bottom of a 400px-tall viewport; a 200px-tall
    // floating box can only fit above it.
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(400)
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000)
    anchor.getBoundingClientRect = () =>
      ({ top: 360, bottom: 390, left: 100, right: 200, width: 100, height: 30 }) as DOMRect
    floating.getBoundingClientRect = () =>
      ({ top: 0, bottom: 200, left: 0, right: 150, width: 150, height: 200 }) as DOMRect

    const { result } = renderHook(() => useAnchor({ placement: 'bottom', boundary: 'viewport' }))
    await act(async () => {
      result.current.anchorProps.ref(anchor)
      result.current.floatingProps.ref(floating)
      window.dispatchEvent(new Event('resize'))
      // the measurement is scheduled on an animation frame
      await new Promise((r) => setTimeout(r, 32))
    })

    expect(result.current.placement).toBe('top')
    // …and everything the hook emits follows, arrow included.
    expect((result.current.floatingProps.style as Record<string, unknown>).bottom).toBe('anchor(top)')
    expect((result.current.arrowProps.style as Record<string, unknown>).top).toBe('anchor(--cak-test top)'.replace('--cak-test', result.current.anchorName))
    anchor.remove()
    floating.remove()
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
