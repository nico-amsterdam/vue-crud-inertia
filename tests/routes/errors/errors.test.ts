import { describe, expect, test } from 'bun:test'
import { Hono, type Context } from 'hono'
import type { AppEnv } from '../../../src/types/env'
import { errorPage, renderNotFound } from '../../../src/routes/errors'

/**
 * A minimal routing app with an "inertia" stub, so the error page helpers can
 * be exercised without Vite or D1: `render` answers like an Inertia XHR page
 * (200 + x-inertia). `status` overrides it for the pass-through test.
 */
function testApp(handler: (c: Context<AppEnv>) => Promise<Response>, status = 200): Hono<AppEnv> {
  const app = new Hono<AppEnv>()
  app.all('*', async (c) => {
    c.set('inertia', {
      render: async (component: string, props: Record<string, unknown>) =>
        new Response(JSON.stringify({ component, props }), {
          status,
          headers: { 'x-inertia': 'true', 'content-type': 'application/json' },
        }),
    } as never)
    return handler(c)
  })
  return app
}

describe('friendly error pages', () => {
  test('renderNotFound fuses the Inertia page with the real 404 status', async () => {
    const res = await testApp((c) => renderNotFound(c)).request('/products/400/edit')
    expect(res.status).toBe(404)
    expect(res.headers.get('x-inertia')).toBe('true')

    const body = (await res.json()) as { component: string; props: Record<string, string> }
    expect(body.component).toBe('errors/notfound')
    expect(body.props.path).toBe('/products/400/edit')
  })

  test('errorPage renders the internalerror component with a 500 status', async () => {
    const res = await testApp((c) => errorPage(c, 'errors/internalerror', 500)).request('/products/1', {
      method: 'PATCH',
    })
    expect(res.status).toBe(500)

    const body = (await res.json()) as { component: string }
    expect(body.component).toBe('errors/internalerror')
  })

  test('protocol responses keep their own status (no page fusing)', async () => {
    const res = await testApp((c) => renderNotFound(c), 409).request('/just/about/anything')
    expect(res.status).toBe(409)
  })
})
