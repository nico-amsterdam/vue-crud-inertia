import { describe, expect, test } from 'bun:test'
import { namePrefixPattern, priceToCents, toProduct } from '../../../src/routes/products/store'

describe('namePrefixPattern', () => {
  test('matches everything for an empty query', () => {
    expect(namePrefixPattern('')).toBe('%')
  })

  test('appends a wildcard for a prefix search', () => {
    expect(namePrefixPattern('bre')).toBe('bre%')
  })

  test('escapes LIKE wildcards and backslashes', () => {
    expect(namePrefixPattern('50%')).toBe('50\\%%')
    expect(namePrefixPattern('a_b')).toBe('a\\_b%')
    expect(namePrefixPattern('a\\b')).toBe('a\\\\b%')
  })
})

describe('priceToCents', () => {
  test('keeps null and converts euros to integer cents', () => {
    expect(priceToCents(null)).toBeNull()
    expect(priceToCents(0)).toBe(0)
    expect(priceToCents(12.34)).toBe(1234)
    expect(priceToCents(12.345)).toBe(1235)
  })
})

describe('toProduct', () => {
  test('converts cents to euros and a timestamp to ISO', () => {
    const product = toProduct({
      id: 7,
      name: 'Bread',
      description: 'Fresh',
      price: 1234,
      modifiedAt: '2026-01-02T03:04:05.000Z',
    } as Parameters<typeof toProduct>[0])

    expect(product).toEqual({
      id: 7,
      productName: 'Bread',
      description: 'Fresh',
      price: 12.34,
      modifiedAt: '2026-01-02T03:04:05.000Z',
    })
  })

  test('handles a null price and modifiedAt', () => {
    const product = toProduct({
      id: 7,
      name: 'Bread',
      description: '',
      price: null,
      modifiedAt: null,
    } as Parameters<typeof toProduct>[0])
    expect(product.price).toBeNull()
    expect(product.modifiedAt).toBeNull()
  })
})
