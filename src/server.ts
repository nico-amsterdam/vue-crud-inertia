import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { raw } from 'hono/html'
import {
  createInertia,
  createViteHtmlRenderer,
  readViteManifest,
  render,
  type InertiaVariables,
} from '@sneakylenny/inertia-hono'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ProductBaseType, ProductType } from './types/product.js'

const isDev = process.env.NODE_ENV !== 'production'
const distRoot = resolve(join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist'))

export const app = new Hono<{ Variables: InertiaVariables }>()

app.use('/css/*', serveStatic({ root: './public' }))
app.use('/manifest.webmanifest', serveStatic({ root: './public' }))

if (!isDev) {
  app.use('/assets/*', serveStatic({ root: './dist' }))
}

const { middleware } = createInertia({
  version: '1',
  renderHtml: createViteHtmlRenderer({
    dev: isDev,
    entry: 'src/inertia/main.ts',
    manifest: isDev ? null : await readViteManifest(distRoot),
    htmlAttrs: { class: 'retro' },
    head: raw('<link rel="stylesheet" href="/css/bootstrap3-un.css" />'),
  }),
})

app.use(middleware)

/*
 * In-memory product store
 */

let nextId = 4
const products: ProductType[] = [
  { id: 1, productName: 'T-shirt', description: 'A nice cotton t-shirt', price: 19.99, modifiedAt: null },
  { id: 2, productName: 'Jeans', description: 'Blue denim jeans', price: 49.99, modifiedAt: null },
  { id: 3, productName: 'Sneakers', description: 'Comfortable running shoes', price: 89.99, modifiedAt: null },
]

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

app.get('/products', c => render(c, 'products/index', { products }))

app.get('/products/new', c => render(c, 'products/new', { products }))

app.post('/products', async (c) => {
  const body = await c.req.json<Partial<ProductBaseType>>()
  const result = validateProduct(body)
  if (!result.valid) {
    return render(c, 'products/new', { products, errors: { write: result.errors.join('. ') } })
  }

  const newProduct: ProductType = { id: nextId++, ...result.data }
  products.push(newProduct)
  return c.redirect('/products', 303)
})

app.get('/products/:id/edit', (c) => {
  const id = Number(c.req.param('id'))
  const product = products.find(p => p.id === id) ?? null
  if (!product) return c.notFound()
  return render(c, 'products/edit', { product })
})

app.patch('/products/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const index = products.findIndex(p => p.id === id)
  if (index === -1) return c.notFound()

  const body = await c.req.json<Partial<ProductBaseType>>()
  const result = validateProduct(body)
  if (!result.valid) {
    return render(c, 'products/edit', { product: products[index], errors: { write: result.errors.join('. ') } })
  }

  products[index] = { id, ...result.data }
  return c.redirect('/products', 303)
})

app.get('/products/:id/delete', (c) => {
  const id = Number(c.req.param('id'))
  const product = products.find(p => p.id === id) ?? null
  if (!product) return c.notFound()
  return render(c, 'products/delete', { product })
})

app.delete('/products/:id', (c) => {
  const id = Number(c.req.param('id'))
  const index = products.findIndex(p => p.id === id)
  if (index === -1) return c.notFound()

  products.splice(index, 1)
  return c.redirect('/products', 303)
})
