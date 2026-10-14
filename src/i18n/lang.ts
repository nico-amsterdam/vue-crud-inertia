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

export function getLang(
  headers: Record<string, string | undefined>,
  query: Record<string, string>,
  cookieLang?: string,
): string {
  // Get locale from URL query parameter, cookie or accept-language header, default to 'en'
  const locale =
    (query?.lang as string) ||
    cookieLang ||
    headers['accept-language']?.split(',')[0]?.split('-')[0] ||
    STANDARD_LANGUAGE

  return ALL_LANGUAGES.includes(locale) ? locale : STANDARD_LANGUAGE
}

/** Current language of the request, set by the language middleware. */
export function getContentLanguage(c: Context<any>): string {
  return c.get('lang') || STANDARD_LANGUAGE
}

export function setContentLanguage(c: Context<any>, lang: string): void {
  c.set('lang', lang)
  c.header('content-language', lang)
}
