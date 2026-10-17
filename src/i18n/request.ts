import type { Context } from 'hono'
import { getContentLanguage } from './lang'
import { translate } from './translations'

/** Translate an English message key for the current request language. */
export function t(c: Context, key: string, ...args: string[]): string {
  return translate(getContentLanguage(c), key, args)
}
