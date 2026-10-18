import { describe, it, expect } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/*
 * Guards the pruned icon collection (src/generated/tabler-icons.json):
 * every `icon="tabler:x"` referenced in src/ must exist in the generated file.
 * A failure means someone added an icon without running `bun run generate:icons`
 * (the build script runs it automatically; regenerate manually after editing
 * icons in dev).
 */

function findUsedIcons(dir: string, used = new Set<string>()): Set<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      findUsedIcons(path, used)
    } else if (/\.(vue|ts)$/.test(entry)) {
      for (const match of readFileSync(path, 'utf8').matchAll(/icon="tabler:([a-z0-9-]+)"/g)) {
        used.add(match[1])
      }
    }
  }
  return used
}

describe('pruned icon collection', () => {
  const generated = JSON.parse(readFileSync('./src/generated/tabler-icons.json', 'utf8')) as {
    prefix: string
    icons: Record<string, unknown>
    aliases?: Record<string, { parent: string }>
  }

  it('contains every tabler icon referenced in src/', () => {
    const used = findUsedIcons('./src')
    expect(used.size).toBeGreaterThan(0)
    const available = new Set([...Object.keys(generated.icons), ...Object.keys(generated.aliases ?? {})])
    const missing = [...used].filter((name) => !available.has(name)).sort()
    expect(missing).toEqual([])
  })

  it('bundles only the referenced icons', () => {
    const used = findUsedIcons('./src')
    const referenced = new Set(used)
    // Root icons pulled in for aliases are allowed beyond the direct references.
    for (const alias of Object.values(generated.aliases ?? {})) referenced.add(alias.parent)
    const extra = Object.keys(generated.icons).filter((name) => !referenced.has(name)).sort()
    expect(extra).toEqual([])
  })
})
