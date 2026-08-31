/**
 * jscodeshift codemod: floating-ui → css-anchor-kit.
 *
 * Rewrites `useFloating(...)` call sites (plus their middleware and the
 * `refs.setReference` / `refs.setFloating` JSX wiring) into `useAnchor(...)`,
 * mapping the supported middleware to options, dropping `autoUpdate`, and
 * leaving `// TODO(css-anchor-kit)` comments for anything without a native
 * equivalent (`shift`, `size`, `autoPlacement`, `inline`, `arrow` ref-wiring,
 * interaction hooks).
 *
 * This is the executable version of the README migration table. It is
 * **dev-time only** — never imported by `index.ts` / `core.ts`, so it has zero
 * effect on the runtime bundle.
 */
import type {
  API,
  ASTPath,
  Collection,
  FileInfo,
  JSCodeshift,
  ObjectExpression,
  ObjectProperty,
  Property,
} from 'jscodeshift'

export const parser = 'tsx'

const FLOATING_UI_RE = /^@floating-ui\//

/** Middleware that maps cleanly to a `useAnchor` option. */
const OPTION_MIDDLEWARE: Record<string, 'offset' | 'flip' | 'hide'> = {
  offset: 'offset',
  flip: 'flip',
  hide: 'hide',
}

/** Middleware with no native equivalent — dropped, but flagged with a TODO. */
const UNSUPPORTED_MIDDLEWARE: Record<string, string> = {
  shift: 'shift() has no native equivalent yet (flip covers most overflow; richer fallbacks land in v0.2)',
  size: 'size() is not wired into the hook yet — use anchor-size() in raw CSS (v0.2)',
  autoPlacement: 'autoPlacement() has no native equivalent',
  inline: 'inline() has no native equivalent',
  arrow: "arrow() — spread `arrowProps` on a sibling element instead of passing an arrow ref",
}

const TODO = (msg: string) => ` TODO(css-anchor-kit): ${msg}`

/**
 * Interaction hooks are out of scope, but `safePolygon()` has a direct
 * counterpart in the kit, so point at it rather than leaving it silent.
 */
const SAFE_POLYGON =
  'safePolygon() → pass `safeArea: true` to useAnchor and render <SafeArea /> inside the floating element (a CSS rect over the gap; no pointer tracking, so no buffer/intent options)'

export default function transform(file: FileInfo, api: API): string | undefined {
  const j: JSCodeshift = api.jscodeshift
  const root: Collection = j(file.source)

  // --- Pass 1: find floating-ui imports, record the local names we care about.
  const fuiImports = root
    .find(j.ImportDeclaration)
    .filter((p) => typeof p.node.source.value === 'string' && FLOATING_UI_RE.test(p.node.source.value))

  if (fuiImports.size() === 0) return undefined // not a floating-ui file; leave it untouched.

  // local name -> imported name, for the specifiers we know how to handle.
  const localToImported = new Map<string, string>()
  fuiImports.forEach((p) => {
    for (const spec of p.node.specifiers ?? []) {
      if (spec.type === 'ImportSpecifier') {
        const imported = identName(spec.imported)
        localToImported.set(identName(spec.local) || imported, imported)
      }
    }
  })

  const localFor = (imported: string): string | undefined => {
    for (const [local, imp] of localToImported) if (imp === imported) return local
    return undefined
  }

  const useFloatingLocal = localFor('useFloating')

  // Track which floating-ui specifiers we actually consumed, so we can prune
  // the import down to (or remove) only the parts we replaced.
  const consumed = new Set<string>()
  let usedUseAnchor = false

  // --- Pass 2: rewrite useFloating(...) calls.
  if (useFloatingLocal) {
    root
      .find(j.CallExpression, { callee: { type: 'Identifier', name: useFloatingLocal } })
      .forEach((path) => {
        usedUseAnchor = true
        consumed.add('useFloating')
        const call = path.node
        call.callee = j.identifier('useAnchor')

        const arg = call.arguments[0]
        const opts: ObjectExpression =
          arg && arg.type === 'ObjectExpression' ? arg : j.objectExpression([])

        rewriteOptions(j, opts, localToImported, consumed, path)
        call.arguments = opts.properties.length ? [opts] : []
      })

    // --- Pass 3 + 4: rewrite the destructuring + JSX wiring per useFloating result.
    rewriteFloatingUsage(j, root, useFloatingLocal)
  }

  // --- Pass 5: flag the interaction-layer import we have an answer for.
  if (localFor('safePolygon')) {
    fuiImports.forEach((path) => {
      const imports = (path.node.specifiers ?? []).some(
        (spec: any) => spec.type === 'ImportSpecifier' && identName(spec.imported) === 'safePolygon',
      )
      if (imports) attachComment(j, path, TODO(SAFE_POLYGON))
    })
  }

  // --- Pass 6: fix imports.
  fixImports(j, root, fuiImports, consumed, usedUseAnchor)

  return root.toSource({ quote: 'single' })
}

