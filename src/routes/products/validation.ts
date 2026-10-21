import type { Context } from 'hono'
import type { ProductBaseType, ProductErrorsType } from '../../types/product'
import { t } from '../../i18n/request'

/** Maximum product name length (shared by the form, validation and the search clamp). */
export const MAX_NAME_LENGTH = 20
/** Maximum description length (shared by the form and validation). */
export const MAX_DESCRIPTION_LENGTH = 300
/** Upper bound for a price, keeping `price * 100` a safe SQLite integer. */
export const MAX_PRICE = 1_000_000

/** Translate the English message keys in per-field errors returned by validateProduct(). */
export function translateFieldErrors(c: Context, errors: ProductErrorsType): ProductErrorsType {
  const translated: ProductErrorsType = {}
  if (errors.productName) translated.productName = t(c, errors.productName)
  if (errors.description) translated.description = t(c, errors.description)
  if (errors.price) translated.price = t(c, errors.price)
  return translated
}

export function validateProduct(body: unknown): { valid: true; data: ProductBaseType } | { valid: false; errors: ProductErrorsType } {
  const errors: ProductErrorsType = {}
  const input = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const productName = typeof input.productName === 'string' ? input.productName.trim() : ''
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  const rawPrice = input.price
  let price: number | null = null

  if (!productName) errors.productName = 'Product name is required'
  else if (productName.length > MAX_NAME_LENGTH) errors.productName = 'Product name must be at most 20 characters'

  if (description.length > MAX_DESCRIPTION_LENGTH) errors.description = 'Description must be at most 300 characters'

  if (rawPrice !== null && rawPrice !== undefined) {
    // Reject arrays/booleans/objects instead of coercing them with String().
    if (typeof rawPrice !== 'number' && typeof rawPrice !== 'string') {
      errors.price = 'Price must be a non-negative number'
    } else {
      const priceText = String(rawPrice).trim()
      if (priceText !== '') {
        price = Number(priceText)
        if (!Number.isFinite(price) || price < 0) {
          errors.price = 'Price must be a non-negative number'
        } else if (price > MAX_PRICE) {
          errors.price = 'Price is too large'
        } else if (Math.abs(Math.round(price * 100) - price * 100) > 1e-6) {
          errors.price = 'Price must have at most 2 decimal places'
        }
      }
    }
  }

  if (errors.productName || errors.description || errors.price) return { valid: false, errors }

  return {
    valid: true,
    data: {
      productName,
      description,
      price,
      modifiedAt: new Date().toISOString(),
    },
  }
}
