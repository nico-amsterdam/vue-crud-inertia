import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

// AGENT_ENABLED is an allow-list of agent capabilities. When it is set and
// does not contain 'products', the agent product write routes (POST = new,
// PATCH = edit, DELETE = delete) must answer 403. The gate is middleware on
// the /products sub-router of the agent app, so it runs before every verb
// handler. The sub-router is requested directly because agent auth
// (requireAgentAuth) touches the pairing table even in its AUTH_DISABLED dev
// bypass — and these DB-free tests must never reach the database.

const originalAgentEnabled = process.env.AGENT_ENABLED

let products: (typeof import('@/routes/agent/products'))['default']

beforeAll(async () => {
  ;({ default: products } = await import('@/routes/agent/products'))
})

afterAll(() => {
  if (originalAgentEnabled === undefined) delete process.env.AGENT_ENABLED
  else process.env.AGENT_ENABLED = originalAgentEnabled
})

describe('agent products capability gate (AGENT_ENABLED)', () => {
  test('POST /agent/products (new) returns 403 when products is not enabled', async () => {
    process.env.AGENT_ENABLED = 'screens,navigate'
    const res = await products.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productName: 'x', price: 1 }),
    })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "Agent capability 'products' is not in AGENT_ENABLED" })
  })

  test('PATCH /agent/products/:id (edit) returns 403 when the list is empty', async () => {
    process.env.AGENT_ENABLED = ''
    const res = await products.request('/1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productName: 'x', price: 1 }),
    })
    expect(res.status).toBe(403)
  })

  test('DELETE /agent/products/:id (delete) returns 403 when the list is empty', async () => {
    process.env.AGENT_ENABLED = ''
    const res = await products.request('/1', { method: 'DELETE' })
    expect(res.status).toBe(403)
  })
})
