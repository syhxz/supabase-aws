import { describe, it, expect, vi } from 'vitest'
import {
  isArray,
  ensureArray,
  safeFind,
  safeFilter,
  safeMap,
  validateArray,
  safeArrayOperation,
  isNonEmptyArray,
  safeLength,
  safeIncludes,
  safeSome,
  safeEvery,
} from './array-validation'

describe('Array Validation Utilities', () => {
  // Mock console methods to avoid noise in tests
  const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

  afterEach(() => {
    consoleSpy.mockClear()
    consoleErrorSpy.mockClear()
  })

  describe('isArray', () => {
    it('should return true for arrays', () => {
      expect(isArray([])).toBe(true)
      expect(isArray([1, 2, 3])).toBe(true)
      expect(isArray(['a', 'b'])).toBe(true)
    })

    it('should return false for non-arrays', () => {
      expect(isArray(null)).toBe(false)
      expect(isArray(undefined)).toBe(false)
      expect(isArray({})).toBe(false)
      expect(isArray('string')).toBe(false)
      expect(isArray(123)).toBe(false)
    })
  })

  describe('ensureArray', () => {
    it('should return the array if input is an array', () => {
      const arr = [1, 2, 3]
      expect(ensureArray(arr)).toBe(arr)
    })

    it('should return empty array for non-arrays', () => {
      expect(ensureArray(null)).toEqual([])
      expect(ensureArray(undefined)).toEqual([])
      expect(ensureArray({})).toEqual([])
      expect(ensureArray('string')).toEqual([])
    })
  })

  describe('safeFind', () => {
    it('should find elements in valid arrays', () => {
      const arr = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const result = safeFind(arr, (item: any) => item.id === 2)
      expect(result).toEqual({ id: 2 })
    })

    it('should return undefined for non-arrays', () => {
      const result = safeFind(null, (item: any) => item.id === 2)
      expect(result).toBeUndefined()
      expect(consoleSpy).toHaveBeenCalledWith('[Array Validation] safeFind called on non-array value:', 'object')
    })

    it('should return undefined when element not found', () => {
      const arr = [{ id: 1 }, { id: 2 }]
      const result = safeFind(arr, (item: any) => item.id === 99)
      expect(result).toBeUndefined()
    })

    it('should handle predicate errors gracefully', () => {
      const arr = [1, 2, 3]
      const result = safeFind(arr, () => {
        throw new Error('Predicate error')
      })
      expect(result).toBeUndefined()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('safeFilter', () => {
    it('should filter elements in valid arrays', () => {
      const arr = [1, 2, 3, 4, 5]
      const result = safeFilter(arr, (item: number) => item > 3)
      expect(result).toEqual([4, 5])
    })

    it('should return empty array for non-arrays', () => {
      const result = safeFilter(null, (item: any) => item > 3)
      expect(result).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith('[Array Validation] safeFilter called on non-array value:', 'object')
    })

    it('should handle predicate errors gracefully', () => {
      const arr = [1, 2, 3]
      const result = safeFilter(arr, () => {
        throw new Error('Predicate error')
      })
      expect(result).toEqual([])
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('safeMap', () => {
    it('should map elements in valid arrays', () => {
      const arr = [1, 2, 3]
      const result = safeMap(arr, (item: number) => item * 2)
      expect(result).toEqual([2, 4, 6])
    })

    it('should return empty array for non-arrays', () => {
      const result = safeMap(null, (item: any) => item * 2)
      expect(result).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith('[Array Validation] safeMap called on non-array value:', 'object')
    })

    it('should handle mapper errors gracefully', () => {
      const arr = [1, 2, 3]
      const result = safeMap(arr, () => {
        throw new Error('Mapper error')
      })
      expect(result).toEqual([])
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('validateArray', () => {
    it('should return valid result for arrays', () => {
      const arr = [1, 2, 3]
      const result = validateArray(arr)
      expect(result.isValid).toBe(true)
      expect(result.data).toBe(arr)
      expect(result.error).toBeUndefined()
    })

    it('should return invalid result for non-arrays', () => {
      const result = validateArray(null)
      expect(result.isValid).toBe(false)
      expect(result.data).toEqual([])
      expect(result.error).toBe('Expected array but received object')
    })
  })

  describe('safeArrayOperation', () => {
    it('should execute operation on valid arrays', () => {
      const arr = [1, 2, 3]
      const result = safeArrayOperation(arr, (array) => array.length, 0)
      expect(result).toBe(3)
    })

    it('should return fallback for non-arrays', () => {
      const result = safeArrayOperation(null, (array) => array.length, 0)
      expect(result).toBe(0)
    })

    it('should return fallback when operation throws', () => {
      const arr = [1, 2, 3]
      const result = safeArrayOperation(arr, () => {
        throw new Error('Operation error')
      }, 'fallback')
      expect(result).toBe('fallback')
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('isNonEmptyArray', () => {
    it('should return true for non-empty arrays', () => {
      expect(isNonEmptyArray([1])).toBe(true)
      expect(isNonEmptyArray([1, 2, 3])).toBe(true)
    })

    it('should return false for empty arrays', () => {
      expect(isNonEmptyArray([])).toBe(false)
    })

    it('should return false for non-arrays', () => {
      expect(isNonEmptyArray(null)).toBe(false)
      expect(isNonEmptyArray(undefined)).toBe(false)
      expect(isNonEmptyArray({})).toBe(false)
    })
  })

  describe('safeLength', () => {
    it('should return length for arrays', () => {
      expect(safeLength([])).toBe(0)
      expect(safeLength([1, 2, 3])).toBe(3)
    })

    it('should return 0 for non-arrays', () => {
      expect(safeLength(null)).toBe(0)
      expect(safeLength(undefined)).toBe(0)
      expect(safeLength({})).toBe(0)
      expect(safeLength('string')).toBe(0)
    })
  })

  describe('safeIncludes', () => {
    it('should check includes for arrays', () => {
      const arr = [1, 2, 3]
      expect(safeIncludes(arr, 2)).toBe(true)
      expect(safeIncludes(arr, 4)).toBe(false)
    })

    it('should return false for non-arrays', () => {
      expect(safeIncludes(null, 2)).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('[Array Validation] safeIncludes called on non-array value:', 'object')
    })
  })

  describe('safeSome', () => {
    it('should check some condition for arrays', () => {
      const arr = [1, 2, 3]
      expect(safeSome(arr, (item: number) => item > 2)).toBe(true)
      expect(safeSome(arr, (item: number) => item > 5)).toBe(false)
    })

    it('should return false for non-arrays', () => {
      expect(safeSome(null, (item: any) => item > 2)).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('[Array Validation] safeSome called on non-array value:', 'object')
    })

    it('should handle predicate errors gracefully', () => {
      const arr = [1, 2, 3]
      const result = safeSome(arr, () => {
        throw new Error('Predicate error')
      })
      expect(result).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('safeEvery', () => {
    it('should check every condition for arrays', () => {
      const arr = [1, 2, 3]
      expect(safeEvery(arr, (item: number) => item > 0)).toBe(true)
      expect(safeEvery(arr, (item: number) => item > 2)).toBe(false)
    })

    it('should return false for non-arrays', () => {
      expect(safeEvery(null, (item: any) => item > 0)).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('[Array Validation] safeEvery called on non-array value:', 'object')
    })

    it('should handle predicate errors gracefully', () => {
      const arr = [1, 2, 3]
      const result = safeEvery(arr, () => {
        throw new Error('Predicate error')
      })
      expect(result).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })
})