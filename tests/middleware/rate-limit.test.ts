import { describe, it, expect } from 'bun:test'
import { Hono } from 'hono'
import { rateLimit } from '../../src/middleware/rate-limit'

function makeApp(max: number, keyPrefix: string) {
  return new Hono().use(rateLimit({ windowMs: 60_000, max, keyPrefix })).get('/x', (c) => c.text('ok'))
}

describe('rateLimit', () => {
  it('allows requests up to the limit', async () => {
    const app = makeApp(3, 'allows')
    for (let i = 0; i < 3; i++) {
      const res = await app.request('/x')
      expect(res.status).toBe(200)
    }
  })

  it('returns 429 with Retry-After once the limit is exceeded', async () => {
    const app = makeApp(2, 'exceeded')
    await app.request('/x')
    await app.request('/x')
    const res = await app.request('/x')
    expect(res.status).toBe(429)
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0)
  })

  it('keys buckets by keyPrefix so limiters do not share counters', async () => {
    const appA = makeApp(1, 'prefix-a')
    const appB = makeApp(1, 'prefix-b')
    expect((await appA.request('/x')).status).toBe(200)
    expect((await appA.request('/x')).status).toBe(429)
    // appB has its own counter and is not affected by appA's exhausted bucket
    expect((await appB.request('/x')).status).toBe(200)
  })
})
