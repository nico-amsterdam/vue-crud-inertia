/**
 * Secrets that must never fall back to a value published in this repository.
 *
 * Local development gets a predictable fallback so `bun dev` works without
 * setup. Production must fail fast: a deployed app that silently signs session
 * cookies with a known secret is trivially forgeable.
 */

export const DEV_SESSION_SECRET = 'dev-insecure-session-secret'
export const DEV_FLASH_SECRET = 'dev-insecure-flash-secret'

/** Values copied from `.env.example` that are not real secrets. */
const PLACEHOLDERS = new Set(['A LONG RANDOM STRING', 'ANOTHER LONG RANDOM STRING'])

const MIN_SECRET_LENGTH = 32

export function requireSecret(
  name: 'SESSION_SECRET' | 'INERTIA_FLASH_SECRET',
  devFallback: string,
): string {
  const value = process.env[name]?.trim()

  if (process.env.NODE_ENV !== 'production') {
    return value ? value : devFallback
  }

  if (!value || value === devFallback || PLACEHOLDERS.has(value) || value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${name} must be set to a random string of at least ${MIN_SECRET_LENGTH} characters in production. `
      + 'Generate one with: openssl rand -base64 48',
    )
  }

  return value
}