/**
 * Map the `middleware: [...]` array (and any top-level placement/strategy) of a
 * useFloating options object into useAnchor options, attaching TODO comments
 * for unsupported middleware.
 */
function rewriteOptions(
  j: JSCodeshift,
  opts: ObjectExpression,
  localToImported: Map<string, string>,
  consumed: Set<string>,
  callPath: ASTPath,
): void {
  const kept: (ObjectProperty | Property)[] = []
  const todos: string[] = []

  for (const prop of opts.properties) {
    if ((prop.type !== 'ObjectProperty' && prop.type !== 'Property') || prop.computed) {
      kept.push(prop as ObjectProperty)
      continue
    }
    const key = keyName(prop.key)

    // Drop the JS-only update loop entirely. Its value is usually `autoUpdate`
    // (a floating-ui import) — mark it consumed so the import gets pruned too.
    if (key === 'whileElementsMounted' || key === 'elements' || key === 'transform') {
      if (prop.value.type === 'Identifier') {
        const imported = localToImported.get(prop.value.name)
        if (imported) consumed.add(imported)
      }
      continue
    }

    if (key === 'middleware' && prop.value.type === 'ArrayExpression') {
      for (const el of prop.value.elements) {
        if (!el || el.type === 'SpreadElement') continue
        const mw = middlewareName(el)
        const imported = mw ? localToImported.get(mw) : undefined
        if (!imported) continue // not a floating-ui middleware we recognise

        consumed.add(imported)
        const optionKey = OPTION_MIDDLEWARE[imported]
        if (optionKey === 'offset') {
          const val = el.type === 'CallExpression' ? el.arguments[0] : undefined
          kept.push(
            j.objectProperty(
              j.identifier('offset'),
              val && (val.type === 'NumericLiteral' || val.type === 'Literal')
                ? (val as any)
                : j.numericLiteral(8),
            ),
          )
        } else if (optionKey === 'flip' || optionKey === 'hide') {
          kept.push(j.objectProperty(j.identifier(optionKey), j.booleanLiteral(true)))
        } else if (UNSUPPORTED_MIDDLEWARE[imported]) {
          todos.push(UNSUPPORTED_MIDDLEWARE[imported])
        }
      }
      continue
    }

    // Keep placement / strategy / open verbatim.
    kept.push(prop as ObjectProperty)
  }

  opts.properties = kept
  for (const msg of todos) attachComment(j, callPath, TODO(msg))
}

/**
 * Rewrite `const { refs, floatingStyles, ... } = useAnchor(...)` destructuring
 * into `{ anchorProps, floatingProps, arrowProps }`, and rewrite the JSX that
 * used `refs.setReference` / `refs.setFloating` / `floatingStyles`.
 */
function rewriteFloatingUsage(j: JSCodeshift, root: Collection, _useFloatingLocal: string): void {
  // Find `... = useAnchor(...)` declarators (callee already renamed in pass 2).
  root
    .find(j.VariableDeclarator, {
      init: { type: 'CallExpression', callee: { type: 'Identifier', name: 'useAnchor' } },
    })
    .forEach((path) => {
      const id = path.node.id
      if (id.type !== 'ObjectPattern') return

      let refsName: string | undefined
      let floatingStylesName: string | undefined
      const keep: any[] = []

      for (const p of id.properties) {
        if (p.type === 'RestElement') {
          keep.push(p)
          continue
        }
        if (p.type !== 'ObjectProperty' && p.type !== 'Property') {
          keep.push(p)
          continue
        }
        const key = keyName(p.key)
        if (key === 'refs') {
          refsName = p.value.type === 'Identifier' ? p.value.name : 'refs'
        } else if (key === 'floatingStyles') {
          floatingStylesName = p.value.type === 'Identifier' ? p.value.name : 'floatingStyles'
        } else if (key === 'context' || key === 'update' || key === 'reference' || key === 'floating') {
          // floating-ui-only handles — drop them (interaction layer is out of scope).
        } else {
          keep.push(p)
        }
      }

      // Replace the pattern with the css-anchor-kit shape.
      keep.push(j.objectProperty.from({ key: j.identifier('anchorProps'), value: j.identifier('anchorProps'), shorthand: true }))
      keep.push(j.objectProperty.from({ key: j.identifier('floatingProps'), value: j.identifier('floatingProps'), shorthand: true }))
      keep.push(j.objectProperty.from({ key: j.identifier('arrowProps'), value: j.identifier('arrowProps'), shorthand: true }))
      id.properties = keep

      // Rewrite JSX in the enclosing function: refs.setReference / setFloating + floatingStyles.
      rewriteJsx(j, root, refsName, floatingStylesName)
    })
}

