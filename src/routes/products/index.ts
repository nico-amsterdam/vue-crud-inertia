import { Hono, type Context } from 'hono'
import { render, scroll } from '@sneakylenny/inertia-hono'
import { and, eq, isNull } from 'drizzle-orm'
import { getDB, tables } from '../../db/index'
import type { ProductBaseType, ProductType } from '../../types/product'
import type { AppEnv } from '../../types/env'
import { t } from '../../i18n/request'
import { rateLimit } from '../../middleware/rate-limit'
import {
  DEFAULT_USER,
  getProductById,
  loadProductsPage,
  namePrefixPattern,
  priceToCents,
  productNameExists,
  toProduct,
} from './store'
import { MAX_NAME_LENGTH, translateFieldErrors, validateProduct } from './validation'

/** The 1-based page number requested by the client. */
function readPage(c: Context): number {
  const page = Number(c.req.query('page') ?? 1)
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1
}

/** A valid product id from the URL (`:id` must be a positive integer). */
function readId(c: Context): number | null {
  const id = Number(c.req.param('id'))
  return Number.isInteger(id) && id >= 1 ? id : null
}

/** A "load more" request from `<InfiniteScroll>` carries the merge-intent header. */
function isLoadMoreRequest(c: Context): boolean {
  return c.req.header('x-inertia-infinite-scroll-merge-intent') !== undefined
}

/** Parse a JSON body; malformed payloads yield null instead of an unhandled 500. */
async function readJsonBody(c: Context): Promise<Partial<ProductBaseType> | null> {
  try {
    return await c.req.json<Partial<ProductBaseType>>()
  } catch {
    return null
  }
}

/** Wrap a page of products for `<InfiniteScroll>`: appended on "load more",
 *  and reset whenever the list is loaded outside of a "load more" request
 *  (initial load or filter change). Pagination metadata comes from the
 *  `PER_PAGE + 1` over-fetch — no `count(*)` needed: a next page exists
 *  exactly when the extra row was returned. */
function pagedProducts(c: Context, products: ProductType[], page: number, hasMore: boolean) {
  return scroll(products, {
    pageName: 'page',
    currentPage: page,
    previousPage: page > 1 ? page - 1 : null,
    nextPage: hasMore ? page + 1 : null,
  })
    .match('id')
    .resetWhen(!isLoadMoreRequest(c))
}

/** Flash a success message that surfaces as a `flash.success` prop on the next request. */
async function flashSuccess(c: Context, message: string): Promise<void> {
  await c.var.inertia.flash({ flash: { success: message } })
}

