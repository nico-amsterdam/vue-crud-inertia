import { Hono } from 'hono'
import type { AppEnv } from '@/types/env'
import type { AgentScreenMeta } from './index'
import type { ProductType } from '@/types/product'
import { MAX_NAME_LENGTH, parseProductPayload } from '@/routes/products/validation'
import { createProduct, deleteProduct, getProductById, loadProductsPage, namePrefixPattern, toProduct, updateProduct } from '@/routes/products/store'
import { MAX_PAGE, readPage } from '@/routes/products'

/** Fallback "user" attribution for product writes done through the agent API. */
const DEFAULT_AGENT_USER = 'agent'

/** The agent screens showing product data. */
export const PRODUCT_SCREENS: Record<string, AgentScreenMeta> = {
  'products': { route: '/products', context: ['page', 'q'] },
  'products/new': { route: '/products/new', context: [] },
  'products/edit': { route: '/products/:id/edit', context: ['id'] },
  'products/delete': { route: '/products/:id/delete', context: ['id'] },
}

/*
 * Product read/write routes of the agent JSON API.
 * Mounted by agent/index.ts under /products; requireAgentAuth runs on the parent.
 */

/** Load the data payload the agent `/data` route serves for a product screen
 *  (a product list page, or the single product behind edit/delete screens).
 *  `q`/`page` mirror what the user is looking at in the browser (synced by
 *  syncListNavigation in products/index.ts); unknown screens yield `null`. */
export async function loadProductScreenData(
  screen: string,
  params?: { page?: number; id?: number; q?: string } | null,
): Promise<ProductType[] | ProductType | null> {
  if (screen === 'products') {
    const page = Number(params?.page ?? 1)
    const clampedPage = Number.isFinite(page) && page >= 1 ? Math.min(Math.floor(page), MAX_PAGE) : 1
    // Same clamping as the UI's findbyname route: longer prefixes cannot match
    // anything and oversized LIKE patterns make SQLite throw a 500.
    const q = typeof params?.q === 'string' ? params.q.slice(0, MAX_NAME_LENGTH) : ''
    const { products } = await loadProductsPage(clampedPage, namePrefixPattern(q))
    return products
  }
  if (screen === 'products/edit' || screen === 'products/delete') {
    const id = Number(params?.id)
    const dbProduct = id ? await getProductById(id) : null
    return dbProduct ? toProduct(dbProduct) : null
  }
  return null
}

/**
 * AGENT_ENABLED — comma-separated capability allow-list. When the variable is
 * unset, every agent capability is allowed (default). When set, only listed
 * capabilities are permitted — 'products' enables the product API
 * (/agent/products*, the list/search GET and the write routes); everything
 * not listed answers 403.
 */
const isAgentProductsDisabled = (): boolean => {
  const list = process.env.AGENT_ENABLED
  if (list === undefined) return false
  return !list.split(',').some((entry) => entry.trim().toLowerCase() === 'products')
}

const products = new Hono<AppEnv>()
  .use('*', async (c, next) => {
    if (isAgentProductsDisabled()) {
      return c.json({ error: "Agent capability 'products' is not in AGENT_ENABLED" }, 403)
    }
    await next()
  })
  // JSON twin of the UI's /products/findbyname route: the same name-prefix
  // filter (starting letters) and pagination, but for agent callers.
  .get('/', async (c) => {
    const q = (c.req.query('q') ?? '').slice(0, MAX_NAME_LENGTH)
    const page = readPage(c)
    const { products: pageProducts, hasMore } = await loadProductsPage(page, namePrefixPattern(q))
    return c.json({ q, page, products: pageProducts, hasMore })
  })
  .post('/', async (c) => {
    const body = await c.req.json().catch(() => null)
    if (!body) return c.json({ error: 'Invalid body' }, 400)
    const result = parseProductPayload(body)
    if (!result.valid) return c.json({ errors: result.errors }, 400)
    // Duplicate names surface as a `duplicate-name` failure from the store
    // (UNIQUE constraint on products.name), mapped back to the same 409 that
    // the agent CLI has always seen for this case.
    const created = await createProduct(result.data, c.var.authUser?.login ?? DEFAULT_AGENT_USER)
    if (!created.ok) {
      return created.reason === 'duplicate-name'
        ? c.json({ error: 'Name exists' }, 409)
        : c.json({ error: 'Write failed' }, 500)
    }
    return c.json({ ok: true, product: toProduct(created.product) })
  })
  .patch('/:id', async (c) => {
    // PATCH here means COMPLETE REPLACEMENT, not partial merge: validateProduct
    // requires the full valid product and omitted fields clear to their empty
    // defaults (description → '', price → null). Documented in the CLI help
    // and the agent skill — don't "fix" this into merge semantics without
    // deciding the merge format (RFC 7396) first.
    const id = Number(c.req.param('id'))
    const body = await c.req.json().catch(() => null)
    if (!body) return c.json({ error: 'Invalid body' }, 400)
    const result = parseProductPayload(body)
    if (!result.valid) return c.json({ errors: result.errors }, 400)
    const updated = await updateProduct(id, result.data, c.var.authUser?.login ?? DEFAULT_AGENT_USER)
    if (!updated.ok) {
      return updated.reason === 'not-found'
        ? c.json({ error: 'Not found' }, 404)
        : updated.reason === 'duplicate-name'
          ? c.json({ error: 'Name exists' }, 409)
          : c.json({ error: 'Write failed' }, 500)
    }
    return c.json({ ok: true, product: toProduct(updated.product) })
  })
  .delete('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    await deleteProduct(id)
    return c.json({ ok: true })
  })

export default products
