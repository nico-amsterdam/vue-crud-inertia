import { Hono } from 'hono'
import type { Context, MiddlewareHandler } from 'hono'
import type { AppEnv } from '../../types/env'
import { readSession } from '../auth/common'
import { validateProduct } from '../products/validation'
import {
  AGENT_HEARTBEAT_INTERVAL_MS,
  AGENT_IDLE_TIMEOUT_MS,
  getPairing,
  getState as storeGetState,
  removePairing,
  setState as storeSetState,
  touchPairing,
  upsertPairing,
} from './store'
import { createProduct, deleteProduct, getProductById, loadProductsPage, productNameExists, toProduct, updateProduct } from '../products/store'

export { AGENT_HEARTBEAT_INTERVAL_MS, AGENT_IDLE_TIMEOUT_MS }

/*
 * Constants
 */

export const AGENT_PAIRING_HEADER = 'x-pairing-code'
export const DEV_PAIRING_SESSION_ID = 'dev-local'
export const DEFAULT_AGENT_USER = 'agent'

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

export const SCREENS: Record<string, { route: string; context: string[] }> = {
  'products': { route: '/products', context: ['page', 'q'] },
  'products/new': { route: '/products/new', context: [] },
  'products/edit': { route: '/products/:id/edit', context: ['id'] },
  'products/delete': { route: '/products/:id/delete', context: ['id'] },
}

/*
 * Functions
 */

export const requireAgentAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (process.env.AUTH_DISABLED === '1' && process.env.NODE_ENV !== 'production') {
    c.set('authUser', { login: 'dev:local', name: 'Local Dev', email: '', avatar_url: '' })
    c.set('csrfToken', 'dev-csrf-token')
    c.set('agentSessionId', DEV_PAIRING_SESSION_ID)
    return next()
  }

  // 1) Browser request (session cookie)
  const session = await readSession(c)
  if (session) {
    if (MUTATING_METHODS.includes(c.req.method) && c.req.header('x-csrf-token') !== session.csrfToken) {
      return c.text('Invalid CSRF token', 403)
    }
    c.set('authUser', { login: session.login, name: session.name, email: session.email, avatar_url: session.image })
    c.set('csrfToken', session.csrfToken)
    c.set('agentSessionId', session.id)
    await touchPairing(session.id)
    return next()
  }

  // 2) Agent request (pairing code only)
  const code = c.req.header(AGENT_PAIRING_HEADER)
  if (code) {
    const row = await getPairing(code)
    if (!row) return c.json({ error: 'Invalid pairing code' }, 401)
    if (!row.lastAccessedAt || Date.now() - row.lastAccessedAt.getTime() > AGENT_IDLE_TIMEOUT_MS) {
      return c.json({ error: 'Pairing window expired: the paired browser has not polled for 5 minutes' }, 401)
    }
    c.set('authUser', { login: row.login, name: '', email: '', avatar_url: '' })
    c.set('agentSessionId', code)
    return next()
  }

  return c.json({ error: 'Not authenticated' }, 401)
}

function userKey(c: Context, key: string): string {
  return `${key}:${c.var.authUser?.login ?? 'anon'}`
}

function getState(c: Context, key: string): Promise<any | null> {
  const login = c.var.authUser?.login ?? 'anon'
  return storeGetState(login, key)
}

async function setState(c: Context, key: string, value: any): Promise<void> {
  const login = c.var.authUser?.login ?? 'anon'
  await storeSetState(login, key, value)
}

/*
 * Routes
 */

const app = new Hono<AppEnv>()
  .get('/screen', async (c) => {
    const nav = await getState(c, 'navigation')
    const screen = nav?.screen ?? null
    const meta = screen ? SCREENS[screen] ?? null : null
    return c.json({ screen, params: nav?.params ?? {}, context: meta?.context ?? [], route: meta?.route ?? null })
  })
  .get('/data', async (c) => {
    const nav = await getState(c, 'navigation')
    const screen = nav?.screen ?? 'products'
    if (screen === 'products') {
      const { products } = await loadProductsPage(nav?.params?.page ?? 1)
      return c.json({ screen, data: products })
    }
    if (screen === 'products/edit' || screen === 'products/delete') {
      const id = Number(nav?.params?.id)
      const p = id ? await getProductById(id) : null
      return c.json({ screen, data: p ? toProduct(p) : null })
    }
    return c.json({ screen, data: null })
  })
  .post('/navigate', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const screen = body?.screen
    if (!screen || !SCREENS[screen]) return c.json({ error: 'Unknown screen' }, 400)
    await setState(c, 'navigation', { screen, params: body?.params ?? {}, _writeId: `${Date.now()}` })
    // also write navigate command for UI
    await setState(c, 'navigate', { screen, params: body?.params ?? {}, _writeId: `${Date.now()}` })
    return c.json({ ok: true, screen })
  })
  .get('/navigate', async (c) => {
    const cmd = await getState(c, 'navigate')
    if (cmd) await setState(c, 'navigate', null)
    return c.json(cmd ?? null)
  })
  .post('/state', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    if (body?.navigation) await setState(c, 'navigation', body.navigation)
    return c.json({ ok: true })
  })
  .post('/products', async (c) => {
    const body = await c.req.json().catch(() => null)
    if (!body) return c.json({ error: 'Invalid body' }, 400)
    const result = validateProduct(body)
    if (!result.valid) return c.json({ errors: result.errors }, 400)
    if (await productNameExists(result.data.productName)) return c.json({ error: 'Name exists' }, 409)
    const row = await createProduct(result.data, c.var.authUser?.login ?? DEFAULT_AGENT_USER)
    return c.json({ ok: true, product: row ? toProduct(row) : null })
  })
  .patch('/products/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const body = await c.req.json().catch(() => null)
    if (!body) return c.json({ error: 'Invalid body' }, 400)
    const result = validateProduct(body)
    if (!result.valid) return c.json({ errors: result.errors }, 400)
    const updated = await updateProduct(id, result.data, c.var.authUser?.login ?? DEFAULT_AGENT_USER)
    if (!updated.length) return c.json({ error: 'Not found' }, 404)
    return c.json({ ok: true, product: toProduct(updated[0]) })
  })
  .delete('/products/:id', async (c) => {
    const id = Number(c.req.param('id'))
    await deleteProduct(id)
    return c.json({ ok: true })
  })
  .post('/pairing/create', async (c) => {
    const user = c.var.authUser
    const sessionId = c.var.agentSessionId
    if (!user || !sessionId) return c.json({ error: 'Not authenticated' }, 401)
    await upsertPairing(sessionId, user.login)
    return c.json({ code: sessionId })
  })
  .delete('/pairing/remove', async (c) => {
    const sessionId = c.var.agentSessionId
    if (sessionId) await removePairing(sessionId)
    return c.json({ ok: true })
  })
  .get('/screens', (c) => c.json(SCREENS))

export default app