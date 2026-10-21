import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/*
 * Prunes @iconify-json/tabler down to the icons referenced in src/ and writes
 * src/generated/tabler-icons.json for src/inertia/main.ts to register locally
 * with addCollection() — keeping the CSP free of Iconify API origins while
 * avoiding a 2 MB full-collection bundle.
 *
 * Run automatically by `bun run build`; `tests/scripts/icons.test.ts` fails when a
 * referenced icon is missing from the generated file (i.e. forgotten regen).
 */

const COLLECTION = 'tabler'
const SRC_DIR = './src'
const OUT_FILE = './src/generated/tabler-icons.json'

type IconEntry = Record<string, unknown>
type CollectionJson = {
  prefix: string
  width?: number
  height?: number
  icons: Record<string, IconEntry>
  aliases?: Record<string, IconEntry & { parent: string }>
}

/** All `icon="tabler:name"` (double- or single-quoted) references in source files. */
function findUsedIcons(dir: string, used = new Set<string>()): Set<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      findUsedIcons(path, used)
    } else if (/\.(vue|ts)$/.test(entry)) {
      const source = readFileSync(path, 'utf8')
      for (const match of source.matchAll(/icon="([a-z0-9-]+):([a-z0-9-]+)"/g)) {
        const [full, prefix, name] = match
        if (prefix !== COLLECTION) {
          throw new Error(`${path} references "${full}" but only the "${COLLECTION}" collection is bundled. Add the collection in scripts/generate-icons.ts and src/inertia/main.ts.`)
        }
        used.add(name)
      }
    }
  }
  return used
}

/** Follow `aliases[name].parent` chains to the root entry in `icons`. */
function resolveRoot(name: string, collection: CollectionJson): string {
  if (collection.icons[name]) return name
  const alias = collection.aliases?.[name]
  if (!alias) throw new Error(`Icon "${collection.prefix}:${name}" does not exist in @iconify-json/${COLLECTION}`)
  return resolveRoot(alias.parent, collection)
}

const collection = JSON.parse(
  readFileSync(`./node_modules/@iconify-json/${COLLECTION}/icons.json`, 'utf8'),
) as CollectionJson

const used = [...findUsedIcons(SRC_DIR)].sort()
const icons: Record<string, IconEntry> = {}
const aliases: Record<string, IconEntry> = {}

for (const name of used) {
  if (collection.icons[name]) {
    icons[name] = collection.icons[name]
    continue
  }
  // Used as an alias: bundle the root icon plus the alias metadata.
  const alias = collection.aliases![name]
  const root = resolveRoot(alias.parent, collection)
  icons[root] = collection.icons[root]
  const { parent: _parent, ...aliasMeta } = alias
  aliases[name] = { ...aliasMeta, parent: root }
}

const pruned = {
  prefix: collection.prefix,
  ...(collection.width !== undefined && { width: collection.width }),
  ...(collection.height !== undefined && { height: collection.height }),
  icons,
  ...(Object.keys(aliases).length > 0 && { aliases }),
}

mkdirSync(dirname(OUT_FILE), { recursive: true })
writeFileSync(OUT_FILE, JSON.stringify(pruned, null, 2) + '\n')
console.log(`Wrote ${OUT_FILE}: ${used.length} icon(s) — ${used.join(', ')}`)
