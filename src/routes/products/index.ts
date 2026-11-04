import { Hono } from 'hono'
import type { Context } from 'hono'
import { render, scroll } from '@sneakylenny/inertia-hono'
import type { ProductBaseType, ProductErrorsType, ProductType } from '@/types/product'
import type { AppEnv } from '@/types/env'
import { t } from '@/i18n/request'
import { rateLimit } from '@/middleware/rate-limit'
import { renderNotFound } from '@/routes/errors'
import { setState, userStateKey } from '@/routes/agent/store'
import {
  DEFAULT_USER,
  createProduct,
  deleteProduct,
  getProductById,
  loadProductsPage,
  namePrefixPattern,
  toProduct,
  updateProduct,
} from './store'
import { MAX_NAME_LENGTH, translateFieldErrors, parseProductPayload } from './validation'

/** Highest page accepted from the client. Prevents huge OFFSET values from
 *  overflowing SQLite's integer range (e.g. `?page=1e308` used to 500).
 */
export const MAX_PAGE = 1_000_000

/** The 1-based page number requested by the client. */
function readPage(c: Context): number {
  const page = Number(c.req.query('page') ?? 1)
  return Number.isFinite(page) && page >= 1 ? Math.min(Math.floor(page), MAX_PAGE) : 1
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

/**
 * Remember the last form submission (new/edit) of this browser session in the
 * shared `app_state` store, so an external agent can ask what the form sent
 * and which errors the UI showed (read via `GET /agent/form`). `values` are
 * the fields as submitted: the raw JSON body (new) or the normalized form
 * values (edit — `submittedProduct`, which preserves the original
 * `modifiedAt` token), or null when the body could not be parsed at all.
 * `errors` are the translated per-field errors returned to the client, or
 * null after a successful submission.
 */
async function captureSubmission(
  c: Context<AppEnv>,
  screen: 'products/new' | 'products/edit',
  id: number | null,
  values: Partial<ProductBaseType> | ProductType | null,
  errors: ProductErrorsType | null,
): Promise<void> {
  await setState(userStateKey(c.var.sessionId, 'lastSubmission'), {
    screen,
    id,
    values,
    errors: errors ?? null,
    succeeded: errors === null,
    at: new Date().toISOString(),
  })
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
      const errors = { write: t(c, 'Invalid request body') }
      await captureSubmission(c, 'products/new', null, null, errors)
      return render(c, 'products/new', { errors })
    }

    const result = parseProductPayload(body)

    if (!result.valid) {
      const errors = translateFieldErrors(c, result.errors)
      await captureSubmission(c, 'products/new', null, body, errors)
      return render(c, 'products/new', { errors })
    }

    // createProduct reports every predictable failure via its result; unexpected
    // server errors are deliberately not caught here — the global app.onError
    // (server.ts) logs them and renders the friendly 500 page.
    const created = await createProduct(result.data, c.var.authUser?.login ?? DEFAULT_USER)
    if (!created.ok) {
      const errors = created.reason === 'duplicate-name'
        ? { productName: t(c, 'A product with this name already exists') }
        : { write: t(c, 'Could not create product') }
      await captureSubmission(c, 'products/new', null, body, errors)
      return render(c, 'products/new', { errors })
    }
    await captureSubmission(c, 'products/new', null, body, null)
    await flashSuccess(c, t(c, 'Product created successfully'))
    return c.redirect('/products', 303)
  })
  .get('/:id/edit', async (c) => {
    const id = readId(c)
    const dbProduct = id === null ? undefined : await getProductById(id)
    if (!dbProduct) return renderNotFound(c)
    const product = toProduct(dbProduct)
    return render(c, 'products/edit', { product })
  })
  .patch('/:id', async (c) => {
    // PATCH here means COMPLETE REPLACEMENT, not partial merge: the body must be
    // the full valid product (as sent by the edit form); validateProduct applies
    // empty defaults to omitted fields (description → '', price → null). Don't
    // "fix" this into merge semantics without choosing a merge format first.
    const id = readId(c)
    if (id === null) return renderNotFound(c)

    const body = await readJsonBody(c)
    if (body === null) {
      // No usable body: re-render the form with the stored product and an error.
      const dbProduct = await getProductById(id)
      if (!dbProduct) return renderNotFound(c)
      const errors = { write: t(c, 'Invalid request body') }
      await captureSubmission(c, 'products/edit', id, null, errors)
      return render(c, 'products/edit', {
        product: toProduct(dbProduct),
        errors,
      })
    }

    // The values the user just submitted (not the DB row): on a validation or
    // duplicate-name failure we re-render the form with their input preserved
    // instead of clobbering it with the stored (possibly concurrently changed)
    // product. Unlike validateProduct().data, this keeps the original
    // modifiedAt token so the optimistic-concurrency check survives the round trip.
    const submittedProduct: ProductType = {
      id,
      productName: typeof body.productName === 'string' ? body.productName : '',
      description: typeof body.description === 'string' ? body.description : '',
      price: typeof body.price === 'number' ? body.price : null,
      modifiedAt: body.modifiedAt ?? null,
    }

    const result = parseProductPayload(body)
    if (!result.valid) {
      const errors = translateFieldErrors(c, result.errors)
      await captureSubmission(c, 'products/edit', id, submittedProduct, errors)
      return render(c, 'products/edit', { product: submittedProduct, errors })
    }

    // Optimistic concurrency: only update if the product was not changed or removed since it was opened.
    const modifiedAt = body.modifiedAt
    const verifyModifiedAt = !modifiedAt ? null : new Date(modifiedAt)

    const updatedProducts = await updateProduct(
      id,
      result.data,
      c.var.authUser?.login ?? DEFAULT_USER,
      verifyModifiedAt ?? null,
    )

    if (updatedProducts.ok) {
      await captureSubmission(c, 'products/edit', id, submittedProduct, null)
      await flashSuccess(c, t(c, 'Product updated successfully'))
      return c.redirect('/products', 303)
    }

    if (updatedProducts.reason === 'duplicate-name') {
      const errors = { productName: t(c, 'A product with this name already exists') }
      await captureSubmission(c, 'products/edit', id, submittedProduct, errors)
      return render(c, 'products/edit', { product: submittedProduct, errors })
    }
    if (updatedProducts.reason === 'write-failed') {
      const errors = { write: t(c, 'Could not update product') }
      await captureSubmission(c, 'products/edit', id, submittedProduct, errors)
      return render(c, 'products/edit', { product: submittedProduct, errors })
    }

    // `not-found`: missing id or changed/removed concurrently (the optimistic-
    // concurrency condition filtered the row out). The id itself is validated
    // above, so this reads as an edit conflict: point the user back to the list.
    const message = t(c, "'{0}' is changed or removed by another user. Reopen it from the list.", result.data.productName)
    const errors = { write: message }
    await captureSubmission(c, 'products/edit', id, submittedProduct, errors)
    return render(c, 'products/edit', { product: submittedProduct, errors })
  })
  .get('/:id/delete', async (c) => {
    const id = readId(c)
    const dbProduct = id === null ? undefined : await getProductById(id)
    if (!dbProduct) return renderNotFound(c)
    const product = toProduct(dbProduct)
    return render(c, 'products/delete', { product })
  })
  .delete('/:id', async (c) => {
    const id = readId(c)
    // Deleting a product that is already gone (or an invalid id) is treated as success.
    if (id !== null) {
      await deleteProduct(id)
    }
    await flashSuccess(c, t(c, 'Product deleted successfully'))
    return c.redirect('/products', 303)
  })

export type AppType = typeof app
export default app
