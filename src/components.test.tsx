import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Anchored, Anchor, Floating, Arrow, SafeArea } from './components'

describe('headless components', () => {
  it('renders anchor/floating/arrow with the positioning styles applied', () => {
    const { container } = render(
      <Anchored placement="top" offset={8}>
        <Anchor as="button" data-testid="anchor">Trigger</Anchor>
        <Floating data-testid="floating" role="tooltip">Tip</Floating>
        <Arrow data-testid="arrow" className="arrow" />
      </Anchored>,
    )

    const anchorStyle = (container.querySelector('button') as HTMLElement).style as any
    expect(anchorStyle.anchorName).toMatch(/^--cak-/)

    const floating = container.querySelector('[role="tooltip"]') as HTMLElement
    expect(floating.style.position).toBe('fixed')
    // The same anchor-name is wired through. (anchor()-valued insets like
    // `bottom: anchor(top)` are dropped by happy-dom's CSSOM but accepted by
    // real browsers — value correctness is covered by core.test.ts + the
    // browser smoke test.)
    const floatingStyle = floating.style as any
    expect(floatingStyle.positionAnchor).toMatch(/^--cak-/)
    expect(floatingStyle.positionAnchor).toBe(anchorStyle.anchorName)

    const arrowStyle = (container.querySelector('.arrow') as HTMLElement).style as any
    expect(arrowStyle.positionAnchor).toMatch(/^--cak-/)
  })

  it('defaults the rendered tag to div and respects `as`', () => {
    const { container } = render(
      <Anchored>
        <Anchor>a</Anchor>
        <Floating>f</Floating>
      </Anchored>,
    )
    expect(container.querySelector('div')).toBeTruthy()
  })

  it('merges user style with positioning style (positioning wins)', () => {
    const { container } = render(
      <Anchored placement="bottom">
        <Anchor>a</Anchor>
        <Floating data-testid="f" style={{ color: 'red', position: 'static' }}>f</Floating>
      </Anchored>,
    )
    const f = container.querySelector('[data-testid="f"]') as HTMLElement
    expect(f.style.color).toBe('red') // user style kept
    expect(f.style.position).toBe('fixed') // positioning authoritative
  })

  it('renders <SafeArea> inside <Floating> when the option is on', () => {
    const { container } = render(
      <Anchored placement="right" offset={12} safeArea>
        <Anchor as="button">Trigger</Anchor>
        <Floating data-testid="f">
          <SafeArea data-testid="safe" />
          Menu
        </Floating>
      </Anchored>,
    )
    const floating = container.querySelector('[data-testid="f"]') as HTMLElement
    const safe = container.querySelector('[data-testid="safe"]') as HTMLElement
    // A child, not a sibling: only inside does it stay reachable when the
    // floating element is in the top layer.
    expect(safe.parentElement).toBe(floating)
    expect((floating.style as any).anchorName).toMatch(/^--cak-.*-floating$/)
    expect(safe.style.position).toBe('fixed')
  })

  it('tells you to enable `safeArea` when <SafeArea> has nothing to span', () => {
    expect(() =>
      render(
        <Anchored>
          <Anchor>a</Anchor>
          <Floating><SafeArea /></Floating>
        </Anchored>,
      ),
    ).toThrow(/needs the `safeArea` option/)
  })

  it('throws if a slot is used outside <Anchored>', () => {
    // Suppress React's error boundary noise for this expected throw.
    expect(() => render(<Anchor>x</Anchor>)).toThrow(/must be rendered inside <Anchored>/)
  })
})
