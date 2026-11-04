import { Hono } from 'hono'
import type { AppEnv } from '@/types/env'
import type { AgentScreenMeta } from './index'
import type { ProductType } from '@/types/product'
import { convertAndValidateProductPayload } from '@/routes/products/validation'
import { createProduct, deleteProduct, getProductById, loadProductsPage, productNameExists, toProduct, updateProduct } from '@/routes/products/store'

/** Fallback "user" attribution for product writes done through the agent API. */
export const DEFAULT_AGENT_USER = 'agent'

/** The agent screens showing product data. */
export const PRODUCT_SCREENS: Record<string, AgentScreenMeta> = {
  'products': { route: '/products', context: ['page', 'q'] },
  'products/new': { route: '/products/new', context: [] },
  'products/edit': { route: '/products/:id/edit', context: ['id'] },
  'products/delete': { route: '/products/:id/delete', context: ['id'] },
}

/*
 * Product write routes of the agent JSON API.
 * Mounted by agent/index.ts under /products; requireAgentAuth runs on the parent.
 */

/** Load the data payload the agent `/data` route serves for a product screen
 *  (a product list page, or the single product behind edit/delete screens).
 *  Every agent screen is a product screen; unknown screens yield `null`. */
export async function loadProductScreenData(
  screen: string,
  params?: { page?: number; id?: number } | null,
): Promise<ProductType[] | ProductType | null> {
  if (screen === 'products') {
    const { products } = await loadProductsPage(params?.page ?? 1)
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
 * capabilities are permitted — 'products' enables the product write API
 * (/agent/products*); everything not listed answers 403.
 */
export const isAgentProductsDisabled = (): boolean => {
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
  .post('/', async (c) => {
    const body = await c.req.json().catch(() => null)
    if (!body) return c.json({ error: 'Invalid body' }, 400)
    const result = convertAndValidateProductPayload(body)
    if (!result.valid) return c.json({ errors: result.errors }, 400)
    if (await productNameExists(result.data.productName)) return c.json({ error: 'Name exists' }, 409)
    const row = await createProduct(result.data, c.var.authUser?.login ?? DEFAULT_AGENT_USER)
    return c.json({ ok: true, product: row ? toProduct(row) : null })
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
    const result = convertAndValidateProductPayload(body)
    if (!result.valid) return c.json({ errors: result.errors }, 400)
    const updated = await updateProduct(id, result.data, c.var.authUser?.login ?? DEFAULT_AGENT_USER)
    if (!updated.length) return c.json({ error: 'Not found' }, 404)
    return c.json({ ok: true, product: toProduct(updated[0]) })
  })
  .delete('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    await deleteProduct(id)
    return c.json({ ok: true })
  })

export default products
