import { Hono, type Context } from 'hono'
import { serveStatic } from 'hono/serve-static'
import { raw } from 'hono/html'
import {
  createInertia,
  createViteHtmlRenderer,
  render,
  type InertiaVariables,
} from '@sneakylenny/inertia-hono'
import { asc, eq } from 'drizzle-orm'
import { getDB, tables } from './db/index.js'
import type { ProductBaseType, ProductType } from './types/product.js'
import manifest from './generated/manifest.js'

const isDev = process.env.NODE_ENV !== 'production'

type AppEnv = {
  Variables: InertiaVariables
  Bindings: {
    ASSETS?: { fetch: typeof fetch }
  }
}

export const app = new Hono<AppEnv>()

function staticServe(root: string) {
  return serveStatic({
    root,
    getContent: async (path: string, c: Context<AppEnv>) => {
      if (typeof Bun !== 'undefined') {
        const file = Bun.file(path)
        return await file.exists() ? (file as Blob) : null
      }
      const assets = c.env.ASSETS
      if (!assets) return null
      const response = await assets.fetch(c.req.url)
      return response.ok ? response : null
    },
  })
}

app.use('/css/*', staticServe('./public'))
app.use('/manifest.webmanifest', staticServe('./public'))

if (!isDev) {
  app.use('/assets/*', staticServe('./dist'))
}

const { middleware } = createInertia({
  version: '1',
  renderHtml: createViteHtmlRenderer({
    dev: isDev,
    entry: 'src/inertia/main.ts',
    manifest: isDev ? null : manifest,
    htmlAttrs: { class: 'retro' },
    head: raw('<link rel="stylesheet" href="/css/bootstrap3-un.css" />'),
  }),
})

app.use(middleware)

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

function validateProduct(body: Partial<ProductBaseType>): { valid: true; data: ProductBaseType } | { valid: false; errors: string[] } {
  const errors: string[] = []
  const productName = typeof body.productName === 'string' ? body.productName.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const price = body.price === null || body.price === undefined ? null : Number(body.price)

  if (!productName) errors.push('Product name is required')
  else if (productName.length > 20) errors.push('Product name must be at most 20 characters')

  if (!description) errors.push('Description is required')
  else if (description.length > 300) errors.push('Description must be at most 300 characters')

  if (price === null || Number.isNaN(price) || price < 0) errors.push('Price must be a non-negative number')
  else if (price !== null && Math.abs(Math.round(price * 100) - price * 100) > 1e-6) {
    errors.push('Price must have at most 2 decimal places')
  }

  if (errors.length > 0) return { valid: false, errors }

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
 * Routes
 */

app.get('/', c => c.redirect('/products'))

app.get('/products', async (c) => {
  const products = await loadProducts()
  return render(c, 'products/index', { products })
})

app.get('/products/new', async (c) => {
  const products = await loadProducts()
  return render(c, 'products/new', { products })
})

app.post('/products', async (c) => {
  const body = await c.req.json<Partial<ProductBaseType>>()
  const result = validateProduct(body)
  const products = await loadProducts()

  if (!result.valid) {
    return render(c, 'products/new', { products, errors: { write: result.errors.join('. ') } })
  }

  if (await productNameExists(result.data.productName)) {
    return render(c, 'products/new', { products, errors: { write: 'A product with this name already exists' } })
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
    return render(c, 'products/new', { products, errors: { write: 'Could not create product' } })
  }
})

app.get('/products/:id/edit', async (c) => {
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

app.patch('/products/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const dbProduct = await getDB()
    .select()
    .from(tables.products)
    .where(eq(tables.products.id, id))
    .get()
  if (!dbProduct) return c.notFound()

  const body = await c.req.json<Partial<ProductBaseType>>()
  const result = validateProduct(body)
  if (!result.valid) {
    return render(c, 'products/edit', { product: toProduct(dbProduct), errors: { write: result.errors.join('. ') } })
  }

  if (await productNameExists(result.data.productName, id)) {
    return render(c, 'products/edit', { product: toProduct(dbProduct), errors: { write: 'A product with this name already exists' } })
  }

  try {
    await getDB()
      .update(tables.products)
      .set({
        name: result.data.productName,
        description: result.data.description,
        price: priceToCents(result.data.price),
        modifiedBy: DEFAULT_USER,
        modifiedAt: new Date(),
      })
      .where(eq(tables.products.id, id))
    return c.redirect('/products', 303)
  } catch {
    return render(c, 'products/edit', { product: toProduct(dbProduct), errors: { write: 'Could not update product' } })
  }
})

app.get('/products/:id/delete', async (c) => {
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

app.delete('/products/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const dbProduct = await getDB()
    .select()
    .from(tables.products)
    .where(eq(tables.products.id, id))
    .get()
  if (!dbProduct) return c.notFound()

  await getDB().delete(tables.products).where(eq(tables.products.id, id))
  return c.redirect('/products', 303)
})
