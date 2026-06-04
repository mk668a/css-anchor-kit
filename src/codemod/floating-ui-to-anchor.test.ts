import { describe, expect, it } from 'vitest'
import { applyTransform } from 'jscodeshift/src/testUtils.js'
import * as transform from './floating-ui-to-anchor'

/** Run the codemod on a source string and return the transformed source. */
function run(source: string): string {
  return applyTransform(transform as any, {}, { source, path: 'x.tsx' }, { parser: 'tsx' })
}

describe('floating-ui-to-anchor codemod', () => {
  it('rewrites a basic useFloating with offset + flip + JSX wiring', () => {
    const out = run(`
import { useFloating, offset, flip } from '@floating-ui/react'

function Tip() {
  const { refs, floatingStyles } = useFloating({
    placement: 'top',
    middleware: [offset(8), flip()],
    whileElementsMounted: autoUpdate,
  })
  return (
    <>
      <button ref={refs.setReference}>Hover</button>
      <div ref={refs.setFloating} style={floatingStyles} role="tooltip">Hi</div>
    </>
  )
}
`)
    // hook + import rewritten
    expect(out).toContain("import { useAnchor } from 'css-anchor-kit'")
    expect(out).toContain('useAnchor(')
    expect(out).not.toContain('useFloating')
    // middleware -> options
    expect(out).toContain('offset: 8')
    expect(out).toContain('flip: true')
    expect(out).toContain("placement: 'top'")
    // autoUpdate loop dropped
    expect(out).not.toContain('whileElementsMounted')
    expect(out).not.toContain('autoUpdate')
    // destructuring -> css-anchor-kit shape
    expect(out).toContain('anchorProps')
    expect(out).toContain('floatingProps')
    expect(out).not.toContain('refs')
    expect(out).not.toContain('floatingStyles')
    // JSX rewired to spreads, style={floatingStyles} removed
    expect(out).toContain('{...anchorProps}')
    expect(out).toContain('{...floatingProps}')
    expect(out).not.toContain('ref={refs.setReference}')
    expect(out).not.toContain('style={floatingStyles}')
  })

  it('drops unsupported middleware (shift, arrow) and leaves a TODO', () => {
    const out = run(`
import { useFloating, shift, arrow } from '@floating-ui/react'
import { useRef } from 'react'

function Pop() {
  const arrowRef = useRef(null)
  const { refs } = useFloating({
    middleware: [shift(), arrow({ element: arrowRef })],
  })
  return <div ref={refs.setReference} />
}
`)
    expect(out).toContain('TODO(css-anchor-kit)')
    expect(out.toLowerCase()).toContain('shift')
    expect(out.toLowerCase()).toContain('arrow')
    // unsupported middleware should NOT survive as options
    expect(out).not.toContain('shift:')
    expect(out).not.toContain('arrow:')
    expect(out).toContain('useAnchor(')
  })

  it('handles an import-only / no-middleware call and drops autoUpdate', () => {
    const out = run(`
import { useFloating, autoUpdate } from '@floating-ui/react'

function Bare() {
  const { refs, floatingStyles } = useFloating({ whileElementsMounted: autoUpdate })
  return <span ref={refs.setFloating} style={floatingStyles} />
}
`)
    expect(out).toContain('useAnchor(')
    expect(out).not.toContain('autoUpdate')
    expect(out).not.toContain('@floating-ui')
    expect(out).toContain('{...floatingProps}')
  })

  it('leaves files without floating-ui untouched', () => {
    const src = `
import { useFloating } from './my-local-hook'

function Local() {
  const { refs } = useFloating()
  return <div ref={refs.setReference} />
}
`
    const out = run(src)
    // The transform returns undefined for non-floating-ui files; applyTransform
    // signals "no change" by returning an empty string. (Under the real Runner
    // this leaves the file on disk untouched.)
    expect(out).toBe('')
    void src
  })

  it('preserves a pre-existing css-anchor-kit import without duplicating', () => {
    const out = run(`
import { useFloating, offset } from '@floating-ui/react'
import { useAnchor } from 'css-anchor-kit'

function Two() {
  const a = useAnchor({ placement: 'left' })
  const { refs } = useFloating({ middleware: [offset(4)] })
  return <div ref={refs.setReference} {...a.anchorProps} />
}
`)
    const imports = out.match(/import \{ useAnchor \} from 'css-anchor-kit'/g) ?? []
    expect(imports.length).toBe(1)
    expect(out).toContain('offset: 4')
  })
})
