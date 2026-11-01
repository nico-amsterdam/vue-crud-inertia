import { Hono } from 'hono'
import type { Context, MiddlewareHandler } from 'hono'
import type { AppEnv } from '@/types/env'
import { generateSecureRandomString, getIp } from '@/lib/security'
import { readSession } from '@/routes/auth/common'
import { tables, getDB} from '@/db/index'
import {
  AGENT_HEARTBEAT_INTERVAL_MS,
  AGENT_IDLE_TIMEOUT_MS,
  getPairing,
  getPairingBySessionId,
  getState as storeGetState,
  removePairing,
  setPairingIp,
  setState as storeSetState,
  touchPairing,
  upsertPairing,
} from './store'
import products, { PRODUCT_SCREENS, loadProductScreenData } from './products'

export { AGENT_HEARTBEAT_INTERVAL_MS, AGENT_IDLE_TIMEOUT_MS }

/*
 * Constants
 */

export const AGENT_PAIRING_HEADER = 'x-pairing-code'
export const DEV_PAIRING_SESSION_ID = 'dev-local'

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

/** Metadata describing an agent screen in the `SCREENS` mapping. */
export type AgentScreenMeta = { route: string; context: string[] }

export const SCREENS: Record<string, AgentScreenMeta> = {
  ...PRODUCT_SCREENS,
}

/*
 * Functions
 */

export const requireAgentAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (process.env.AUTH_DISABLED === '1' && process.env.NODE_ENV !== 'production') {
    c.set('authUser', { login: 'dev:local', name: 'Local Dev', email: '', avatar_url: '' })
    c.set('csrfToken', 'dev-csrf-token')
    c.set('agentSessionId', DEV_PAIRING_SESSION_ID)
    await touchPairing(DEV_PAIRING_SESSION_ID)
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
    if (row.lastAccessedAt && Date.now() - row.lastAccessedAt.getTime() > AGENT_IDLE_TIMEOUT_MS) {
      return c.json({ error: 'Pairing window expired: the paired browser has not polled for 5 minutes' }, 401)
    }
    // IP pinning: the first agent contact stores its client address; every
    // later agent request must come from the same address (refused with 401).
    const ip = getIp(c.req.header())
    if (row.ip === null) {
      await setPairingIp(row.code, ip)
    } else if (row.ip !== ip) {
      return c.json({ error: 'Pairing code is used from a different IP address' }, 401)
    }
    c.set('authUser', { login: row.login, name: '', email: '', avatar_url: '' })
    c.set('agentSessionId', row.session_id)
    return next()
  }

  return c.json({ error: 'Not authenticated' }, 401)
}

function userKey(c: Context, key: string): string {
  return `${key}:${c.var.agentSessionId ?? 'anon'}`
}

function getState(c: Context, key: string): Promise<any | null> {
  return storeGetState(userKey(c, key))
}

async function setState(c: Context, key: string, value: any): Promise<void> {
  await storeSetState(userKey(c, key), value)
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
  .post('/pairing/create', async (c) => {
    const user = c.var.authUser
    const sessionId = c.var.agentSessionId
    if (!user || !sessionId) return c.json({ error: 'Not authenticated' }, 401)
    // Look up existing pairing code for this session
    const existing = await getPairingBySessionId(sessionId)
    if (existing) return c.json({ code: existing.code })
    // Generate a new random code and store it with the session id
    const newCode = generateSecureRandomString()
    await upsertPairing(newCode, user.login, sessionId)
    return c.json({ code: newCode })
  })
  .delete('/pairing/remove', async (c) => {
    const sessionId = c.var.agentSessionId
    if (sessionId) await removePairing(sessionId)
    return c.json({ ok: true })
  })
  .get('/screens', (c) => c.json(SCREENS))
  .get('/data', async (c) => {
    const nav = await getState(c, 'navigation')
    const screen = nav?.screen ?? 'products'
    return c.json({ screen, data: await loadProductScreenData(screen, nav?.params) })
  })
  .route('/products', products)

export default app