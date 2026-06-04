import { defineConfig } from 'tsup'

export default defineConfig([
  // Library: the runtime bundle. Stays zero-dep + tiny; React external.
  {
    entry: ['src/index.ts', 'src/core.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    treeshake: true,
    sourcemap: true,
    external: ['react'],
  },
  // CLI entry: dev-time only, never imported by the library. Gets the shebang.
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    dts: false,
    clean: false,
    treeshake: true,
    sourcemap: false,
    external: ['jscodeshift'],
    banner: { js: '#!/usr/bin/env node' },
  },
  // The codemod transform — emitted as its OWN dist file (no shebang) because
  // jscodeshift's Runner loads it by path, not by import.
  {
    entry: ['src/codemod/floating-ui-to-anchor.ts'],
    format: ['esm'],
    dts: false,
    clean: false,
    treeshake: true,
    sourcemap: false,
    external: ['jscodeshift'],
  },
])
