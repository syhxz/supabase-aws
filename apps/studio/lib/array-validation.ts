/**
 * Array Validation Utilities
 * 
 * Provides safe array operations and type validation to prevent
 * "TypeError: n.find is not a function" and similar array method errors.
 * 
 * These utilities implement defensive programming practices to ensure
 * array methods are only called on actual arrays, with appropriate
 * fallback handling when data is in an unexpected format.
 */

/**
 * Type guard to check if a value is an array
 */
export function isArray(value: unknown): value is Array<any> {
  return Array.isArray(value)
}

/**
 * Ensures a value is an array, returning an empty array if it's not
 */
export function ensureArray<T>(value: unknown): T[] {
  return isArray(value) ? value : []
}

/**
 * Safe find operation that validates the input is an array before calling find
 * @param data - The data to search in (may or may not be an array)
 * @param predicate - The predicate function to use for finding
 * @returns The found item or undefined if not found or data is not an array
 */
export function safeFind<T>(
  data: unknown,
  predicate: (item: T, index: number, array: T[]) => boolean
): T | undefined {
  if (!isArray(data)) {
    console.warn('[Array Validation] safeFind called on non-array value:', typeof data)
    return undefined
  }
  
  try {
    return data.find(predicate)
  } catch (error) {
    console.error('[Array Validation] Error in safeFind predicate:', error)
    return undefined
  }
}

/**
 * Safe filter operation that validates the input is an array before calling filter
 * @param data - The data to filter (may or may not be an array)
 * @param predicate - The predicate function to use for filtering
 * @returns The filtered array or empty array if data is not an array
 */
export function safeFilter<T>(
  data: unknown,
  predicate: (item: T, index: number, array: T[]) => boolean
): T[] {
  if (!isArray(data)) {
    console.warn('[Array Validation] safeFilter called on non-array value:', typeof data)
    return []
  }
  
  try {
    return data.filter(predicate)
  } catch (error) {
    console.error('[Array Validation] Error in safeFilter predicate:', error)
    return []
  }
}

/**
 * Safe map operation that validates the input is an array before calling map
 * @param data - The data to map (may or may not be an array)
 * @param mapper - The mapper function to use for transformation
 * @returns The mapped array or empty array if data is not an array
 */
export function safeMap<T, U>(
  data: unknown,
  mapper: (item: T, index: number, array: T[]) => U
): U[] {
  if (!isArray(data)) {
    console.warn('[Array Validation] safeMap called on non-array value:', typeof data)
    return []
  }
  
  try {
    return data.map(mapper)
  } catch (error) {
    console.error('[Array Validation] Error in safeMap mapper:', error)
    return []
  }
}

/**
 * Validation result interface for data validation operations
 */
export interface ValidationResult<T> {
  isValid: boolean
  data: T
  error?: string
}

/**
 * Validates that a value is an array and returns a validation result
 * @param value - The value to validate
 * @returns ValidationResult with the validated array or error information
 */
export function validateArray<T>(value: unknown): ValidationResult<T[]> {
  if (isArray(value)) {
    return {
      isValid: true,
      data: value as T[]
    }
  }
  
  const error = `Expected array but received ${typeof value}`
  console.warn('[Array Validation] Validation failed:', error)
  
  return {
    isValid: false,
    data: [],
    error
  }
}

/**
 * Safe array operation wrapper that provides comprehensive error handling
 * @param data - The data to operate on
 * @param operation - The operation to perform on the array
 * @param fallback - The fallback value to return if operation fails
 * @returns The result of the operation or the fallback value
 */
export function safeArrayOperation<T, R>(
  data: unknown,
  operation: (array: T[]) => R,
  fallback: R
): R {
  const validation = validateArray<T>(data)
  
  if (!validation.isValid) {
    return fallback
  }
  
  try {
    return operation(validation.data)
  } catch (error) {
    console.error('[Array Validation] Error in array operation:', error)
    return fallback
  }
}

/**
 * Type guard for checking if a value is a non-empty array
 */
export function isNonEmptyArray(value: unknown): value is Array<any> {
  return isArray(value) && value.length > 0
}

/**
 * Safe length getter that returns 0 for non-arrays
 */
export function safeLength(data: unknown): number {
  return isArray(data) ? data.length : 0
}

/**
 * Safe includes check that returns false for non-arrays
 */
export function safeIncludes<T>(data: unknown, searchElement: T): boolean {
  if (!isArray(data)) {
    console.warn('[Array Validation] safeIncludes called on non-array value:', typeof data)
    return false
  }
  
  try {
    return data.includes(searchElement)
  } catch (error) {
    console.error('[Array Validation] Error in safeIncludes:', error)
    return false
  }
}

/**
 * Safe some operation that validates the input is an array before calling some
 */
export function safeSome<T>(
  data: unknown,
  predicate: (item: T, index: number, array: T[]) => boolean
): boolean {
  if (!isArray(data)) {
    console.warn('[Array Validation] safeSome called on non-array value:', typeof data)
    return false
  }
  
  try {
    return data.some(predicate)
  } catch (error) {
    console.error('[Array Validation] Error in safeSome predicate:', error)
    return false
  }
}

/**
 * Safe every operation that validates the input is an array before calling every
 */
export function safeEvery<T>(
  data: unknown,
  predicate: (item: T, index: number, array: T[]) => boolean
): boolean {
  if (!isArray(data)) {
    console.warn('[Array Validation] safeEvery called on non-array value:', typeof data)
    return false
  }
  
  try {
    return data.every(predicate)
  } catch (error) {
    console.error('[Array Validation] Error in safeEvery predicate:', error)
    return false
  }
}