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
import products from './routes/products'

const isDev = process.env.NODE_ENV !== 'production'

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
base.use('/manifest.webmanifest', staticServe('./public'))

if (!isDev) {
  base.use('/assets/*', staticServe('./dist'))
}

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

const viteHtmlRenderer = createViteHtmlRenderer({
  dev: isDev,
  entry: 'src/inertia/main.ts',
  manifest: isDev ? null : manifest,
  htmlAttrs: { class: 'retro' },
  head: raw('<link rel="stylesheet" href="/css/bootstrap3-un.css" />'),
})

const { middleware } = createInertia({
  version: '1',
  // Signs the one-shot flash cookie (success messages after create/update/delete).
  // Set INERTIA_FLASH_SECRET in production; the fallback is dev-only.
  flashSecret: process.env.INERTIA_FLASH_SECRET ?? 'dev-insecure-flash-secret',
  share: (c) => ({ locale: { lang: getContentLanguage(c) } }),
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
  .route('/products', products)

export type AppType = typeof app
