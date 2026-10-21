import { describe, expect, test } from 'bun:test'
import { MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH, MAX_PRICE, validateProduct } from '../../../src/routes/products/validation'

describe('validateProduct', () => {
  test('trims values and accepts a valid product', () => {
    const result = validateProduct({ productName: '  Bread  ', description: '  Fresh  ', price: 2.5 })
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.data.productName).toBe('Bread')
      expect(result.data.description).toBe('Fresh')
      expect(result.data.price).toBe(2.5)
    }
  })

  test('treats a missing, null or empty price as null', () => {
    for (const price of [undefined, null, '']) {
      const result = validateProduct({ productName: 'Bread', price })
      expect(result.valid).toBe(true)
      if (result.valid) expect(result.data.price).toBeNull()
    }
  })

  test('accepts a numeric string (form inputs send strings)', () => {
    const result = validateProduct({ productName: 'Bread', price: '12.34' })
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.data.price).toBe(12.34)
  })

  test('requires a name and enforces the length limit', () => {
    expect(validateProduct({ productName: '   ' })).toEqual({
      valid: false,
      errors: { productName: 'Product name is required' },
    })
    const longName = 'a'.repeat(MAX_NAME_LENGTH + 1)
    const result = validateProduct({ productName: longName })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.productName).toContain('at most 20')
  })

  test('enforces the description length limit', () => {
    const result = validateProduct({ productName: 'Bread', description: 'a'.repeat(MAX_DESCRIPTION_LENGTH + 1) })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.description).toContain('at most 300')
  })

  test('rejects negative, non-finite and oversized prices', () => {
    for (const price of [-1, 1e308, Number.POSITIVE_INFINITY, MAX_PRICE + 1]) {
      const result = validateProduct({ productName: 'Bread', price })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.errors.price).toBeTruthy()
    }
  })

  test('rejects arrays, booleans and objects instead of coercing them', () => {
    for (const price of [[12], true, { amount: 12 }]) {
      const result = validateProduct({ productName: 'Bread', price })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.errors.price).toBe('Price must be a non-negative number')
    }
  })

  test('rejects more than two decimal places', () => {
    const result = validateProduct({ productName: 'Bread', price: 1.234 })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.price).toBe('Price must have at most 2 decimal places')
  })

  test('rejects a non-object body without throwing', () => {
    for (const body of [null, 'nope', 42, []]) {
      expect(validateProduct(body).valid).toBe(false)
    }
  })
})
