import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ViteManifest } from '@sneakylenny/inertia-hono'

const OUT_FILE = './src/generated/manifest.ts'
let manifest: ViteManifest
try {
  manifest = JSON.parse(readFileSync('./dist/.vite/manifest.json', 'utf8')) as ViteManifest
} catch {
  manifest = {}
}

const content = `import type { ViteManifest } from '@sneakylenny/inertia-hono'

export default ${JSON.stringify(manifest)} satisfies ViteManifest
`

mkdirSync(dirname(OUT_FILE), { recursive: true })
writeFileSync(OUT_FILE, content)
