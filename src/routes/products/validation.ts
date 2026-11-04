/**
 * Product validation.
 */

import { validateMaxLength, validateNonNegative, validateMaxValue, validateMaxDecimals, convertStringType, convertNumberType, convertDateType } from '@/lib/fieldValidation'
import type { ProductErrorsType, ProductBaseType } from '@/types/product'
import type { Context } from 'hono'
import { t } from '@/i18n/request'

/*
 * Constants
 */

/** Maximum product name length (shared by the form and validation and the search clamp). */
export const MAX_NAME_LENGTH = 20
/** Maximum description length (shared by the form and validation). */
export const MAX_DESCRIPTION_LENGTH = 300
/** Upper bound for a price, keeping `price * 100` a safe SQLite integer. */
export const MAX_PRICE = 1_000_000

/*
 * Types for field-type conversion functions.
 */

type ProductStringField = {
  [Field in keyof ProductBaseType]: ProductBaseType[Field] extends string ? Field : never
}[keyof ProductBaseType]

type ProductNumberField = {
  [Field in keyof ProductBaseType]: NonNullable<ProductBaseType[Field]> extends number ? Field : never
}[keyof ProductBaseType]

type ProductDateField = {
  [Field in keyof ProductBaseType]: NonNullable<ProductBaseType[Field]> extends Date ? Field : never
}[keyof ProductBaseType]

/*
 * Field type conversions.
 */

function convertProductStringType<Field extends ProductStringField>(
  input: Record<string, unknown>,
  field: Field,
  errors: ProductErrorsType
): string {
  return convertStringType(input, field, 'Incorrect input string', errors)
}

function convertProductNumberType<Field extends ProductNumberField>(
  input: Record<string, unknown>,
  field: Field,
  errorMessage: string,
  errors: ProductErrorsType
): number | null {
  return convertNumberType(input, field, errorMessage, errors)
}

function convertProductDateType<Field extends ProductDateField>(
  input: Record<string, unknown>,
  field: Field,
  errorMessage: string,
  errors: ProductErrorsType
): Date | null {
  return convertDateType(input, field, errorMessage, errors)
}

/**
 * convertProductFieldTypes performs only type checks on the payload.
 * If there are type errors it returns ProductErrorsType.
 * If there are no type errors it converts the payload to a ProductBaseType
 * and returns that.
 *
 * In case of a UI, normally the UI has input validation and it is unlikely
 * that the the backend has to return errors about incorrect types.
 * Runtime checks are necessairy though, to catch manipulated input.
 */
export function convertProductFieldTypes(
  payload: unknown
): { valid: true; data: ProductBaseType } | { valid: false; errors: ProductErrorsType } {
  const errors: ProductErrorsType = {}
  const input = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>

  // productName and description are trimmed.
  const productName = convertProductStringType(input, 'productName', errors).trim()
  const description = convertProductStringType(input, 'description', errors).trim()
  const price = convertProductNumberType(input, 'price', 'Price must be a non-negative number', errors)
  // modifiedAt is submitted as a string and converted to Date type
  const modifiedAt = convertProductDateType(input, 'modifiedAt', 'Modified date must be valid', errors)

  if (Object.keys(errors).length > 0) return { valid: false, errors }

  // All type checks passed - convert and return ProductBaseType
  const data: ProductBaseType = {
    productName,
    description,
    price,
    modifiedAt,
  }
  return { valid: true, data }
}

/**
 * Validate a product object against business rules.
 *
 * - productName: required, max 20 characters
 * - description: max 300 characters
 * - price: non-negative, max 1_000_000, at most 2 decimal places
 * - modifiedAt: business rules (already validated for validity)
 *
 */
export function validateProduct(
  product: ProductBaseType
): { valid: true; data: ProductBaseType } | { valid: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  // Validate productName: required and max length
  if (!product.productName) errors.productName = 'Product name is required'
  else
    validateMaxLength(
      product,
      'productName',
      MAX_NAME_LENGTH,
      'Product name must be at most 20 characters',
      errors
    )

  // Validate description: max length
  validateMaxLength(
    product,
    'description',
    MAX_DESCRIPTION_LENGTH,
    'Description must be at most 300 characters',
    errors
  )

  // Validate price: non-negative, max value, at most 2 decimal places
  if (validateNonNegative(product, 'price', 'Price must be a non-negative number', errors)) {
    if (validateMaxValue(product, 'price', MAX_PRICE, 'Price is too large', errors)) {
      validateMaxDecimals(product, 'price', 2, 'Price must have at most 2 decimal places', errors)
    }
  }

  if (Object.keys(errors).length > 0) return { valid: false, errors }

  return { valid: true, data: product }
}

/**
 * Performs validation in two phases:
 * 1. convertProductFieldTypes - field type checks and payload conversion
 * 2. validateProduct - business rule validations on the converted ProductBaseType
 */
export function parseProductPayload(
  payload: unknown
): { valid: true; data: ProductBaseType } | { valid: false; errors: ProductErrorsType } {
  const fieldTypeResult = convertProductFieldTypes(payload)
  if (!fieldTypeResult.valid) return fieldTypeResult

  return validateProduct(fieldTypeResult.data)
}

/** Translate the English message keys in per-field errors returned by validateProduct(). */
export function translateFieldErrors(c: Context, errors: Record<string, string>): Record<string, string> {
  const translated: Record<string, string> = {}
  if (errors.productName) translated.productName = t(c, errors.productName)
  if (errors.description) translated.description = t(c, errors.description)
  if (errors.price) translated.price = t(c, errors.price)
  if (errors.modifiedAt) translated.modifiedAt = t(c, errors.modifiedAt)
  return translated
}