const app = new Hono<AppEnv>()
  .get('/', async (c) => {
    const page = readPage(c)
    const { products, hasMore } = await loadProductsPage(page)
    return render(c, 'products/index', {
      products: pagedProducts(c, products, page, hasMore),
      // Total > PER_PAGE: the over-fetched extra row proves it on page 1;
      // any row on a later page already sits beyond PER_PAGE.
      serverFilter: hasMore || (page > 1 && products.length > 0),
      q: '',
    })
  })
  .get('/new', (c) => {
    return render(c, 'products/new', {})
  })
  .use('/findbyname', rateLimit({ windowMs: 60_000, max: 100, keyPrefix: 'findbyname' }))
  .get('/findbyname', async (c) => {
    // Clamp to the maximum product name length: longer prefixes cannot match
    // anything and oversized LIKE patterns make SQLite throw a 500.
    const q = (c.req.query('q') ?? '').slice(0, MAX_NAME_LENGTH)
    const page = readPage(c)
    const pattern = namePrefixPattern(q)
    const { products, hasMore } = await loadProductsPage(page, pattern)
    return render(c, 'products/index', {
      products: pagedProducts(c, products, page, hasMore),
      // Only called when the list exceeds PER_PAGE (the client switches to
      // server filtering in that mode), so no count is needed here.
      serverFilter: true,
      q,
    })
  })
  .post('/', async (c) => {
    const body = await readJsonBody(c)
    if (body === null) {
      return render(c, 'products/new', { errors: { write: t(c, 'Invalid request body') } })
    }

    const result = validateProduct(body)

    if (!result.valid) {
      return render(c, 'products/new', { errors: translateFieldErrors(c, result.errors) })
    }

    if (await productNameExists(result.data.productName)) {
      return render(c, 'products/new', { errors: { productName: t(c, 'A product with this name already exists') } })
    }

    try {
      await getDB().insert(tables.products).values({
        name: result.data.productName,
        description: result.data.description,
        price: priceToCents(result.data.price),
        createdBy: c.var.authUser?.login ?? DEFAULT_USER,
      })
      await flashSuccess(c, t(c, 'Product created successfully'))
      return c.redirect('/products', 303)
    } catch {
      return render(c, 'products/new', { errors: { write: t(c, 'Could not create product') } })
    }
  })
  .get('/:id/edit', async (c) => {
    const id = readId(c)
    const dbProduct = id === null ? undefined : await getProductById(id)
    if (!dbProduct) return c.notFound()
    const product = toProduct(dbProduct)
    return render(c, 'products/edit', { product })
  })
  .patch('/:id', async (c) => {
    const id = readId(c)
    if (id === null) return c.notFound()

    const body = await readJsonBody(c)
    if (body === null) {
      // No usable body: re-render the form with the stored product and an error.
      const dbProduct = await getProductById(id)
      if (!dbProduct) return c.notFound()
      return render(c, 'products/edit', {
        product: toProduct(dbProduct),
        errors: { write: t(c, 'Invalid request body') },
      })
    }

    const staleProduct: ProductType = {
      id,
      productName: typeof body.productName === 'string' ? body.productName : '',
      description: typeof body.description === 'string' ? body.description : '',
      price: typeof body.price === 'number' ? body.price : null,
      modifiedAt: body.modifiedAt ?? null,
    }

    const result = validateProduct(body)
    if (!result.valid) {
      return render(c, 'products/edit', { product: staleProduct, errors: translateFieldErrors(c, result.errors) })
    }

    if (await productNameExists(result.data.productName, id)) {
      return render(c, 'products/edit', { product: staleProduct, errors: { productName: t(c, 'A product with this name already exists') } })
    }

    // Optimistic concurrency: only update if the product was not changed or removed since it was opened.
    const modifiedAt = body.modifiedAt
    const verifyModifiedAt = !modifiedAt ? null : new Date(modifiedAt)

    try {
      const updatedProductIds: { updatedId: number }[] = await getDB()
        .update(tables.products)
        .set({
          name: result.data.productName,
          description: result.data.description,
          price: priceToCents(result.data.price),
          modifiedBy: c.var.authUser?.login ?? DEFAULT_USER,
          modifiedAt: new Date(),
        })
        .where(and(
          eq(tables.products.id, id),
          verifyModifiedAt === null
            ? isNull(tables.products.modifiedAt)
            : eq(tables.products.modifiedAt, verifyModifiedAt),
        ))
        .returning({ updatedId: tables.products.id })

      if (updatedProductIds.length === 0) {
        const message = t(c, "'{0}' is changed or removed by another user. Reopen it from the list.", result.data.productName)
        return render(c, 'products/edit', { product: staleProduct, errors: { write: message } })
      }

      await flashSuccess(c, t(c, 'Product updated successfully'))
      return c.redirect('/products', 303)
    } catch {
      return render(c, 'products/edit', { product: staleProduct, errors: { write: t(c, 'Could not update product') } })
    }
  })
  .get('/:id/delete', async (c) => {
    const id = readId(c)
    const dbProduct = id === null ? undefined : await getProductById(id)
    if (!dbProduct) return c.notFound()
    const product = toProduct(dbProduct)
    return render(c, 'products/delete', { product })
  })
  .delete('/:id', async (c) => {
    const id = readId(c)
    // Deleting a product that is already gone (or an invalid id) is treated as success.
    if (id !== null) {
      await getDB().delete(tables.products).where(eq(tables.products.id, id))
    }
    await flashSuccess(c, t(c, 'Product deleted successfully'))
    return c.redirect('/products', 303)
  })

export type AppType = typeof app
export default app
