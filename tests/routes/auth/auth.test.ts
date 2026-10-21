import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

// The real app wiring: requireAuth/csrfProtect must cover /products AND its
// subpaths. Hono's .use('/products', mw) matches the exact path only — the
// bug this test guards against (csrfToken was shared as '' on /products/new,
// and PATCH/DELETE bypassed CSRF entirely).
const originalAuthDisabled = process.env.AUTH_DISABLED
const originalNodeEnv = process.env.NODE_ENV

let app: (typeof import('../../../src/server'))['app']

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  ;({ app } = await import('../../../src/server'))
})

afterAll(() => {
  if (originalAuthDisabled === undefined) delete process.env.AUTH_DISABLED
  else process.env.AUTH_DISABLED = originalAuthDisabled
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalNodeEnv
})

describe('products route protection', () => {
  test('GET /products redirects to login without a session', async () => {
    delete process.env.AUTH_DISABLED
    const res = await app.request('/products')
    expect(res.status).toBe(307)
    expect(res.headers.get('Location')).toContain('/auth/login')
  })

  test('GET /products/new (subpath) redirects to login without a session', async () => {
    delete process.env.AUTH_DISABLED
    const res = await app.request('/products/new')
    expect(res.status).toBe(307)
    expect(res.headers.get('Location')).toContain('/auth/login')
  })

  test('GET /products/:id/edit (subpath) redirects to login without a session', async () => {
    delete process.env.AUTH_DISABLED
    const res = await app.request('/products/1/edit')
    expect(res.status).toBe(307)
    expect(res.headers.get('Location')).toContain('/auth/login')
  })

  test('GET /products with X-Inertia gets a 409 location instead of a 307', async () => {
    delete process.env.AUTH_DISABLED
    const res = await app.request('/products', { headers: { 'X-Inertia': 'true' } })
    expect(res.status).toBe(409)
    expect(res.headers.get('X-Inertia-Location')).toBe('/auth/login')
  })

  test('POST /products without the x-csrf-token header is rejected', async () => {
    process.env.AUTH_DISABLED = '1'
    const res = await app.request('/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productName: 'x', price: 1 }),
    })
    expect(res.status).toBe(403)
    expect(await res.text()).toContain('Invalid CSRF token')
  })

  test('PATCH /products/:id (subpath) without the x-csrf-token header is rejected', async () => {
    process.env.AUTH_DISABLED = '1'
    const res = await app.request('/products/1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productName: 'x', price: 1 }),
    })
    expect(res.status).toBe(403)
    expect(await res.text()).toContain('Invalid CSRF token')
  })

  test('DELETE /products/:id (subpath) without the x-csrf-token header is rejected', async () => {
    process.env.AUTH_DISABLED = '1'
    const res = await app.request('/products/1', { method: 'DELETE' })
    expect(res.status).toBe(403)
    expect(await res.text()).toContain('Invalid CSRF token')
  })
})

describe('security headers', () => {
  test('HTML pages get a nonce-based CSP and baseline headers', async () => {
    process.env.AUTH_DISABLED = '1'
    const res = await app.request('/products/new')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'")
    expect(res.headers.get('Content-Security-Policy')).toContain('script-src')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(res.headers.get('Permissions-Policy')).toContain('camera=()')
    // HSTS is production-only.
    expect(res.headers.get('Strict-Transport-Security')).toBeNull()
  })
})
