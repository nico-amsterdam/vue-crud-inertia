import { Hono, type Context } from 'hono'
import { render } from '@sneakylenny/inertia-hono'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { getDB, tables } from '../db/index'
import type { ProductBaseType, ProductErrorsType, ProductType } from '../types/product'
import type { AppEnv } from '../types/env'
import { getContentLanguage } from '../i18n/lang'
import { translate } from '../i18n/translations'

/** Translate an English message key for the current request language. */
function t(c: Context, key: string, ...args: string[]): string {
  return translate(getContentLanguage(c), key, args)
}

/** Translate the English message keys in per-field errors returned by validateProduct(). */
function translateFieldErrors(c: Context, errors: ProductErrorsType): ProductErrorsType {
  const translated: ProductErrorsType = {}
  if (errors.productName) translated.productName = t(c, errors.productName)
  if (errors.description) translated.description = t(c, errors.description)
  if (errors.price) translated.price = t(c, errors.price)
  return translated
}

/*
 * Database-backed product store
 */

type DBProduct = typeof tables.products.$inferSelect

const DEFAULT_USER = 'system'

function toProduct(dbProduct: DBProduct): ProductType {
  return {
    id: dbProduct.id,
    productName: dbProduct.name,
    description: dbProduct.description,
    price: dbProduct.price === null ? null : dbProduct.price / 100,
    modifiedAt: dbProduct.modifiedAt ? new Date(dbProduct.modifiedAt).toISOString() : null,
  }
}

async function loadProducts(): Promise<ProductType[]> {
  const dbProducts = await getDB()
    .select()
    .from(tables.products)
    .orderBy(asc(tables.products.name))
  return dbProducts.map(toProduct)
}

async function productNameExists(productName: string, excludeId?: number): Promise<boolean> {
  const existing = await getDB()
    .select()
    .from(tables.products)
    .where(eq(tables.products.name, productName))
    .get()
  if (!existing) return false
  return excludeId === undefined || existing.id !== excludeId
}

function priceToCents(price: number | null): number | null {
  return price === null ? null : Math.round(price * 100)
}

function validateProduct(body: Partial<ProductBaseType>): { valid: true; data: ProductBaseType } | { valid: false; errors: ProductErrorsType } {
  const errors: ProductErrorsType = {}
  const productName = typeof body.productName === 'string' ? body.productName.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const priceText = body.price === null || body.price === undefined ? '' : String(body.price).trim()
  const price = priceText === '' ? null : Number(priceText)

  if (!productName) errors.productName = 'Product name is required'
  else if (productName.length > 20) errors.productName = 'Product name must be at most 20 characters'

  if (description.length > 300) errors.description = 'Description must be at most 300 characters'

  if (price !== null) {
    if (Number.isNaN(price) || price < 0) errors.price = 'Price must be a non-negative number'
    else if (Math.abs(Math.round(price * 100) - price * 100) > 1e-6) {
      errors.price = 'Price must have at most 2 decimal places'
    }
  }

  if (errors.productName || errors.description || errors.price) return { valid: false, errors }

  return {
    valid: true,
    data: {
      productName,
      description,
      price,
      modifiedAt: new Date().toISOString(),
    },
  }
}

/*
 * Routes: mounted on `/products` by the app in src/server.ts
 */

const app = new Hono<AppEnv>()
  .get('/', async (c) => {
    const products = await loadProducts()
    return render(c, 'products/index', { products })
  })
  .get('/new', (c) => {
    return render(c, 'products/new', {})
  })
  .post('/', async (c) => {
    const body = await c.req.json<Partial<ProductBaseType>>()
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
        createdBy: DEFAULT_USER,
      })
      return c.redirect('/products', 303)
    } catch {
      return render(c, 'products/new', { errors: { write: t(c, 'Could not create product') } })
    }
  })
  .get('/:id/edit', async (c) => {
    const id = Number(c.req.param('id'))
    const dbProduct = await getDB()
      .select()
      .from(tables.products)
      .where(eq(tables.products.id, id))
      .get()
    if (!dbProduct) return c.notFound()
    const product = toProduct(dbProduct)
    return render(c, 'products/edit', { product })
  })
  .patch('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const body = await c.req.json<Partial<ProductBaseType>>()
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
          modifiedBy: DEFAULT_USER,
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

      return c.redirect('/products', 303)
    } catch {
      return render(c, 'products/edit', { product: staleProduct, errors: { write: t(c, 'Could not update product') } })
    }
  })
  .get('/:id/delete', async (c) => {
    const id = Number(c.req.param('id'))
    const dbProduct = await getDB()
      .select()
      .from(tables.products)
      .where(eq(tables.products.id, id))
      .get()
    if (!dbProduct) return c.notFound()
    const product = toProduct(dbProduct)
    return render(c, 'products/delete', { product })
  })
  .delete('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    // Deleting a product that is already gone is treated as success.
    await getDB().delete(tables.products).where(eq(tables.products.id, id))
    return c.redirect('/products', 303)
  })

export type AppType = typeof app
export default app
