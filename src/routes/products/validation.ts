import type { Context } from 'hono'
import type { ProductErrorsType, ProductBaseType } from '@/types/product'
import { t } from '@/i18n/request'

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
  if (errors.modifiedAt) translated.modifiedAt = t(c, errors.modifiedAt)
  return translated
}

export function validateProduct(payload: unknown): { valid: true; data: ProductBaseType } | { valid: false; errors: ProductErrorsType } {
  const errors: ProductErrorsType = {}
  const input = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>
  const productName = typeof input.productName === 'string' ? input.productName.trim() : ''
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  const rawPrice = input.price
  const rawModifiedAt = input.modifiedAt
  let price: number | null = null
  let modifiedAt: Date | null = null

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

  // Validate modifiedAt: accept Date objects or valid ISO date strings.
  // Invalid date strings produce an error; valid ones are converted to Date.
  if (rawModifiedAt !== null && rawModifiedAt !== undefined) {
    if (rawModifiedAt instanceof Date) {
      modifiedAt = rawModifiedAt
    } else if (typeof rawModifiedAt === 'string') {
      const parsed = new Date(rawModifiedAt)
      if (isNaN(parsed.getTime())) {
        errors.modifiedAt = 'Modified date must be valid'
      } else {
        modifiedAt = parsed
      }
    } else {
      errors.modifiedAt = 'Modified date must be valid'
    }
  }

  if (errors.productName || errors.description || errors.price || errors.modifiedAt) return { valid: false, errors }

  const data: ProductBaseType = {
    productName,
    description,
    price,
    modifiedAt,
  }
  return { valid: true, data }
}
