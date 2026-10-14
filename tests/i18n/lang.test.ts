import { describe, it, expect } from 'bun:test'
import {
  ALL_LANGUAGES,
  NON_DEFAULT_LANGUAGES,
  STANDARD_LANGUAGE,
  getLang,
  getContentLanguage,
  setContentLanguage,
} from '../../src/i18n/lang'

describe('language constants', () => {
  it('should contain supported non-English languages', () => {
    expect(NON_DEFAULT_LANGUAGES).toContain('de')
    expect(NON_DEFAULT_LANGUAGES).toContain('es')
    expect(NON_DEFAULT_LANGUAGES).toContain('fr')
  })

  it('should not contain English', () => {
    expect(NON_DEFAULT_LANGUAGES).not.toContain('en')
  })

  it('should not contain unsupported languages', () => {
    expect(NON_DEFAULT_LANGUAGES).not.toContain('zh')
    expect(NON_DEFAULT_LANGUAGES).not.toContain('ja')
  })

  it('should use English as the standard language', () => {
    expect(STANDARD_LANGUAGE).toBe('en')
    expect(ALL_LANGUAGES).toContain('en')
    expect(ALL_LANGUAGES.length).toBe(4)
  })
})

describe('getLang', () => {
  it('should return language from query parameter', () => {
    expect(getLang({}, { lang: 'de' })).toBe('de')
  })

  it('should return language from cookie when there is no query parameter', () => {
    expect(getLang({}, {}, 'fr')).toBe('fr')
  })

  it('should prefer query parameter over cookie', () => {
    expect(getLang({}, { lang: 'es' }, 'fr')).toBe('es')
  })

  it('should prefer cookie over accept-language header', () => {
    expect(getLang({ 'accept-language': 'de-DE' }, {}, 'es')).toBe('es')
  })

  it('should return German from accept-language header', () => {
    expect(getLang({ 'accept-language': 'de-DE,en-US;q=0.9' }, {})).toBe('de')
  })

  it('should return Spanish from accept-language header', () => {
    expect(getLang({ 'accept-language': 'es-ES;q=0.8,fr;q=0.7' }, {})).toBe('es')
  })

  it('should return English for unsupported languages', () => {
    expect(getLang({ 'accept-language': 'zh-CN,ja-JP' }, {})).toBe('en')
  })

  it('should return English for unsupported query language', () => {
    expect(getLang({}, { lang: 'zh' })).toBe('en')
  })

  it('should return English when no headers, query or cookie', () => {
    expect(getLang({}, {})).toBe('en')
  })

  it('should handle empty accept-language header', () => {
    expect(getLang({ 'accept-language': '' }, {})).toBe('en')
  })
})

describe('getContentLanguage / setContentLanguage', () => {
  it('should round-trip the language on the context', () => {
    const values: Record<string, string | undefined> = {}
    const headers: Record<string, string> = {}
    const context = {
      get: (key: string) => values[key],
      set: (key: string, value: string) => {
        values[key] = value
      },
      header: (key: string, value: string) => {
        headers[key] = value
      },
    } as any

    setContentLanguage(context, 'de')
    expect(values['lang']).toBe('de')
    expect(headers['content-language']).toBe('de')
    expect(getContentLanguage(context)).toBe('de')
  })

  it('should default to English when no language was set', () => {
    const context = { get: () => undefined } as any
    expect(getContentLanguage(context)).toBe('en')
  })
})
