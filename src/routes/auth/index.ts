import { Hono } from 'hono'
import type { Context, MiddlewareHandler } from 'hono'
import { isInertiaRequest, location } from '@sneakylenny/inertia-hono'
import { getContentLanguage, STANDARD_LANGUAGE } from '../../i18n/lang'
import { t } from '../../i18n/request'
import type { AppEnv } from '../../types/env'
import { githubController } from './github'
import { googleController } from './google'
import { LOGIN_PATH, clearSession, readSession } from './common'
import type { UserType } from './common'

/*
 * Types
 */
export type { UserType }

/*
 * Variables
 */
export { LOGIN_PATH }

/*
 * Login page (server-rendered, no Inertia/Vue needed before login)
 */

function languageLinks(path: string): string {
  return ['en', 'es', 'fr', 'de']
    .map((lang) => `<a href="${path}?lang=${lang}" hreflang="${lang}" lang="${lang}">${lang}</a>`)
    .join(' ')
}

function loginPageHtml(c: Context, expired = false): string {
  const lang = getContentLanguage(c)
  const toGithubLink = '/auth/to-github' + (lang === STANDARD_LANGUAGE ? '' : '?lang=' + lang)
  const toGoogleLink = '/auth/to-google' + (lang === STANDARD_LANGUAGE ? '' : '?lang=' + lang)
  const title = t(c, 'Welcome to the Vue CRUD Inertia Demo')
  const expiredNotice = expired
    ? `<h3>${t(c, 'Session expired')}</h3><p>${t(c, 'Please login again.')}</p>`
    : `<p class="login-subtitle">${t(c, 'Sign in to continue')}</p>`
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="manifest" href="/manifest.webmanifest">
  <meta name="theme-color" content="#fddcd0">
  <link rel="stylesheet" href="/css/bootstrap3-un.css">
  <link rel="stylesheet" href="/css/auth.css">
</head>
<body class="login-full-container">
  <div id="content" class="login-container">
    <main id="main" class="login-box">
      <h1 class="login-title">${title}</h1>
      ${expiredNotice}
      <div class="social-login-container">
        <a href="${toGithubLink}" class="social-login-button github-login">
          <img src="/images/github-icon.svg" alt="" class="social-icon" aria-hidden="true" />
          ${t(c, 'Continue with GitHub')}
        </a>
        <a href="${toGoogleLink}" class="social-login-button google-login">
          <img src="/images/google-icon.svg" alt="" class="social-icon" aria-hidden="true" />
          ${t(c, 'Continue with Google')}
        </a>
      </div>
      <p class="login-languages">${languageLinks(LOGIN_PATH)}</p>
    </main>
  </div>
</body>
</html>`
}

/*
 * Hono controllers
 */

export const authController = new Hono<AppEnv>()
  .route('/', githubController)
  .route('/', googleController)
  .get('/login', (c) => {
    // logout: remove previous cookie
    clearSession(c)
    return c.html(loginPageHtml(c))
  })
  .post('/login', (c) => {
    // session expired: show the login page with an explanation
    return c.html(loginPageHtml(c, true))
  })

/**
 * Requires a valid session; redirects to the login page otherwise.
 * When authenticated it sets `authUser` and `csrfToken` on the context.
 *
 * Set AUTH_DISABLED=1 in `.env` to bypass authentication for local testing:
 * every request runs as a fixed `dev:local` user (never enabled in production).
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (process.env.AUTH_DISABLED === '1' && process.env.NODE_ENV !== 'production') {
    c.set('authUser', { login: 'dev:local', name: 'Local Dev', email: '', avatar_url: '' })
    c.set('csrfToken', 'dev-csrf-token')
    return next()
  }
  const session = await readSession(c)
  if (session === null) {
    // An Inertia visit (XHR) cannot follow a plain redirect: it would receive
    // the login page HTML and render it in its error dialog. A 409 with
    // X-Inertia-Location makes the client perform a real page visit instead.
    if (isInertiaRequest(c.req.raw)) {
      return location(c, LOGIN_PATH)
    }
    return c.redirect(LOGIN_PATH, 307)
  }
  const authUser: UserType = {
    login: session.login,
    name: session.name,
    email: session.email,
    avatar_url: session.image,
  }
  c.set('authUser', authUser)
  c.set('csrfToken', session.csrfToken)
  await next()
}

/**
 * Validates the `x-csrf-token` header of state-changing requests against the
 * csrf token stored in the session cookie (double submit). Runs after requireAuth.
 */
export const csrfProtect: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
    return next()
  }
  const csrfToken = c.get('csrfToken')
  if (!csrfToken || c.req.header('x-csrf-token') !== csrfToken) {
    return c.text('Invalid CSRF token', 403)
  }
  await next()
}
