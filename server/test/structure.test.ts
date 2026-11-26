// Guards the deployment layout. The API must never import files outside server/: when it did,
// TypeScript moved the compiled entry from src/app.js to server/src/app.js and every request
// crashed on Vercel with FUNCTION_INVOCATION_FAILED.
import { it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const serverRoot = fileURLToPath(new URL('..', import.meta.url))

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === 'node_modules') return []
    const path = join(dir, e.name)
    return e.isDirectory() ? tsFiles(path) : e.name.endsWith('.ts') ? [path] : []
  })
}

it('server code never imports files outside server/', () => {
  const escapes: string[] = []
  for (const file of ['src', 'scripts', 'test'].flatMap((d) => tsFiles(join(serverRoot, d)))) {
    const source = readFileSync(file, 'utf8')
    for (const [, spec] of source.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const target = resolve(dirname(file), spec!)
      if (relative(serverRoot, target).startsWith('..')) {
        escapes.push(`${relative(serverRoot, file)} imports ${spec}`)
      }
    }
  }
  assert.deepEqual(escapes, [], `Imports outside server/ break the Vercel build:\n${escapes.join('\n')}`)
})
