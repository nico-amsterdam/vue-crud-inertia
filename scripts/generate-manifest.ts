import { readFileSync, writeFileSync } from 'node:fs'
import type { ViteManifest } from '@sneakylenny/inertia-hono'

let manifest: ViteManifest
try {
  manifest = JSON.parse(readFileSync('./dist/.vite/manifest.json', 'utf8')) as ViteManifest
} catch {
  manifest = {}
}

const content = `import type { ViteManifest } from '@sneakylenny/inertia-hono'

export default ${JSON.stringify(manifest)} satisfies ViteManifest
`

writeFileSync('./src/generated/manifest.ts', content)
