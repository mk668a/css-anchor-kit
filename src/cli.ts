/**
 * css-anchor-kit CLI — currently a single command:
 *
 *   npx css-anchor-kit migrate [globs...] [--dry] [--print]
 *
 * Runs the floating-ui → css-anchor-kit jscodeshift transform over the given
 * files. Dev-time only; nothing here is part of the published runtime bundle.
 */
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
// jscodeshift's Runner submodule is untyped; it's a dev-time dep.
import { run as jscodeshift } from 'jscodeshift/src/Runner.js'

const DEFAULT_GLOBS = ['src/**/*.{ts,tsx,js,jsx}']

const USAGE = `css-anchor-kit — migrate floating-ui call sites to css-anchor-kit

Usage:
  npx css-anchor-kit migrate [globs...] [options]

Arguments:
  globs            files/globs to transform (default: "${DEFAULT_GLOBS[0]}")

Options:
  --dry            preview changes without writing files
  --print          print transformed output to stdout
  -h, --help       show this help

Examples:
  npx css-anchor-kit migrate
  npx css-anchor-kit migrate "src/**/*.tsx" --dry
`

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const command = argv[0]

  if (command === '-h' || command === '--help' || command === undefined) {
    process.stdout.write(USAGE)
    process.exit(command === undefined ? 1 : 0)
  }

  if (command !== 'migrate') {
    process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`)
    process.exit(1)
  }

  const { values, positionals } = parseArgs({
    args: argv.slice(1),
    allowPositionals: true,
    options: {
      dry: { type: 'boolean', default: false },
      print: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })

  if (values.help) {
    process.stdout.write(USAGE)
    process.exit(0)
  }

  const paths = positionals.length ? positionals : DEFAULT_GLOBS

  // The transform is emitted as its own dist file (see tsup.config.ts); the
  // Runner loads it by path. dist/cli.js and dist/floating-ui-to-anchor.js are
  // siblings, so resolve relative to this module.
  const here = dirname(fileURLToPath(import.meta.url))
  const transformPath = resolve(here, 'floating-ui-to-anchor.js')

  const stats = await jscodeshift(transformPath, paths, {
    dry: values.dry,
    print: values.print,
    parser: 'tsx',
    verbose: 1,
    babel: true,
    extensions: 'tsx,ts,jsx,js',
    runInBand: false,
  })

  if (stats && stats.ok > 0) {
    process.stdout.write(
      `\nDone. ${stats.ok} file(s) changed.\n` +
        `Grep for unfinished migrations:\n` +
        `  grep -rn "TODO(css-anchor-kit)" ${paths.join(' ')}\n` +
        `These mark middleware with no native equivalent (shift/size/arrow ref/interactions) — finish them by hand.\n`,
    )
  }
}

main().catch((err) => {
  process.stderr.write(`${err?.stack ?? err}\n`)
  process.exit(1)
})
