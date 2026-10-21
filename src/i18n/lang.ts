import type { Context } from 'hono'

/*
 * Global constants
 */
export const NON_DEFAULT_LANGUAGES = ['de', 'es', 'fr']
export const STANDARD_LANGUAGE = 'en'
export const ALL_LANGUAGES = [STANDARD_LANGUAGE, ...NON_DEFAULT_LANGUAGES]

/** Cookie that remembers the chosen language between Inertia visits. */
export const LANG_COOKIE = 'lang'

/*
 * Functions
 */

/** Map `de-DE`, `DE` (or an unsupported tag) to a supported base language. */
function normalizeLanguage(value: string | undefined): string | undefined {
  if (!value) return undefined
  const base = value.trim().toLowerCase().split('-')[0]
  return base && ALL_LANGUAGES.includes(base) ? base : undefined
}

/**
 * Pick the best supported language from an Accept-Language header.
 * Entries are ordered by preference (`q` is ignored because browsers already
 * sort them); the first supported entry wins. The previous implementation only
 * looked at the first entry, so `zh-CN,de;q=0.9` fell back to English.
 */
function languageFromAcceptLanguage(header: string | undefined): string | undefined {
  if (!header) return undefined
  for (const part of header.split(',')) {
    const language = normalizeLanguage(part.split(';')[0])
    if (language) return language
  }
  return undefined
}

export function getLang(
  headers: Record<string, string | undefined>,
  query: Record<string, string>,
  cookieLang?: string,
): string {
  // Prefer an explicit URL choice, then the remembered cookie, then the
  // browser's languages, and finally English.
  return normalizeLanguage(query?.lang)
    ?? normalizeLanguage(cookieLang)
    ?? languageFromAcceptLanguage(headers['accept-language'])
    ?? STANDARD_LANGUAGE
}

/** Current language of the request, set by the language middleware. */
export function getContentLanguage(c: Context<any>): string {
  return c.get('lang') || STANDARD_LANGUAGE
}

export function setContentLanguage(c: Context<any>, lang: string): void {
  c.set('lang', lang)
  c.header('content-language', lang)
}