function rewriteJsx(
  j: JSCodeshift,
  root: Collection,
  refsName: string | undefined,
  floatingStylesName: string | undefined,
): void {
  // ref={refs.setReference} -> {...anchorProps} ; ref={refs.setFloating} -> {...floatingProps}
  if (refsName) {
    root.find(j.JSXAttribute, { name: { name: 'ref' } }).forEach((path) => {
      const val = path.node.value
      if (!val || val.type !== 'JSXExpressionContainer') return
      const expr = val.expression
      const member = memberOf(expr)
      if (!member || member.object !== refsName) return
      if (member.property === 'setReference') {
        replaceAttrWithSpread(j, path, 'anchorProps')
      } else if (member.property === 'setFloating') {
        replaceAttrWithSpread(j, path, 'floatingProps')
      }
    })
  }

  // style={floatingStyles} -> removed (floatingProps carries the style).
  if (floatingStylesName) {
    root
      .find(j.JSXAttribute, { name: { name: 'style' } })
      .filter((path) => {
        const val = path.node.value
        return (
          !!val &&
          val.type === 'JSXExpressionContainer' &&
          val.expression.type === 'Identifier' &&
          val.expression.name === floatingStylesName
        )
      })
      .forEach((path) => j(path).remove())
  }
}

/** Replace a JSX attribute node with a `{...name}` spread attribute. */
function replaceAttrWithSpread(j: JSCodeshift, path: ASTPath<any>, name: string): void {
  j(path).replaceWith(j.jsxSpreadAttribute(j.identifier(name)))
}

/** Prune consumed floating-ui specifiers; drop empty imports; add useAnchor import. */
function fixImports(
  j: JSCodeshift,
  root: Collection,
  fuiImports: Collection<any>,
  consumed: Set<string>,
  usedUseAnchor: boolean,
): void {
  fuiImports.forEach((path) => {
    const specs = (path.node.specifiers ?? []).filter((spec: any) => {
      if (spec.type !== 'ImportSpecifier') return true
      return !consumed.has(identName(spec.imported))
    })
    if (specs.length === 0) {
      j(path).remove()
    } else {
      path.node.specifiers = specs
    }
  })

  if (!usedUseAnchor) return

  // Already imported useAnchor from css-anchor-kit? then we're done.
  const existing = root
    .find(j.ImportDeclaration, { source: { value: 'css-anchor-kit' } })
    .filter((p) =>
      (p.node.specifiers ?? []).some(
        (s) => s.type === 'ImportSpecifier' && s.imported.name === 'useAnchor',
      ),
    )
  if (existing.size() > 0) return

  const importDecl = j.importDeclaration(
    [j.importSpecifier(j.identifier('useAnchor'))],
    j.stringLiteral('css-anchor-kit'),
  )
  const body = root.get().node.program.body
  // Place after the last existing import for tidy output.
  let lastImport = -1
  body.forEach((n: any, i: number) => {
    if (n.type === 'ImportDeclaration') lastImport = i
  })
  body.splice(lastImport + 1, 0, importDecl)
}

// --- small helpers -------------------------------------------------------

/** Safe `.name` for an Identifier-ish node (handles null/undefined). */
function identName(node: any): string {
  return node && typeof node.name === 'string' ? node.name : ''
}

function keyName(key: any): string {
  if (!key) return ''
  if (key.type === 'Identifier') return key.name
  if (key.type === 'StringLiteral' || key.type === 'Literal') return String(key.value)
  return ''
}

/** Name of a middleware element: `offset(8)` -> 'offset', bare `flip` -> 'flip'. */
function middlewareName(el: any): string | undefined {
  if (el.type === 'CallExpression' && el.callee.type === 'Identifier') return el.callee.name
  if (el.type === 'Identifier') return el.name
  return undefined
}

function memberOf(expr: any): { object: string; property: string } | undefined {
  if (
    expr &&
    expr.type === 'MemberExpression' &&
    expr.object.type === 'Identifier' &&
    expr.property.type === 'Identifier'
  ) {
    return { object: expr.object.name, property: expr.property.name }
  }
  return undefined
}

/** Attach a leading line comment to the statement enclosing `path`. */
function attachComment(j: JSCodeshift, path: ASTPath, text: string): void {
  let stmt: any = path
  while (stmt && stmt.node && !/Statement$|Declaration$/.test(stmt.node.type)) {
    stmt = stmt.parent
  }
  const target = stmt?.node ?? path.node
  target.comments = target.comments ?? []
  target.comments.push(j.commentLine(text, true, false))
}
