import { Hono, type Context } from 'hono'
import { serveStatic } from 'hono/serve-static'
import { raw } from 'hono/html'
import { getCookie, setCookie } from 'hono/cookie'
import {
  createInertia,
  createViteHtmlRenderer,
} from '@sneakylenny/inertia-hono'
import manifest from './generated/manifest'
import type { AppEnv } from './types/env'
import { getContentLanguage, getLang, LANG_COOKIE, setContentLanguage, STANDARD_LANGUAGE } from './i18n/lang'
import { allowRequest } from './lib/security'
import { authController, csrfProtect, requireAuth } from './routes/auth'
import products from './routes/products'

const isDev = process.env.NODE_ENV !== 'production'
const vitePort = Number(process.env.VITE_PORT ?? 5173)
const viteOrigin = `http://localhost:${vitePort}`

const base = new Hono<AppEnv>()

function staticServe(root: string) {
  return serveStatic({
    root,
    getContent: async (path: string, c: Context<AppEnv>) => {
      if (typeof Bun !== 'undefined') {
        const file = Bun.file(path)
        return await file.exists() ? (file as Blob) : null
      }
      const assets = c.env.ASSETS
      if (!assets) return null
      const response = await assets.fetch(c.req.url)
      return response.ok ? response : null
    },
  })
}

base.use('/css/*', staticServe('./public'))
base.use('/images/*', staticServe('./public'))
base.use('/manifest.webmanifest', staticServe('./public'))
base.use('/privacy.html', staticServe('./public'))
base.use('/terms.html', staticServe('./public'))

if (!isDev) {
  base.use('/assets/*', staticServe('./dist'))
}

/*
 * Content-Security-Policy with a per-request nonce. The nonce is injected
 * into every `<script type="module">` tag of rendered HTML pages and shipped
 * in the CSP header; `'strict-dynamic'` extends the trust to the chunks the
 * entry module imports. The `data-page` JSON island is not executed, so it
 * needs no nonce. HTML responses are marked `no-store`: a cached nonce would
 * be stale and shared between visitors.
 */
function buildCsp(nonce: string): string {
  const externalImages = "https://avatars.githubusercontent.com https://*.googleusercontent.com";
  const directives = [
    "default-src 'self'",
    // Vite serves the modules (and the HMR websocket) from its own origin in dev.
    isDev
      ? `script-src 'self' ${viteOrigin}`
      : `script-src 'nonce-${nonce}' 'strict-dynamic' 'self' 'unsafe-inline'`,
    // 'unsafe-inline' for style attributes (Vue/Iconify); compiled styles are external.
    "style-src 'self' 'unsafe-inline'",
    isDev ? `img-src 'self' ${viteOrigin} ${externalImages}` : `img-src 'self' ${externalImages}`,
    "font-src 'self'",
    isDev ? `connect-src 'self' ws://localhost:${vitePort}` : "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
  ]
  return directives.join('; ')
}

base.use(async (c, next) => {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const nonce = btoa(String.fromCharCode(...bytes))
  await next()
  if (!(c.res.headers.get('content-type') ?? '').includes('text/html')) return

  const html = await c.res.text()
  const headers = new Headers(c.res.headers)
  headers.set('Content-Security-Policy', buildCsp(nonce))
  headers.set('Cache-Control', 'no-store')
  c.res = new Response(
    html.replace(/<script type="module"/g, `<script type="module" nonce="${nonce}"`),
    { status: c.res.status, statusText: c.res.statusText, headers },
  )
})

/*
 * Language: `?lang=xx` switches (and remembers in a cookie), otherwise the
 * cookie is used, falling back to the Accept-Language header and 'en'.
 */
base.use(async (c, next) => {
  const queryLang = c.req.query('lang')
  const lang = getLang(c.req.header(), c.req.query(), getCookie(c, LANG_COOKIE))
  if (queryLang !== undefined) {
    setCookie(c, LANG_COOKIE, lang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'Lax' })
  }
  setContentLanguage(c, lang)
  await next()
})

/*
 * Reject cross-site requests that are not simple navigations (fetch metadata).
 * See https://web.dev/articles/fetch-metadata
 */
base.use(async (c, next) => {
  if (!allowRequest(c.req.method, c.req.path, c.req.header())) {
    return c.text('Forbidden', 403)
  }
  await next()
})

const viteHtmlRenderer = createViteHtmlRenderer({
  dev: isDev,
  entry: 'src/inertia/main.ts',
  manifest: isDev ? null : manifest,
  viteOrigin,
  htmlAttrs: { class: 'retro' },
  head: raw('<link rel="stylesheet" href="/css/bootstrap3-un.css" />\n  <link rel="stylesheet" href="/css/auth.css" />'),
})

const { middleware } = createInertia({
  version: '1',
  // Signs the one-shot flash cookie (success messages after create/update/delete).
  // Set INERTIA_FLASH_SECRET in production; the fallback is dev-only.
  flashSecret: process.env.INERTIA_FLASH_SECRET ?? 'dev-insecure-flash-secret',
  share: (c) => ({
    locale: { lang: getContentLanguage(c) },
    authUser: c.get('authUser') ?? null,
    csrfToken: c.get('csrfToken') ?? '',
  }),
  renderHtml: async (ctx) => {
    const html = await viteHtmlRenderer(ctx)
    // createViteHtmlRenderer only accepts a static `lang`, so swap it for the request language.
    const locale = ctx.page.props.locale as { lang?: string } | undefined
    return html.replace('<html lang="en"', `<html lang="${locale?.lang ?? STANDARD_LANGUAGE}"`)
  },
})

base.use(middleware)

/*
 * Routes are mounted with chaining so their types are part of the app,
 * which allows using the Hono RPC client (`hc<AppType>()`).
 * See https://hono.dev/docs/guides/best-practices#building-a-larger-application
 */
export const app = base
  .get('/', (c) => c.redirect('/products'))
  .route('/auth', authController)
  // '/products/*' (not '/products') so the middleware also runs on subpaths:
  // /products/new, /products/:id/edit, and every mutating subpath. Hono's
  // '.use("/products", ...)' matches the exact path only.
  .use('/products/*', requireAuth, csrfProtect)
  .route('/products', products)

export type AppType = typeof app
