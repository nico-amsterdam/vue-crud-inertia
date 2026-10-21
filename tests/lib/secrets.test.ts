import { afterEach, describe, expect, test } from 'bun:test'
import {
  DEV_FLASH_SECRET,
  DEV_SESSION_SECRET,
  requireSecret,
} from '../../src/lib/secrets'

const originalNodeEnv = process.env.NODE_ENV
const originalSessionSecret = process.env.SESSION_SECRET
const originalFlashSecret = process.env.INERTIA_FLASH_SECRET

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalNodeEnv
  if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET
  else process.env.SESSION_SECRET = originalSessionSecret
  if (originalFlashSecret === undefined) delete process.env.INERTIA_FLASH_SECRET
  else process.env.INERTIA_FLASH_SECRET = originalFlashSecret
})

describe('requireSecret', () => {
  test('uses the development fallback when the value is missing', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.SESSION_SECRET
    expect(requireSecret('SESSION_SECRET', DEV_SESSION_SECRET)).toBe(DEV_SESSION_SECRET)
  })

  test('accepts a configured value in development', () => {
    process.env.NODE_ENV = 'development'
    process.env.SESSION_SECRET = 'short'
    expect(requireSecret('SESSION_SECRET', DEV_SESSION_SECRET)).toBe('short')
  })

  test('throws in production when the value is missing', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.SESSION_SECRET
    expect(() => requireSecret('SESSION_SECRET', DEV_SESSION_SECRET)).toThrow('SESSION_SECRET')
  })

  test('throws in production for the dev fallback and .env.example placeholders', () => {
    process.env.NODE_ENV = 'production'
    for (const value of [DEV_SESSION_SECRET, 'A LONG RANDOM STRING', 'ANOTHER LONG RANDOM STRING']) {
      process.env.SESSION_SECRET = value
      expect(() => requireSecret('SESSION_SECRET', DEV_SESSION_SECRET)).toThrow()
    }
  })

  test('throws in production for short secrets', () => {
    process.env.NODE_ENV = 'production'
    process.env.INERTIA_FLASH_SECRET = 'too-short'
    expect(() => requireSecret('INERTIA_FLASH_SECRET', DEV_FLASH_SECRET)).toThrow('at least 32')
  })

  test('accepts a long random secret in production', () => {
    process.env.NODE_ENV = 'production'
    const secret = 'x'.repeat(48)
    process.env.INERTIA_FLASH_SECRET = secret
    expect(requireSecret('INERTIA_FLASH_SECRET', DEV_FLASH_SECRET)).toBe(secret)
  })
})
