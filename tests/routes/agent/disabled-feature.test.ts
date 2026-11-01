import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

// AGENT_DISABLED=1 is the master switch for the whole agent feature: it runs
// before requireAgentAuth on /agent/*, so every verb answers plain 404 and no
// auth (hence no pairing-table/DB access) is ever touched. These DB-free tests
// therefore exercise the deep request chain safely.

const originalAgentDisabled = process.env.AGENT_DISABLED
const originalNodeEnv = process.env.NODE_ENV

let app: (typeof import('@/server'))['app']

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  ;({ app } = await import('@/server'))
})

afterAll(() => {
  if (originalAgentDisabled === undefined) delete process.env.AGENT_DISABLED
  else process.env.AGENT_DISABLED = originalAgentDisabled
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalNodeEnv
})

describe('agent feature switch (AGENT_DISABLED=1)', () => {
  test('GET /agent/screens answers 404 when disabled', async () => {
    process.env.AGENT_DISABLED = '1'
    const res = await app.request('/agent/screens')
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('Not Found')
  })

  test('POST /agent/navigate answers 404 when disabled', async () => {
    process.env.AGENT_DISABLED = '1'
    const res = await app.request('/agent/navigate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ screen: 'products' }),
    })
    expect(res.status).toBe(404)
  })

  test('DELETE /agent/products/:id answers 404 when disabled', async () => {
    process.env.AGENT_DISABLED = '1'
    const res = await app.request('/agent/products/1', { method: 'DELETE' })
    expect(res.status).toBe(404)
  })
})
