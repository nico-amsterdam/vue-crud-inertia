import { Hono } from 'hono'
import type { Context, MiddlewareHandler } from 'hono'
import { describeRoute, openAPIRouteHandler } from 'hono-openapi'
import type { AppEnv } from '@/types/env'
import { generateSecureRandomString, getIp } from '@/lib/security'
import { readSession } from '@/routes/auth/common'
import {
  AGENT_IDLE_TIMEOUT_MS,
  getPairing,
  getPairingBySessionId,
  getState as storeGetState,
  removePairing,
  setPairingIp,
  setState as storeSetState,
  touchPairing,
  upsertPairing,
  userStateKey,
} from './store'
import products, { PRODUCT_SCREENS, loadProductScreenData } from './products'
import {
  dataRoute,
  formRoute,
  navigateGetRoute,
  navigatePostRoute,
  pairingCreateRoute,
  pairingRemoveRoute,
  screenRoute,
  screensRoute,
  statePostRoute,
} from './openapi'
import { DEV_SESSION_ID } from '@/routes/auth'

/*
 * Constants
 */

const AGENT_PAIRING_HEADER = 'x-pairing-code'

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

/** Metadata describing an agent screen in the `SCREENS` mapping. */
export type AgentScreenMeta = { route: string; context: string[] }

const SCREENS: Record<string, AgentScreenMeta> = {
  ...PRODUCT_SCREENS,
}

/*
 * Functions
 */

/** `AGENT_DISABLED=1` switches the whole agent feature off: `/agent/*` answers
 *  404 (routed as if it never existed) and the UI hides its agent section. */
export const isAgentDisabled = (): boolean => process.env.AGENT_DISABLED === '1'

/** Runs before requireAgentAuth on /agent/*, so a disabled agent feature
 *  answers 404 without revealing auth internals (codes, pairing state). */
export const agentEnabledGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (isAgentDisabled()) return c.text('Not Found', 404)
  await next()
}

export const requireAgentAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (process.env.AUTH_DISABLED === '1' && process.env.NODE_ENV !== 'production') {
    c.set('authUser', { login: 'dev:local', name: 'Local Dev', email: '', avatar_url: '' })
    c.set('csrfToken', 'dev-csrf-token')
    c.set('sessionId', DEV_SESSION_ID)
    await touchPairing(DEV_SESSION_ID)
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
    c.set('sessionId', session.id)
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
    c.set('sessionId', row.session_id)
    return next()
  }

  return c.json({ error: 'Not authenticated' }, 401)
}

function userKey(c: Context, key: string): string {
  return userStateKey(c.var.sessionId, key)
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
  .get('/screen', describeRoute(screenRoute), async (c) => {
    const nav = await getState(c, 'navigation')
    const screen = nav?.screen ?? null
    const meta = screen ? SCREENS[screen] ?? null : null
    return c.json({ screen, params: nav?.params ?? {}, context: meta?.context ?? [], route: meta?.route ?? null })
  })
  .post('/navigate', describeRoute(navigatePostRoute), async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const screen = body?.screen
    if (!screen || !SCREENS[screen]) return c.json({ error: 'Unknown screen' }, 400)
    await setState(c, 'navigation', { screen, params: body?.params ?? {}, _writeId: `${Date.now()}` })
    // also write navigate command for UI
    await setState(c, 'navigate', { screen, params: body?.params ?? {}, _writeId: `${Date.now()}` })
    return c.json({ ok: true, screen })
  })
  .get('/navigate', describeRoute(navigateGetRoute), async (c) => {
    const cmd = await getState(c, 'navigate')
    if (cmd) await setState(c, 'navigate', null)
    return c.json(cmd ?? null)
  })
  .post('/state', describeRoute(statePostRoute), async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const nav = body?.navigation
    if (nav) {
      // The products list routes know the user's `q`/`page` precisely
      // (syncListNavigation in products/index.ts — the browser has no way to
      // report them: `preserve-url` keeps `?page=` out of the URL and
      // load-more is a partial reload without a navigate event). When the
      // browser's generic syncScreen describes the same screen and carries no
      // params, merge over the server-synced ones instead of clobbering
      // `q`/`page` with empty values.
      const current = await getState(c, 'navigation')
      const params = current?.screen === nav.screen && nav.screen === 'products'
        ? { ...current.params, ...(nav.params ?? {}) }
        : nav.params ?? {}
      await setState(c, 'navigation', { screen: nav.screen, params, _writeId: `${Date.now()}` })
    }
    return c.json({ ok: true })
  })
  .post('/pairing/create', describeRoute(pairingCreateRoute), async (c) => {
    const user = c.var.authUser
    const sessionId = c.var.sessionId
    if (!user || !sessionId) return c.json({ error: 'Not authenticated' }, 401)
    // Look up existing pairing code for this session
    const existing = await getPairingBySessionId(sessionId)
    if (existing) return c.json({ code: existing.code })
    // Generate a new random code and store it with the session id
    const newCode = generateSecureRandomString()
    await upsertPairing(newCode, user.login, sessionId)
    return c.json({ code: newCode })
  })
  .delete('/pairing/remove', describeRoute(pairingRemoveRoute), async (c) => {
    const sessionId = c.var.sessionId
    if (sessionId) await removePairing(sessionId)
    return c.json({ ok: true })
  })
  .get('/screens', describeRoute(screensRoute), (c) => c.json(SCREENS))
  .get('/form', describeRoute(formRoute), async (c) => {
    // The browser session's last new/edit form submission, captured by the
    // products routes into shared app_state: { screen, id, values, errors, ... }.
    return c.json(await getState(c, 'lastSubmission'))
  })
  .get('/data', describeRoute(dataRoute), async (c) => {
    const nav = await getState(c, 'navigation')
    const screen = nav?.screen ?? 'products'
    return c.json({ screen, data: await loadProductScreenData(screen, nav?.params) })
  })
  .route('/products', products)

// The OpenAPI spec route is registered outside the chain because the
// openAPIRouteHandler needs the finished `app` reference. Registered after
// `/screen`… but matched by its exact path, so it cannot shadow anything.
app.get('/openapi.json', openAPIRouteHandler(app, {
    documentation: {
      info: {
        title: 'Agent API',
        version: '1.0.0',
        description:
          'JSON API for a paired external agent. Authenticate with the `x-pairing-code` '
          + 'header (POST /agent/pairing/create from the logged-in browser session) — '
          + 'browser session cookies work too. Mutating methods additionally require '
          + '`x-csrf-token` when authenticating with a session cookie.',
      },
      servers: [{ url: '/agent' }],
      components: {
        securitySchemes: {
          PairingCode: {
            type: 'apiKey',
            in: 'header',
            name: 'x-pairing-code',
          },
        },
      },
      security: [{ PairingCode: [] }],
    },
  }))
  .route('/products', products)

export default app