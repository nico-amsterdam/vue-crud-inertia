/**
 * Generic field validation library.
 *
 */

/**
 * Validates that a string field value doesn't exceed max length.
 * If the field exists on the object and is a string, checks length.
 * Mutates the errors object if validation fails.
 *
 * @param object - the object containing the field
 * @param field - a field name (ideally a valid key of the object type)
 * @param maxLength - maximum allowed length
 * @param errorMessage - error message to set if validation fails
 * @param errors - the errors object to mutate
 */
export function validateMaxLength(
  object: Record<string, unknown>,
  field: string,
  maxLength: number,
  errorMessage: string,
  errors: Record<string, string>
): void {
  const value = object[field]
  if (typeof value === 'string' && value.length > maxLength) {
    errors[field] = errorMessage
  }
}

/**
 * Validates that a number field value is non-negative.
 *
 * @param object - the object containing the field
 * @param field - a field name (ideally a valid key of the object type)
 * @param errorMessage - error message to set if validation fails
 * @param errors - the errors object to mutate
 * @returns true if valid, false if validation failed
 */
export function validateNonNegative(
  object: Record<string, unknown>,
  field: string,
  errorMessage: string,
  errors: Record<string, string>
): boolean {
  const value = object[field]
  if (value === null || value === undefined) return true
  if (typeof value === 'number') {
    if (value >= 0) return true
  } else if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return true
    const parsed = Number(trimmed)
    if (!Number.isNaN(parsed) && parsed >= 0) return true
  }
  errors[field] = errorMessage
  return false
}

/**
 * Validates that a number field value does not exceed max.
 *
 * @param object - the object containing the field
 * @param field - a field name (ideally a valid key of the object type)
 * @param maxValue - maximum allowed value
 * @param errorMessage - error message to set if validation fails
 * @param errors - the errors object to mutate
 * @returns true if valid, false if validation failed
 */
export function validateMaxValue(
  object: Record<string, unknown>,
  field: string,
  maxValue: number,
  errorMessage: string,
  errors: Record<string, string>
): boolean {
  const value = object[field]
  if (value === null || value === undefined) return true
  if (typeof value === 'number') {
    if (value <= maxValue) return true
  } else if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return true
    const parsed = Number(trimmed)
    if (!Number.isNaN(parsed) && parsed <= maxValue) return true
  }
  errors[field] = errorMessage
  return false
}

/**
 * Validates that a number field has at most maxDecimals decimal places.
 *
 * @param object - the object containing the field
 * @param field - a field name (ideally a valid key of the object type)
 * @param maxDecimals - maximum allowed decimal places
 * @param errorMessage - error message to set if validation fails
 * @param errors - the errors object to mutate
 * @returns true if valid, false if validation failed
 */
export function validateMaxDecimals(
  object: Record<string, unknown>,
  field: string,
  maxDecimals: number,
  errorMessage: string,
  errors: Record<string, string>
): boolean {
  const value = object[field]
  if (value === null || value === undefined) return true
  if (typeof value === 'number') {
    const rounded = Math.round(value * 10 ** maxDecimals)
    if (Math.abs(rounded - value * 10 ** maxDecimals) <= 1e-6) return true
  } else if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return true
    const parsed = Number(trimmed)
    if (!Number.isNaN(parsed)) {
      const rounded = Math.round(parsed * 10 ** maxDecimals)
      if (Math.abs(rounded - parsed * 10 ** maxDecimals) <= 1e-6) return true
    }
  }
  errors[field] = errorMessage
  return false
}

/**
 * Converts a field value to a string.
 * If the field exists and is a string, returns the trimmed value.
 * If the field exists but is not a string, sets an error and returns ''.
 * If the field doesn't exist, sets an error and returns ''.
 *
 * @param input - the object containing the field
 * @param field - a field name (ideally a valid key of the object type)
 * @param errorMessage - error message to set if conversion fails
 * @param errors - the errors object to mutate
 * @returns the trimmed string value if valid, empty string otherwise
 */
export function convertStringType(
  input: Record<string, unknown>,
  field: string,
  errorMessage: string,
  errors: Record<string, string>
): string {
  // Handle null/undefined input gracefully
  if (input === null || input === undefined) {
    errors[field] = errorMessage
    return ''
  }
  const value = input[field]
  if (typeof value === 'string') return value.trim()
  if (value !== undefined) errors[field] = errorMessage
  return ''
}

/**
 * Converts a field value to a number.
 * If the field exists and is a number (or parseable string), returns the number.
 * If the field exists but is not a valid number, sets an error and returns null.
 * If the field doesn't exist, sets an error and returns null.
 *
 * @param input - the object containing the field
 * @param field - a field name (ideally a valid key of the object type)
 * @param errorMessage - error message to set if conversion fails
 * @param errors - the errors object to mutate
 * @returns the number value if valid, null otherwise
 */
export function convertNumberType(
  input: Record<string, unknown>,
  field: string,
  errorMessage: string,
  errors: Record<string, string>
): number | null {
  // Handle null/undefined input gracefully
  if (input === null || input === undefined) {
    errors[field] = errorMessage
    return null
  }
  const value = input[field]
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    if (!Number.isNaN(value)) return value
  } else if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null
    const parsed = Number(trimmed)
    if (!Number.isNaN(parsed)) return parsed
  }

  errors[field] = errorMessage
  return null
}

/**
 * Converts a field value to a Date.
 * If the field exists and is a Date instance (or parseable string), returns the Date.
 * If the field exists but is not a valid Date, sets an error and returns null.
 * If the field doesn't exist, sets an error and returns null.
 *
 * @param input - the object containing the field
 * @param field - a valid date field name from the object type T
 * @param errorMessage - error message to set if conversion fails
 * @param errors - the errors object to mutate
 * @returns the Date value if valid, null otherwise
 */
export function convertDateType(
  input: Record<string, unknown>,
  field: string,
  errorMessage: string,
  errors: Record<string, string>
): Date | null {
  // Handle null/undefined input gracefully
  if (input === null || input === undefined) {
    errors[field] = errorMessage
    return null
  }
  const value = input[field]
  if (value === null || value === undefined) return null
  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) return value
  } else if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  errors[field] = errorMessage
  return null
}