import { Hono } from 'hono'
import type { Context } from 'hono'
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
import { DEV_FLASH_SECRET, requireSecret } from './lib/secrets'
import { authController, csrfProtect, requireAuth } from './routes/auth'
import products from './routes/products'
import { errorPage, renderNotFound } from './routes/errors'

const isDev = process.env.NODE_ENV !== 'production'
const vitePort = Number(process.env.VITE_PORT ?? 5173)
const viteOrigin = `http://localhost:${vitePort}`

const base = new Hono<AppEnv>()

// Security headers for every response the Worker produces (HTML, JSON, redirects
// and dev static assets). Pages additionally get a per-request CSP below.
base.use(async (c, next) => {
  await next()
  c.res.headers.set('X-Content-Type-Options', 'nosniff')
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (!isDev) {
    c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
})

function staticServe(root: string) {
  return serveStatic({
    root,
    getContent: async (path: string, c: Context<AppEnv>) => {
      // In development Vite serves `public/` from memory, so edits are visible
      // without a rebuild. The ASSETS binding points at the last `dist/` build.
      if (isDev) {
        try {
          const response = await fetch(viteOrigin + c.req.path)
          if (response.ok) return response
        } catch {
          // Vite is not running; fall through to the built assets.
        }
      }
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
base.get('/privacy', (c) => c.redirect('/privacy.html', 301))
base.get('/terms', (c) => c.redirect('/terms.html', 301))

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
function buildCsp(c: Context<AppEnv>, nonce: string): string {
  const honoPort = new URL(c.req.url).port
  const externalImages = "https://avatars.githubusercontent.com https://*.googleusercontent.com";
  const directives = [
    "default-src 'self'",
    // Vite serves the modules (and the HMR websocket) from its own origin in dev.
    isDev
      ? `script-src 'self' ${viteOrigin} http://localhost:${honoPort}`
      : `script-src 'nonce-${nonce}' 'strict-dynamic' 'self' 'unsafe-inline'`,
    // 'unsafe-inline' for style attributes (Vue/Iconify); compiled styles are external.
    "style-src 'self' 'unsafe-inline'",
    isDev ? `img-src 'self' ${viteOrigin} ${externalImages}` : `img-src 'self' ${externalImages}`,
    "font-src 'self'",
    isDev ? `connect-src 'self' ws://localhost:${vitePort} ${viteOrigin}` : "connect-src 'self'",
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
  headers.set('Content-Security-Policy', buildCsp(c, nonce))
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
  head: raw('<link rel="manifest" href="/manifest.webmanifest">\n<meta name="theme-color" content="#fddcd0">\n<link rel="apple-touch-icon" href="/images/icon-192.png">\n<meta name="description" content="Vue Inertia Demo">\n<link rel="stylesheet" href="/css/bootstrap3-un.css" />\n<link rel="stylesheet" href="/css/auth.css" />'),
})

// Inertia compares this version on every visit; changing it makes stale tabs
// (old chunk hashes) do a full reload. In production derive it from the build
// output so a deploy invalidates old clients; in development any stable value
// works because Vite serves modules directly.
const assetVersion = isDev ? 'dev' : (manifest['src/inertia/main.ts']?.file ?? '1')

const { middleware } = createInertia({
  version: assetVersion,
  // Signs the one-shot flash cookie (success messages after create/update/delete).
  // In production the app refuses to start unless INERTIA_FLASH_SECRET is set.
  flashSecret: requireSecret('INERTIA_FLASH_SECRET', DEV_FLASH_SECRET),
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

/*
 * Friendly error pages instead of Hono's plain "404 Not Found" and unstyled
 * 500s: `renderNotFound` covers every path without a route, `onError` covers
 * unexpected failures (detailed in the log, never shown to users). Both go
 * through `errorPage` — see src/routes/errors.ts for the rendering rules.
 */
app.notFound(renderNotFound)
app.onError(async (error, c) => {
  console.error(`Unhandled error on ${c.req.method} ${c.req.path}:`, error)
  return errorPage(c, 'errors/internalerror', 500)
})

export type AppType = typeof app
