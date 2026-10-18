import { createHmac, createSecretKey, getRandomValues, type KeyObject } from 'crypto'

/*
 * Functions
 */

// function from Lucia auth, see https://lucia-auth.com/sessions/basic
export function generateSecureRandomString(): string {
  // Human readable alphabet (a-z, 0-9 without l, o, 0, 1 to avoid confusion)
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'

  // Generate 24 bytes = 192 bits of entropy.
  // We're only going to use 5 bits per byte so the total entropy will be 192 * 5 / 8 = 120 bits
  const bytes = new Uint8Array(24)
  getRandomValues(bytes)

  let id = ''
  for (let i = 0; i < bytes.length; i++) {
    // >> 3 "removes" the right-most 3 bits of the byte
    id += alphabet[bytes[i] >> 3]
  }
  return id
}

export function getIp(headers: Record<string, string | undefined>): string {
  return headers['cf-connecting-ip'] ?? headers['x-forwarded-for']?.split(',')[0]?.trim() ?? ''
}

// Allow to switch from Mobile to Desktop view without relogin.
export function stripMobileDesktopFromUserAgent(userAgent: string | undefined): string {
  return (userAgent || '').replace(/ \([^)]+\)/, '').replaceAll(/ Edg(A|iOS)?\/[0-9.]+/g, ' Edg').replaceAll(/ Mobile(\/[0-9A-Z.]+)?/g, '').replaceAll(/ Safari(\/[0-9.]+)?/g, '').replaceAll(/ OPR\/[0-9.]+/g, ' OPR')
}

export function stateSecretKey(secret: string): KeyObject {
  return createSecretKey(Buffer.from(secret))
}

export function calcStateHmac(headers: Record<string, string | undefined>, secretKeyObject: KeyObject): string {
  return createHmac('sha256', secretKeyObject)
    .update(getIp(headers)
      + 'some pepper'
      + stripMobileDesktopFromUserAgent(headers['user-agent'])
      + headers['x-forwarded-proto']
      + headers['x-forwarded-for'])
    .digest('hex')
    .substring(0, 10)
}

// Reject cross-origin requests to protect from CSRF, XSSI, and other bugs.
// see https://web.dev/articles/fetch-metadata
export function allowRequest(method: string, path: string, headers: Record<string, string | undefined>): boolean {

  // Allow requests from browsers which don't send Fetch Metadata
  if (!headers['sec-fetch-site']) {
    // crawler or old browser
    return true
  }

  // Allow application and browser-initiated requests.
  // Do not trust subdomains (same-site).
  if (['same-origin', 'none'].includes(headers['sec-fetch-site'])) {
    return true
  }

  // Allow simple top-level navigations except <object> and <embed>
  if (headers['sec-fetch-mode'] === 'navigate' && method === 'GET' &&
    !['object', 'embed'].includes(headers['sec-fetch-dest'] || '')) {
    return true
  }

  // Exempt paths/endpoints meant to be served cross-origin
  if (['/health', '/favicon.ico'].includes(path) || path.startsWith('/images/')) {
    return true
  }

  console.log('deny access because sec-fetch-site=' + headers['sec-fetch-site'] + ' and sec-fetch-mode=' + headers['sec-fetch-mode'] + ' with set-fetch-dest=' + headers['sec-fetch-dest'])

  // Reject all other requests that are cross-site and not navigational
  return false
}
