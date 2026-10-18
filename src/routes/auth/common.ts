import type { Context } from 'hono'
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie'
import { generateSecureRandomString, getIp, stripMobileDesktopFromUserAgent } from '../../lib/security'

/*
 * Types
 */

export type UserType = {
  login: string
  name: string
  email: string
  avatar_url: string
}

export type SessionCookieType = {
  id: string
  login: string
  name: string
  email: string
  csrfToken: string
  userAgent: string
  ipAddress: string
  image: string
}

/*
 * Variables
 */

export const AUTH_PATH = '/auth'

export const LOGIN_PATH = AUTH_PATH + '/login'

export const SESSION_COOKIE = 'SESSION'

/** Secret used to sign the session cookie and to calculate the OAuth state HMAC.
 *  Override with the SESSION_SECRET environment variable in production. */
export const SESSION_SECRET = process.env.SESSION_SECRET ?? 'dev-insecure-session-secret'

/*
 * Functions
 */

export function isHttps(c: Context): boolean {
  return c.req.header('x-forwarded-proto') === 'https'
}

/** Read and validate the signed SESSION cookie.
 * Returns null when absent, tampered with or when the ip/agent no longer match. */
export async function readSession(c: Context): Promise<SessionCookieType | null> {
  // note: getSignedCookie takes (context, secret, name) — unlike setSignedCookie.
  const value = await getSignedCookie(c, SESSION_SECRET, SESSION_COOKIE)
  if (typeof value !== 'string' || value === '') {
    // Invalid signature: override the unusable cookie.
    if (value === false) clearSession(c)
    return null
  }
  try {
    const session = JSON.parse(value) as SessionCookieType
    if (!session.login
      || session.login.indexOf(':') < 0
      || session.userAgent !== stripAgent(c)
      || session.ipAddress !== getIpOf(c)) {
      return null
    }
    return session
  } catch {
    console.log('Session cookie did not parse')
    return null
  }
}

/** Persist the session in a signed, httpOnly, SameSite=Lax cookie. */
export async function writeSession(c: Context, session: SessionCookieType): Promise<void> {
  await setSignedCookie(c, SESSION_COOKIE, JSON.stringify(session), SESSION_SECRET, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: isHttps(c),
  })
}

export function clearSession(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}

export function stripAgent(c: Context): string {
  return stripMobileDesktopFromUserAgent(c.req.header('user-agent'))
}

function getIpOf(c: Context): string {
  return getIp(c.req.header())
}

/** Build a fresh session + csrf token for a newly authenticated user. */
export function newSession(c: Context, user: Pick<UserType, 'login' | 'name' | 'email' | 'avatar_url'>): SessionCookieType {
  return {
    id: generateSecureRandomString(),
    login: user.login,
    name: user.name,
    email: user.email,
    csrfToken: generateSecureRandomString(),
    userAgent: stripAgent(c),
    ipAddress: getIpOf(c),
    image: user.avatar_url,
  }
}
