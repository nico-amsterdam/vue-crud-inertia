import { describe, expect, test } from 'bun:test'
import { MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH, MAX_PRICE, convertAndValidateProductPayload } from '@/routes/products/validation'

describe('convertAndValidateProductPayload', () => {
  test('trims values and accepts a valid product', () => {
    const result = convertAndValidateProductPayload({ productName: '  Bread  ', description: '  Fresh  ', price: 2.5 })
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.data.productName).toBe('Bread')
      expect(result.data.description).toBe('Fresh')
      expect(result.data.price).toBe(2.5)
      expect(result.data.modifiedAt).toBeNull()
    }
  })

  test('treats a missing, null or empty price as null', () => {
    for (const price of [undefined, null, '']) {
      const result = convertAndValidateProductPayload({ productName: 'Bread', price })
      expect(result.valid).toBe(true)
      if (result.valid) expect(result.data.price).toBeNull()
    }
  })

  test('accepts a numeric string (form inputs send strings)', () => {
    const result = convertAndValidateProductPayload({ productName: 'Bread', price: '12.34' })
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.data.price).toBe(12.34)
  })

  test('rejects a non-numeric price string', () => {
    const result = convertAndValidateProductPayload({ productName: 'Bread', price: 'not a number' })
    expect(result).toEqual({
      valid: false,
      errors: { price: 'Price must be a non-negative number' },
    })
  })

  test('converts valid date strings and accepts valid Date objects', () => {
    const dateString = '2026-01-02T03:04:05.000Z'
    const dateObject = new Date(dateString)

    expect(convertAndValidateProductPayload({ productName: 'Bread', modifiedAt: dateString })).toMatchObject({
      valid: true,
      data: { modifiedAt: new Date(dateString) },
    })
    expect(convertAndValidateProductPayload({ productName: 'Bread', modifiedAt: dateObject })).toMatchObject({
      valid: true,
      data: { modifiedAt: dateObject },
    })
  })

  test('rejects invalid date values', () => {
    for (const modifiedAt of ['not a date', new Date(Number.NaN), 123]) {
      expect(convertAndValidateProductPayload({ productName: 'Bread', modifiedAt })).toEqual({
        valid: false,
        errors: { modifiedAt: 'Modified date must be valid' },
      })
    }
  })

  test('requires a name and enforces the length limit', () => {
    expect(convertAndValidateProductPayload({ productName: '   ' })).toEqual({
      valid: false,
      errors: { productName: 'Product name is required' },
    })
    const longName = 'a'.repeat(MAX_NAME_LENGTH + 1)
    const result = convertAndValidateProductPayload({ productName: longName })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.productName).toContain('at most 20')
  })

  test('enforces the description length limit', () => {
    const result = convertAndValidateProductPayload({ productName: 'Bread', description: 'a'.repeat(MAX_DESCRIPTION_LENGTH + 1) })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.description).toContain('at most 300')
  })

  test('rejects negative, non-finite and oversized prices', () => {
    for (const price of [-1, 1e308, Number.POSITIVE_INFINITY, MAX_PRICE + 1]) {
      const result = convertAndValidateProductPayload({ productName: 'Bread', price })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.errors.price).toBeTruthy()
    }
  })

  test('rejects arrays, booleans and objects instead of coercing them', () => {
    for (const price of [[12], true, { amount: 12 }]) {
      const result = convertAndValidateProductPayload({ productName: 'Bread', price })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.errors.price).toBe('Price must be a non-negative number')
    }
  })

  test('rejects non-string product names and descriptions', () => {
    const result = convertAndValidateProductPayload({ productName: 12, description: false })
    expect(result).toEqual({
      valid: false,
      errors: {
        productName: 'Incorrect input string',
        description: 'Incorrect input string',
      },
    })
  })

  test('rejects more than two decimal places', () => {
    const result = convertAndValidateProductPayload({ productName: 'Bread', price: 1.234 })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.price).toBe('Price must have at most 2 decimal places')
  })

  test('rejects a non-object body without throwing', () => {
    for (const body of [null, 'nope', 42, []]) {
      expect(convertAndValidateProductPayload(body).valid).toBe(false)
    }
  })
})
