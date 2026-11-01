import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

// AGENT_PRODUCTS_DISABLED=1 must switch off the agent product write routes
// (POST = new, PATCH = edit, DELETE = delete). The gate is middleware on the
// /products sub-router of the agent app, so it runs before every verb handler.
// The sub-router is requested directly because agent auth (requireAgentAuth)
// touches the pairing table even in its AUTH_DISABLED dev bypass — and these
// DB-free tests must never reach the database.

const originalAgentProductsDisabled = process.env.AGENT_PRODUCTS_DISABLED

let products: (typeof import('@/routes/agent/products'))['default']

beforeAll(async () => {
  ;({ default: products } = await import('@/routes/agent/products'))
})

afterAll(() => {
  if (originalAgentProductsDisabled === undefined) delete process.env.AGENT_PRODUCTS_DISABLED
  else process.env.AGENT_PRODUCTS_DISABLED = originalAgentProductsDisabled
})

describe('agent products write gate (AGENT_PRODUCTS_DISABLED)', () => {
  test('POST /agent/products (new) returns 403 when disabled', async () => {
    process.env.AGENT_PRODUCTS_DISABLED = '1'
    const res = await products.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productName: 'x', price: 1 }),
    })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Agent product API is disabled (AGENT_PRODUCTS_DISABLED=1)' })
  })

  test('PATCH /agent/products/:id (edit) returns 403 when disabled', async () => {
    process.env.AGENT_PRODUCTS_DISABLED = '1'
    const res = await products.request('/1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productName: 'x', price: 1 }),
    })
    expect(res.status).toBe(403)
  })

  test('DELETE /agent/products/:id (delete) returns 403 when disabled', async () => {
    process.env.AGENT_PRODUCTS_DISABLED = '1'
    const res = await products.request('/1', { method: 'DELETE' })
    expect(res.status).toBe(403)
  })
})
